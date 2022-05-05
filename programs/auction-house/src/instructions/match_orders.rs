use std::cmp;

use anchor_lang::prelude::*;

use agnostic_orderbook::orderbook::OrderBookState;
use agnostic_orderbook::state::{
    Event, EventQueue, EventQueueHeader, Side as AobSide, EVENT_QUEUE_HEADER_LEN,
};
use agnostic_orderbook::utils::{fp32_div, fp32_mul};

use crate::access_controls::*;
use crate::consts::*;
use crate::error::CustomErrors;
use crate::program_accounts::*;

#[derive(Accounts)]
pub struct MatchOrders<'info> {
    // Technically don't need the auctioneer to sign for this one
    // pub auctioneer: Signer<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = auction.bump,
        mut
    )]
    pub auction: Box<Account<'info, Auction>>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.event_queue,
        owner = crate::ID,
        mut
    )]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.bids,
        owner = crate::ID,
        mut
    )]
    pub bids: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.asks,
        owner = crate::ID,
        mut
    )]
    pub asks: UncheckedAccount<'info>,
}

impl<'info> MatchOrders<'info> {
    pub fn access_control(&self) -> Result<()> {
        let auction = self.auction.clone().into_inner();
        let order_book = OrderBookState::new_safe(
            &self.bids.to_account_info(),
            &self.asks.to_account_info(),
            CALLBACK_INFO_LEN,
            CALLBACK_ID_LEN,
        )?;

        if !is_match_orders_phase_active(&auction, &order_book) {
            return Err(error!(CustomErrors::MatchOrdersPhaseNotActive));
        }

        Ok(())
    }
}

pub fn match_orders(ctx: Context<MatchOrders>, limit: u16) -> Result<()> {
    let auction = &mut ctx.accounts.auction;

    let header = {
        let mut event_queue_data: &[u8] =
            &ctx.accounts.event_queue.data.borrow()[0..EVENT_QUEUE_HEADER_LEN];
        EventQueueHeader::deserialize(&mut event_queue_data)
            .unwrap()
            .check()?
    };
    let mut event_queue = EventQueue::new_safe(
        header,
        &ctx.accounts.event_queue.to_account_info(),
        CALLBACK_INFO_LEN,
    )?;

    let mut order_book = OrderBookState::new_safe(
        &ctx.accounts.bids.to_account_info(),
        &ctx.accounts.asks.to_account_info(),
        CALLBACK_INFO_LEN,
        CALLBACK_ID_LEN,
    )?;

    // Process all the bids first, then move onto the asks
    let side: AobSide = if order_book.bids_is_empty() {
        AobSide::Ask
    } else {
        AobSide::Bid
    };

    for _ in 0..limit {
        // bbo: best bid or offer
        let bbo_key = match order_book.find_bbo(side) {
            None => {
                // Queue is empty
                break;
            }
            Some(key) => key,
        };
        let bbo_node = *order_book
            .get_tree(side)
            .get_node(bbo_key)
            .unwrap()
            .as_leaf()
            .unwrap();
        match side {
            AobSide::Ask => {
                let mut fill_size: u64 = 0;
                if auction.remaining_ask_fills > 0 {
                    fill_size = cmp::min(bbo_node.base_quantity, auction.remaining_ask_fills);
                    let quote_size = fp32_mul(fill_size, auction.clearing_price);
                    let order_fill = Event::Fill {
                        taker_side: side.opposite(),
                        maker_callback_info: order_book
                            .get_tree(side)
                            .get_callback_info(bbo_node.callback_info_pt as usize)
                            .to_owned(),
                        taker_callback_info: Vec::new(),
                        maker_order_id: bbo_node.order_id(),
                        quote_size,
                        base_size: fill_size,
                    };
                    event_queue
                        .push_back(order_fill)
                        .map_err(|_| error!(CustomErrors::AobEventQueueFull))?;
                    auction.remaining_ask_fills =
                        auction.remaining_ask_fills.checked_sub(fill_size).unwrap();
                }
                let out_size = bbo_node.base_quantity.checked_sub(fill_size).unwrap();
                let order_out = Event::Out {
                    side,
                    delete: true,
                    order_id: bbo_node.order_id(),
                    base_size: out_size,
                    callback_info: order_book
                        .get_tree(side)
                        .get_callback_info(bbo_node.callback_info_pt as usize)
                        .to_owned(),
                };
                event_queue
                    .push_back(order_out)
                    .map_err(|_| error!(CustomErrors::AobEventQueueFull))?;
                order_book
                    .get_tree(side)
                    .remove_by_key(bbo_node.key)
                    .unwrap();
            }
            AobSide::Bid => {
                let mut fill_size: u64 = 0;
                if auction.remaining_bid_fills > 0 {
                    fill_size = cmp::min(bbo_node.base_quantity, auction.remaining_bid_fills);
                    let quote_size = fp32_mul(fill_size, auction.clearing_price);
                    let order_fill = Event::Fill {
                        taker_side: side.opposite(),
                        maker_callback_info: order_book
                            .get_tree(side)
                            .get_callback_info(bbo_node.callback_info_pt as usize)
                            .to_owned(),
                        taker_callback_info: Vec::new(),
                        maker_order_id: bbo_node.order_id(),
                        quote_size,
                        base_size: fill_size,
                    };
                    event_queue
                        .push_back(order_fill)
                        .map_err(|_| error!(CustomErrors::AobEventQueueFull))?;
                    auction.remaining_bid_fills =
                        auction.remaining_bid_fills.checked_sub(fill_size).unwrap();
                }
                let mut out_size = bbo_node.base_quantity - fill_size;
                // Bids get a partial refund if they're filled at a lower price
                if fill_size > 0 && bbo_node.price() > auction.clearing_price {
                    let quote_owed = fp32_mul(fill_size, bbo_node.price())
                        .checked_sub(fp32_mul(fill_size, auction.clearing_price))
                        .unwrap();
                    // Event::out only takes base size as an argument so
                    // need to convert quote owed to base using bbo's price
                    let base_owed = fp32_div(quote_owed, bbo_node.price());
                    out_size = out_size.checked_add(base_owed).unwrap();
                }
                let order_out = Event::Out {
                    side,
                    delete: true,
                    order_id: bbo_node.order_id(),
                    base_size: out_size,
                    callback_info: order_book
                        .get_tree(side)
                        .get_callback_info(bbo_node.callback_info_pt as usize)
                        .to_owned(),
                };
                event_queue
                    .push_back(order_out)
                    .map_err(|_| error!(CustomErrors::AobEventQueueFull))?;
                order_book
                    .get_tree(side)
                    .remove_by_key(bbo_node.key)
                    .unwrap();
            }
        }
    }

    order_book.commit_changes();
    let mut event_queue_header_data: &mut [u8] = &mut ctx.accounts.event_queue.data.borrow_mut();
    event_queue
        .header
        .serialize(&mut event_queue_header_data)
        .unwrap();

    Ok(())
}
