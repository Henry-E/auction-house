use anchor_lang::prelude::*;

use anchor_spl::token::{Mint, TokenAccount};

use crate::access_controls::*;
use crate::account_data::*;
use crate::consts::*;
use crate::error::CustomErrors;

use agnostic_orderbook::state::Side as AobSide;

// Flexible on design decisions such as:
// should we check that the user has the associated token accounts that will
// required later on when settling the auction
#[derive(Accounts)]
#[instruction(max_orders: u8)]
pub struct InitOpenOrders<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    // Program accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = auction.bump,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        init,
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump,
        // TODO could add block {} with an if statement to use less space
        // if not an account for encrypted open orders
        space = (108 as usize).checked_add((88 as usize).checked_mul(max_orders as usize).unwrap()).unwrap(), 
        payer = user,
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    #[account(
        init,
        seeds = [user.key().as_ref(), ORDER_HISTORY.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump,
        space = 26,
        payer = user,
    )]
    pub order_history: Account<'info, OrderHistory>,
    // Token accounts
    #[account(address = auction.quote_mint)]
    pub quote_mint: Account<'info, Mint>,
    #[account(address = auction.base_mint)]
    pub base_mint: Account<'info, Mint>,
    #[account(
        associated_token::mint = quote_mint,
        associated_token::authority = user,
        // user_quote.owner == user.key(), // TODO compile errors here for some reason?
    )]
    pub user_quote: Account<'info, TokenAccount>,
    #[account(
        associated_token::mint = base_mint,
        associated_token::authority = user,
    )]
    pub user_base: Account<'info, TokenAccount>,
    // Programs
    pub system_program: Program<'info, System>,
}

impl InitOpenOrders<'_> {
    pub fn access_control(&self, max_orders: u8) -> Result<()> {
        let clock = Clock::get()?;
        let auction = self.auction.clone().into_inner();

        if !is_order_phase_active(clock, &auction) {
            return Err(error!(CustomErrors::OrderPhaseNotActive));
        }
        // TODO make the max_order value = 8 here a constant once we know
        // how many orders can be decrypted within 200k compute units
        if max_orders < 1 && 8 < max_orders {
            return Err(error!(CustomErrors::MaxOrdersValueIsInvalid));
        }
        Ok(())
    }
}

pub fn init_open_orders(ctx: Context<InitOpenOrders>, side: Side, max_orders: u8) -> Result<()> {
    ctx.accounts.open_orders.set_inner(OpenOrders {
        bump: *ctx.bumps.get("open_orders").unwrap(),
        authority: ctx.accounts.user.key(),
        max_orders,
        side,
        // Everything else defaults to 0
        nacl_pubkey: Vec::new(),
        encrypted_orders: Vec::new(),
        quote_token_locked: 0,
        quote_token_free: 0,
        base_token_locked: 0,
        base_token_free: 0,
        num_orders: 0,
        orders: Vec::new(),
    });

    ctx.accounts.order_history.set_inner(OrderHistory {
        bump: *ctx.bumps.get("order_history").unwrap(),
        side,
        quote_amount_returned: 0,
        base_amount_returned: 0,
    });
    Ok(())
}
