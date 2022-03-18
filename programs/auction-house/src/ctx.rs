use anchor_lang::prelude::*;

use crate::consts::*;

use anchor_spl::token::{Mint, Token, TokenAccount};


#[derive(Accounts)]
#[instruction(auction_num: u8)]
pub struct InitAuction<'info> {
    #[account(mut)]
    pub auctioneer: Signer<'info>,
    // Program Accounts
    // An account struct with all of the auction options
    // #[account(init, seeds = [], bump)]
    // pub auction: Account<'info, Auction>,
    // Stores public and private keys needed for RSA encryption / decryption
    // pub decryption_keys: Account<'info, DecryptionKeys>

    // Mints
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    // Token vaults
    #[account(
        init,
        token::mint = base_mint,
        token::authority = auctioneer, // It should actually be the serum account or something?
        seeds = [BASE_VAULT.as_ref(), auctioneer.key().as_ref(), &[auction_num]],
        bump,
        payer = auctioneer,
    )]
    pub base_vault: Account<'info, TokenAccount>,
    pub quote_vault: Account<'info, TokenAccount>,
    // Sysvars?
    pub rent: Sysvar<'info, Rent>,
    // Programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,

}