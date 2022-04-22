use anchor_lang::prelude::*;

use anchor_spl::token::{Token, TokenAccount};

use crate::access_controls::*;
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
        seeds = [AUCTION.as_bytes(), &auction.start_order_phase.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_order_phase.to_le_bytes(), auction.authority.as_ref()],
        bump = open_orders.bump,
        mut
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    // AOB Accounts
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
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.asks,
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
        seeds = [QUOTE_VAULT.as_bytes(), &auction.start_order_phase.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.quote_vault,
        mut
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [BASE_VAULT.as_bytes(), &auction.start_order_phase.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.base_vault,
        mut
    )]
    pub base_vault: Account<'info, TokenAccount>,
    // Programs
    pub token_program: Program<'info, Token>,
}

impl NewOrder<'_> {
    pub fn access_control_new_order(&self, limit_price: u64, max_base_qty: u64) -> Result<()> {
        let clock = Clock::get()?;
        let auction = self.auction.clone().into_inner();
        let open_orders = self.open_orders.clone().into_inner();

        is_order_phase_active(clock, &auction)?;
        normal_orders_only(&auction, &open_orders)?;
        has_space_for_new_orders(&open_orders)?;

        if limit_price % self.auction.tick_size != 0 {
            return Err(error!(CustomErrors::LimitPriceNotAMultipleOfTickSize));
        }

        if max_base_qty < self.auction.min_base_order_size {
            return Err(error!(CustomErrors::OrderBelowMinBaseOrderSize));
        }

        Ok(())
    }

    // TODO move this to cancel_order.rs
    pub fn access_control_cancel_order(&self, order_id: u128) -> Result<()> {
        let clock = Clock::get()?;
        let auction = self.auction.clone().into_inner();
        let open_orders = self.open_orders.clone().into_inner();

        is_order_phase_active(clock, &auction)?;
        normal_orders_only(&auction, &open_orders)?;

        // Validate the order id is present, will error inside function if not
        let _ = self.open_orders.find_order_index(order_id)?;

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
    let params =
        ctx.accounts
            .open_orders
            .new_order_params(limit_price, max_base_qty, max_quote_qty);
    let order_summary = order_book
        .new_order(
            params,
            &mut event_queue,
            ctx.accounts.auction.min_base_order_size,
        )
        .unwrap();

    let open_orders = &mut *ctx.accounts.open_orders;
    open_orders
        .orders
        .push(order_summary.posted_order_id.unwrap());
    open_orders.num_orders += 1;

    match open_orders.side {
        Side::Ask => {
            // TODO transfer total_base_qty worth of base currency from the user's account

            open_orders.base_token_locked = open_orders
                .base_token_locked
                .checked_add(order_summary.total_base_qty)
                .unwrap();
        }
        Side::Bid => {
            // TODO transfer total_quote_qty worth of quote currency from the user's account

            open_orders.quote_token_locked = open_orders
                .quote_token_locked
                .checked_add(order_summary.total_quote_qty)
                .unwrap();
        }
    }

    Ok(())
}
