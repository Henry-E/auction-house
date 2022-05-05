use anchor_lang::prelude::*;

use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::access_controls::*;
use crate::consts::*;
use crate::error::CustomErrors;
use crate::program_accounts::*;
use crate::types::*;

use agnostic_orderbook::orderbook::OrderBookState;
use agnostic_orderbook::state::{EventQueue, EventQueueHeader, EVENT_QUEUE_HEADER_LEN};
use agnostic_orderbook::utils::fp32_mul;

#[derive(Accounts)]
pub struct NewOrder<'info> {
    pub user: Signer<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = auction.bump,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
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
    pub bids: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.asks,
        owner = crate::ID,
        mut
    )]
    pub asks: UncheckedAccount<'info>,
    // Token accounts
    #[account(address = auction.quote_mint)]
    pub quote_mint: Box<Account<'info, Mint>>,
    #[account(address = auction.base_mint)]
    pub base_mint: Box<Account<'info, Mint>>,
    #[account(
        associated_token::mint = quote_mint,
        associated_token::authority = user,
        mut
    )]
    pub user_quote: Account<'info, TokenAccount>,
    #[account(
        associated_token::mint = base_mint,
        associated_token::authority = user,
        mut
    )]
    pub user_base: Account<'info, TokenAccount>,
    #[account(
        seeds = [QUOTE_VAULT.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = auction.bumps.quote_vault,
        mut
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [BASE_VAULT.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
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

        if !is_order_phase_active(clock, &auction) {
            return Err(error!(CustomErrors::OrderPhaseNotActive));
        }
        normal_orders_only(&auction, &open_orders)?;
        has_space_for_new_orders(&open_orders)?;
        validate_price_and_qty(&auction, limit_price, max_base_qty)?;

        Ok(())
    }

    // TODO move this to cancel_order.rs
    pub fn access_control_cancel_order(&self, order_id: &u128) -> Result<()> {
        let clock = Clock::get()?;
        let auction = self.auction.clone().into_inner();
        let open_orders = self.open_orders.clone().into_inner();

        if !is_order_phase_active(clock, &auction) {
            return Err(error!(CustomErrors::OrderPhaseNotActive));
        }
        normal_orders_only(&auction, &open_orders)?;

        // Validate the order id is present, will error inside function if not
        let _ = self.open_orders.find_order_index(order_id)?;

        Ok(())
    }
}

impl<'info> NewOrder<'info> {
    pub fn transfer_user_base(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.user_base.to_account_info(),
            to: self.base_vault.to_account_info(),
            authority: self.user.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
    pub fn transfer_user_quote(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.user_quote.to_account_info(),
            to: self.quote_vault.to_account_info(),
            authority: self.user.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
    pub fn transfer_base_vault(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.base_vault.to_account_info(),
            to: self.user_base.to_account_info(),
            authority: self.auction.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
    pub fn transfer_quote_vault(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.quote_vault.to_account_info(),
            to: self.user_quote.to_account_info(),
            authority: self.auction.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

pub fn new_order(ctx: Context<NewOrder>, limit_price: u64, max_base_qty: u64) -> Result<()> {
    let mut order_book = OrderBookState::new_safe(
        &ctx.accounts.bids.to_account_info(),
        &ctx.accounts.asks.to_account_info(),
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
            msg!("order summary {:?}", order_summary);
            msg!("max base qty {}", max_base_qty);
            open_orders.base_token_locked = open_orders
                .base_token_locked
                .checked_add(order_summary.total_base_qty)
                .unwrap();
            token::transfer(
                ctx.accounts.transfer_user_base(),
                order_summary.total_base_qty,
            )?;
        }
        Side::Bid => {
            open_orders.quote_token_locked = open_orders
                .quote_token_locked
                .checked_add(order_summary.total_quote_qty)
                .unwrap();
            token::transfer(
                ctx.accounts.transfer_user_quote(),
                order_summary.total_quote_qty,
            )?;
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
