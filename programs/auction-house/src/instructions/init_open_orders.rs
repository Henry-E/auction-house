use anchor_lang::prelude::*;

use anchor_spl::token::{Mint, TokenAccount};

use crate::account_data::*;
use crate::consts::*;
use crate::error::CustomErrors;

use agnostic_orderbook::state::Side;

// Flexible on design decisions such as:
// should we check that the user has the associated token accounts that will
// required later on when settling the auction
#[derive(Accounts)]
// #[instruction()]
pub struct InitOpenOrders<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    // Program accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        init,
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump,
        space = 500, // TODO add some kind of macro to calculate the space needed
        payer = user,
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    #[account(
        init,
        seeds = [user.key().as_ref(), ORDER_HISTORY.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump,
        space = 18,
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
    pub fn access_control(&self, side: Side, max_orders: u8) -> Result<()> {
        let clock = Clock::get()?;
        if (self.auction.end_asks < clock.unix_timestamp && side == Side::Ask)
            || (self.auction.end_bids < clock.unix_timestamp && side == Side::Bid)
        {
            return Err(error!(CustomErrors::BidOrAskOrdersAreFinished));
        }
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
        side,
        max_orders,
        // Everything else defaults to 0
        ..(*ctx.accounts.open_orders).clone().into_inner()
    });

    ctx.accounts.order_history.set_inner(OrderHistory {
        bump: *ctx.bumps.get("order_history").unwrap(),
        side,
        quote_amount_returned: 0,
        base_amount_returned: 0,
    });
    Ok(())
}
