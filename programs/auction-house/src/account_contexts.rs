use anchor_lang::prelude::*;

use crate::consts::*;
use crate::account_data::*;
// use crate::*;

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
    pub quote_mint: Account<'info, Mint>,
    pub base_mint: Account<'info, Mint>,
    // Token vaults
    #[account(
        init,
        token::mint = base_mint,
        token::authority = auctioneer, // It should probably be the auction account, since it will sign
        seeds = [QUOTE_VAULT.as_bytes(), &start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        payer = auctioneer,
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        token::mint = base_mint,
        token::authority = auctioneer, // It should probably be the auction account, since it will sign
        seeds = [BASE_VAULT.as_bytes(), &start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        payer = auctioneer,
    )]
    pub base_vault: Account<'info, TokenAccount>,
    // AOB accounts
    /// CHECK: This one will be a PDA   
    #[account(
        init, 
        seeds = [ORDERBOOK_MANAGER.as_bytes(), &start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        space = 1000,
        payer = auctioneer,
    )]
    pub orderbook_manager: UncheckedAccount<'info>,
    /// CHECK: This should be initialized with a set amount of space, zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be initialized with a set amount of space, zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be initialized with a set amount of space, zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub ask_queue: UncheckedAccount<'info>,
    // Sysvars?
    pub rent: Sysvar<'info, Rent>,
    // Programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


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
    // Check that the user already has the required associated token accounts
    // Note: This check isn't strictly necessary and could be removed if desired
    #[account(address = auction.quote_mint)]
    pub quote_mint: Account<'info, Mint>,
    #[account(address = auction.base_mint)]
    pub base_mint: Account<'info, Mint>,
    #[account(
        associated_token::mint = quote_mint,
        associated_token::authority = user,
    )]
    pub user_quote: Account<'info, TokenAccount>,
    #[account(
        associated_token::mint = base_mint,
        associated_token::authority = user,
    )]
    pub user_base: Account<'info, TokenAccount>,
    // Init user accounts
    #[account(
        init, 
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump,
        space = 500, // ??? We need quite a lot really with the encryption stuff
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
    // Programs
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct NewEncryptedOrder<'info> {
    pub user: Signer<'info>,
    // Program accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
        mut,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = open_orders.bump,
        mut
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    // Token accounts
    #[account(
        constraint = user_token.owner == user.key(),
        mut
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        seeds = [QUOTE_VAULT.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump, // TODO add this bump to auction account
        mut
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [BASE_VAULT.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump, // TODO add this bump auction account
        mut
    )]
    pub base_vault: Account<'info, TokenAccount>,
    // Programs
    pub token_program: Program<'info, Token>,
}

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
    /// CHECK: This should be owned by the program
    #[account(
        seeds = [ORDERBOOK_MANAGER.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump,
    )]
    pub orderbook_manager: Account<'info, MarketState>,
    /// CHECK: This should be owned by the program
    #[account(address = Pubkey::new_from_array(orderbook_manager.event_queue), owner = crate::ID)]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(address = Pubkey::new_from_array(orderbook_manager.bids), owner = crate::ID)]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(address = Pubkey::new_from_array(orderbook_manager.asks), owner = crate::ID)]
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

#[derive(Accounts)]
pub struct DecryptOrder<'info> {
    pub auctioneer: Signer<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump = auction.bump,
        mut
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [&open_orders.authority.as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump = open_orders.bump,
        mut
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    // AOB Accounts 
    /// CHECK: This should be owned by the program
    #[account(
        seeds = [ORDERBOOK_MANAGER.as_bytes(), &auction.start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
    )]
    pub orderbook_manager: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(owner = crate::ID)]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(owner = crate::ID)]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(owner = crate::ID)]
    pub ask_queue: UncheckedAccount<'info>,
}

