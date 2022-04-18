use anchor_lang::prelude::*;

use anchor_spl::token::{Token, TokenAccount};

use crate::account_data::*;
use crate::consts::*;
use crate::error::CustomErrors;

use agnostic_orderbook::critbit::Slab;
use agnostic_orderbook::orderbook::OrderBookState;
use agnostic_orderbook::processor::new_order::Params;
use agnostic_orderbook::state::{
    AccountTag, EventQueue, EventQueueHeader, Side, EVENT_QUEUE_HEADER_LEN,
};
use agnostic_orderbook::utils::fp32_mul;

#[derive(Accounts)]
pub struct NewOrder<'info> {
    pub user: Signer<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = open_orders.bump,
        mut
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    // AOB Accounts
    #[account(
        seeds = [MARKET_STATE.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.market_state,
    )]
    pub market_state: Box<Account<'info, MarketState>>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.event_queue),
        owner = crate::ID,
        mut
    )]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.bids),
        owner = crate::ID,
        mut
    )]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.asks),
        owner = crate::ID,
        mut
    )]
    pub ask_queue: UncheckedAccount<'info>,
    // Token accounts
    #[account(
        constraint = user_token.owner == user.key(),
        mut
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        seeds = [QUOTE_VAULT.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.quote_vault,
        mut
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [BASE_VAULT.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.base_vault,
        mut
    )]
    pub base_vault: Account<'info, TokenAccount>,
    // Programs
    pub token_program: Program<'info, Token>,
}

impl NewOrder<'_> {
    pub fn access_control(&self, limit_price: u64, max_base_qty: u64) -> Result<()> {
        let clock = Clock::get()?;
        if (self.auction.end_asks < clock.unix_timestamp && self.open_orders.side == Side::Ask)
            || (self.auction.end_bids < clock.unix_timestamp && self.open_orders.side == Side::Bid)
        {
            return Err(error!(CustomErrors::BidOrAskOrdersAreFinished));
        }

        if (self.auction.are_asks_encrypted && self.open_orders.side == Side::Ask)
            || (self.auction.are_bids_encrypted && self.open_orders.side == Side::Bid)
        {
            return Err(error!(CustomErrors::EncryptedOrdersOnlyOnThisSide));
        }

        if limit_price % self.auction.tick_size != 0 {
            return Err(error!(CustomErrors::LimitPriceNotAMultipleOfTickSize));
        }

        if max_base_qty < self.auction.min_base_order_size {
            return Err(error!(CustomErrors::OrderBelowMinBaseOrderSize));
        }

        if self.open_orders.num_orders == self.open_orders.max_orders {
            return Err(error!(CustomErrors::TooManyOrders));
        }

        Ok(())
    }
}

pub fn new_order(ctx: Context<NewOrder>, limit_price: u64, max_base_qty: u64) -> Result<()> {
    let mut order_book = OrderBookState::new_safe(
        &ctx.accounts.bid_queue.to_account_info(),
        &ctx.accounts.ask_queue.to_account_info(),
        CALLBACK_INFO_LEN,
        CALLBACK_ID_LEN,
    )?;

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

    let max_quote_qty = fp32_mul(max_base_qty, limit_price);
    let params = Params {
        max_base_qty,
        max_quote_qty,
        limit_price,
        side: ctx.accounts.open_orders.side,
        callback_info: Vec::new(),
        post_only: true,
        post_allowed: true,
        // self trade behaviour is ignored, this is a vestigial argument
        self_trade_behavior: agnostic_orderbook::state::SelfTradeBehavior::DecrementTake,
        match_limit: 1,
    };

    // TODO we don't do anything with the AoError here, what should we do?
    let order_summary = order_book
        .new_order(
            params,
            &mut event_queue,
            ctx.accounts.auction.min_base_order_size,
        )
        .unwrap();

    let open_orders = &mut *ctx.accounts.open_orders;

    match open_orders.side {
        Side::Ask => {
            // TODO transfer max_base_qty worth of base currency from the user's account

            open_orders
                .orders
                .push(order_summary.posted_order_id.unwrap());

            open_orders.base_token_locked = open_orders
                .base_token_locked
                .checked_add(order_summary.total_base_qty)
                .unwrap();

            open_orders.num_orders += 1;
        }
        Side::Bid => {
            // TODO transfer max_quote_qty worth of quote currency from the user's account

            open_orders
                .orders
                .push(order_summary.posted_order_id.unwrap());

            open_orders.quote_token_locked = open_orders
                .quote_token_locked
                .checked_add(order_summary.total_quote_qty)
                .unwrap();

            open_orders.num_orders += 1;
        }
    }

    Ok(())
}