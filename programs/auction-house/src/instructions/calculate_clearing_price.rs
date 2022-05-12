use std::convert::TryInto;

use anchor_lang::prelude::*;

use agnostic_orderbook::critbit::LeafNode;
use agnostic_orderbook::orderbook::OrderBookState;
use agnostic_orderbook::state::Side as AobSide;

use crate::access_controls::*;
use crate::consts::*;
use crate::error::CustomErrors;
use crate::program_accounts::*;

#[derive(Accounts)]
pub struct CalculateClearingPrice<'info> {
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
        address = auction.bids,
        owner = crate::ID,
    )]
    pub bids: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.asks,
        owner = crate::ID,
    )]
    pub asks: UncheckedAccount<'info>,
}

impl CalculateClearingPrice<'_> {
    pub fn access_control(&self) -> Result<()> {
        let clock = Clock::get()?;
        let auction = self.auction.clone().into_inner();

        if !is_calc_clearing_price_phase_active(clock, &auction) {
            return Err(error!(CustomErrors::CalcClearingPricePhaseNotActive));
        }

        Ok(())
    }
}

pub fn calculate_clearing_price(ctx: Context<CalculateClearingPrice>, limit: u16) -> Result<()> {
    let auction = &mut ctx.accounts.auction;

    let mut order_book = OrderBookState::new_safe(
        &ctx.accounts.bids.to_account_info(),
        &ctx.accounts.asks.to_account_info(),
        CALLBACK_INFO_LEN,
        CALLBACK_ID_LEN,
    )?;

    let bid_slab = order_book.get_tree(AobSide::Bid);
    let mut bid_iter = if auction.bid_search_stack_depth > 0 {
        bid_slab.clone().resume_iter(
            false,
            &auction.bid_search_stack_values[0..auction.bid_search_stack_depth as usize].to_vec(),
        )
    } else {
        bid_slab.clone().into_iter(false)
    };
    let mut current_bid: LeafNode;

    let ask_slab = order_book.get_tree(AobSide::Ask);
    let mut ask_iter = if auction.ask_search_stack_depth > 0 {
        ask_slab.clone().resume_iter(
            true,
            &auction.ask_search_stack_values[0..auction.ask_search_stack_depth as usize].to_vec(),
        )
    } else {
        ask_slab.clone().into_iter(true)
    };
    let mut current_ask: LeafNode;

    if auction.current_ask_key == 0 && auction.current_bid_key == 0 {
        current_bid = match bid_iter.next() {
            Some(bid) => bid,
            None => {
                msg!("No orders found on the bid queue");
                auction.has_found_clearing_price = true;
                return Ok(());
            }
        };
        auction.current_bid_key = current_bid.key;
        current_ask = match ask_iter.next() {
            Some(ask) => ask,
            None => {
                msg!("No orders found on the ask queue");
                auction.has_found_clearing_price = true;
                return Ok(());
            }
        };
        auction.current_ask_key = current_ask.key;
        if current_ask.price() > current_bid.price() {
            msg!("Orders prices crossed before clearing even started");
            auction.has_found_clearing_price = true;
            return Ok(());
        }
    } else {
        current_bid = bid_iter
            .find(|this_node| this_node.key == auction.current_bid_key)
            .ok_or_else(|| error!(CustomErrors::NodeKeyNotFound))?;
        current_ask = ask_iter
            .find(|this_node| this_node.key == auction.current_ask_key)
            .ok_or_else(|| error!(CustomErrors::NodeKeyNotFound))?;
    }

    // We need to store the stack prior to the loop finishing
    // because we iterate to the store the next key before ending the loop
    let mut ask_stack: Vec<u32> = Vec::new();
    let mut bid_stack: Vec<u32> = Vec::new();

    for _ in 0..limit {
        ask_stack = ask_iter.search_stack.clone();
        bid_stack = bid_iter.search_stack.clone();
        let bid_quantity_remaining = current_bid
            .base_quantity
            .checked_sub(auction.current_bid_quantity_filled)
            .unwrap();
        let ask_quantity_remaining = current_ask
            .base_quantity
            .checked_sub(auction.current_ask_quantity_filled)
            .unwrap();
        let is_bid_gte_ask = bid_quantity_remaining >= ask_quantity_remaining;
        match is_bid_gte_ask {
            true => {
                // Ask order is fully filled
                auction.current_bid_quantity_filled = auction
                    .current_bid_quantity_filled
                    .checked_add(ask_quantity_remaining)
                    .unwrap();
                auction.total_quantity_filled_so_far = auction
                    .total_quantity_filled_so_far
                    .checked_add(ask_quantity_remaining)
                    .unwrap();
                match ask_iter.next() {
                    Some(new_ask) => {
                        if new_ask.price() > current_bid.price() {
                            // price have crossed
                            auction.has_found_clearing_price = true;
                            break;
                        }
                        current_ask = new_ask;
                        auction.current_ask_key = new_ask.key;
                        auction.current_ask_quantity_filled = 0;
                    }
                    None => {
                        // No more asks
                        auction.has_found_clearing_price = true;
                        break;
                    }
                }
            }
            false => {
                // Bid order is fully filled
                auction.current_ask_quantity_filled = auction
                    .current_ask_quantity_filled
                    .checked_add(bid_quantity_remaining)
                    .unwrap();
                auction.total_quantity_filled_so_far = auction
                    .total_quantity_filled_so_far
                    .checked_add(bid_quantity_remaining)
                    .unwrap();
                match bid_iter.next() {
                    Some(new_bid) => {
                        if current_ask.price() > new_bid.price() {
                            // price have crossed
                            auction.has_found_clearing_price = true;
                            break;
                        }
                        current_bid = new_bid;
                        auction.current_bid_key = new_bid.key;
                        auction.current_bid_quantity_filled = 0;
                    }
                    None => {
                        // No more bids
                        auction.has_found_clearing_price = true;
                        break;
                    }
                }
            }
        }
    }

    if ask_stack.len() > 32 || bid_stack.len() > 32 {
        msg!(
            "Slab iterator stack too deep bids={} asks={}",
            bid_stack.len(),
            ask_stack.len()
        );
        return Err(error!(CustomErrors::SlabIteratorOverflow));
    }
    auction.ask_search_stack_depth = ask_stack.len() as u8;
    auction.bid_search_stack_depth = bid_stack.len() as u8;
    let ask_padding: Vec<u32> = vec![0; 32 - ask_stack.len()];
    let bid_padding: Vec<u32> = vec![0; 32 - bid_stack.len()];
    auction.ask_search_stack_values = [ask_stack, ask_padding].concat().try_into().unwrap();
    auction.bid_search_stack_values = [bid_stack, bid_padding].concat().try_into().unwrap();

    if auction.has_found_clearing_price {
        auction.total_quantity_matched = auction.total_quantity_filled_so_far;
        auction.remaining_bid_fills = auction.total_quantity_filled_so_far;
        auction.remaining_ask_fills = auction.total_quantity_filled_so_far;
        auction.final_bid_price = current_bid.price();
        auction.final_ask_price = current_ask.price();
        // For now clearing price defaults to lowest bid that fills the ask quantity
        auction.clearing_price = current_bid.price();
        msg!(
            "total_quantity_matched: {}, clearing_price: {}",
            auction.total_quantity_matched,
            auction.clearing_price
        );
    }

    Ok(())
}
