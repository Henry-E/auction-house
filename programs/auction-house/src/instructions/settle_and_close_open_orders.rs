use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::account_data::*;
use crate::consts::*;
use crate::error::CustomErrors;

// Flexible on design decisions such as:
// whether this function should be signed by the auctioneer
// whether the user has to provide associated token accounts (vs. regular ones)
// Whether the auctioneer account needs to sign
#[derive(Accounts)]
pub struct SettleAndCloseOpenOrders<'info> {
    #[account(mut)]
    pub user: SystemAccount<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = auction.bump,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = open_orders.bump,
        mut,
        close = user,
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    #[account(
        seeds = [user.key().as_ref(), ORDER_HISTORY.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = order_history.bump,
        mut
    )]
    pub order_history: Account<'info, OrderHistory>, // Persists after open_orders has closed
    // Token Accounts
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
    // Programs
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl SettleAndCloseOpenOrders<'_> {
    // Allowed to be called at any time essentially
    pub fn access_control(&self) -> Result<()> {
        if self.open_orders.num_orders > 0 {
            return Err(error!(CustomErrors::OpenOrdersHasOpenOrders));
        }
        // Technically a redundant check but totally worth making sure
        if self.open_orders.quote_token_locked != 0 || self.open_orders.base_token_locked != 0 {
            return Err(error!(CustomErrors::OpenOrdersHasLockedTokens));
        }
        Ok(())
    }
}

impl<'info> SettleAndCloseOpenOrders<'info> {
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

pub fn settle_and_close_open_orders(ctx: Context<SettleAndCloseOpenOrders>) -> Result<()> {
    let open_orders = &mut *ctx.accounts.open_orders;

    // This information + clearing price should be enough to display to the user after the auction
    ctx.accounts.order_history.set_inner(OrderHistory {
        bump: ctx.accounts.order_history.bump,
        side: open_orders.side,
        quote_amount_returned: open_orders.quote_token_free,
        base_amount_returned: open_orders.base_token_free,
    });

    // We have to set open orders.free values to 0 before calling the CPI
    // because of an immutable borrow compile error. Technically it would be
    // safe to omit setting the free values to 0 because of the anchor
    // account close discriminator but better to be totally sure.
    let quote_token_free = open_orders.quote_token_free;
    let base_token_free = open_orders.base_token_free;
    open_orders.quote_token_free = 0;
    open_orders.base_token_free = 0;
    if quote_token_free > 0 {
        token::transfer(
            ctx.accounts
                .transfer_quote_vault()
                .with_signer(&[auction_seeds!(ctx.accounts.auction)]),
            quote_token_free,
        )?;
    }
    if base_token_free > 0 {
        token::transfer(
            ctx.accounts
                .transfer_base_vault()
                .with_signer(&[auction_seeds!(ctx.accounts.auction)]),
            base_token_free,
        )?;
    }

    Ok(())
}