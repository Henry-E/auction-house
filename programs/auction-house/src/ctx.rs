use anchor_lang::prelude::*;

use crate::consts::*;
use crate::account::*;

use anchor_spl::token::{Mint, Token, TokenAccount};


#[derive(Accounts)]
#[instruction(start_time: i64)]
pub struct InitAuction<'info> {
    #[account(mut)]
    pub auctioneer: Signer<'info>,
    // Program Accounts
    // An account struct with all of the auction options
    #[account(
        init, 
        seeds = [AUCTION.as_bytes(), &start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        space = 1000,
        payer = auctioneer,
    )]
    pub auction: Box<Account<'info, Auction>>,
    // Stores public and private keys needed for RSA encryption / decryption
    // pub decryption_keys: Account<'info, DecryptionKeys>
    // Mints
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    // Token vaults
    #[account(
        init,
        token::mint = base_mint,
        token::authority = auctioneer, // It should probably be the auction account, since it will sign
        seeds = [BASE_VAULT.as_bytes(), &start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        payer = auctioneer,
    )]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        token::mint = base_mint,
        token::authority = auctioneer, // It should probably be the auction account, since it will sign
        seeds = [QUOTE_VAULT.as_bytes(), &start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        payer = auctioneer,
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    // AOB accounts
    // This one can probably be a PDA if we wanted
    pub orderbook_manager: UncheckedAccount<'info>,
    // This should be initialized with a set amount of space, zeroed and owned by the program
    pub event_queue: UncheckedAccount<'info>,
    // This should be initialized with a set amount of space, zeroed and owned by the program
    pub bid_queue: UncheckedAccount<'info>,
    // This should be initialized with a set amount of space, zeroed and owned by the program
    pub ask_queue: UncheckedAccount<'info>,
    // Sysvars?
    pub rent: Sysvar<'info, Rent>,
    // Programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,

}