use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::access_controls::*;
use crate::consts::*;
use crate::error::CustomErrors;
use crate::program_accounts::*;
use crate::types::*;

#[derive(Accounts)]
pub struct NewEncryptedOrder<'info> {
    pub user: Signer<'info>,
    // Program accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = auction.bump,
        mut,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = open_orders.bump,
        mut
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
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

impl NewEncryptedOrder<'_> {
    pub fn access_control_new_encrypted_order(&self, nacl_pubkey: &Vec<u8>) -> Result<()> {
        let clock = Clock::get()?;
        let auction = self.auction.clone().into_inner();
        let open_orders = self.open_orders.clone().into_inner();

        if !is_order_phase_active(clock, &auction) {
            return Err(error!(CustomErrors::OrderPhaseNotActive));
        }
        encrypted_orders_only(&auction, &open_orders)?;
        has_space_for_new_orders(&open_orders)?;

        if !self.open_orders.nacl_pubkey.is_empty() && self.open_orders.nacl_pubkey != *nacl_pubkey
        {
            return Err(error!(CustomErrors::EncryptionPubkeysDoNotMatch));
        }
        Ok(())
    }

    pub fn access_control_cancel_encrypted_order(&self, order_idx: u8) -> Result<()> {
        let clock = Clock::get()?;
        let auction = self.auction.clone().into_inner();
        let open_orders = self.open_orders.clone().into_inner();

        // Encrypted orders can be cancelled only during the order phase or after
        // the decryption phase is over.
        // Needed in case there are still encrypted orders leftover after the decryption phase ends.
        if clock.unix_timestamp < auction.end_decryption_phase
            && !is_order_phase_active(clock, &auction)
        {
            return Err(error!(CustomErrors::OrderPhaseNotActive));
        }
        encrypted_orders_only(&auction, &open_orders)?;

        if self.open_orders.num_orders <= order_idx {
            return Err(error!(CustomErrors::OrderIdxNotValid));
        }

        Ok(())
    }
}

impl<'info> NewEncryptedOrder<'info> {
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

pub fn new_encrypted_order(
    ctx: Context<NewEncryptedOrder>,
    token_qty: u64,
    nacl_pubkey: Vec<u8>,
    nonce: Vec<u8>,
    cipher_text: Vec<u8>,
) -> Result<()> {
    let open_orders = &mut *ctx.accounts.open_orders;
    if open_orders.nacl_pubkey.is_empty() {
        open_orders.nacl_pubkey = nacl_pubkey;
    }
    // TODO move to access control probably, not sure about reference stuff for the vars nonce and cipher text
    if open_orders
        .encrypted_orders
        .iter()
        .any(|order| order.nonce == nonce && order.cipher_text == cipher_text)
    {
        return Err(error!(CustomErrors::IdenticalEncryptedOrderFound));
    }
    let this_order = EncryptedOrder {
        nonce,
        cipher_text,
        token_qty,
    };
    open_orders.encrypted_orders.push(this_order);
    open_orders.num_orders += 1;

    match open_orders.side {
        Side::Ask => {
            open_orders.base_token_locked = open_orders
                .base_token_locked
                .checked_add(token_qty)
                .unwrap();
            token::transfer(ctx.accounts.transfer_user_base(), token_qty)?;
        }
        Side::Bid => {
            open_orders.quote_token_locked = open_orders
                .quote_token_locked
                .checked_add(token_qty)
                .unwrap();
            token::transfer(ctx.accounts.transfer_user_quote(), token_qty)?;
        }
    }

    Ok(())
}
