use anchor_lang::prelude::*;

use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::consts::*;
use crate::error::CustomErrors;
use crate::program_accounts::*;
use crate::types::*;

use agnostic_orderbook::critbit::Slab;
use agnostic_orderbook::state::EventQueueHeader;

// Flexible on design decisions such as:
// - Using start time as part of the seeds to allow more than one auction
//   per auctioneer account. Open to other suggestions on namespaces
#[derive(Accounts)]
#[instruction(args: InitAuctionArgs)]
pub struct InitAuction<'info> {
    #[account(mut)]
    pub auctioneer: Signer<'info>,
    // Program Accounts
    // An account struct with all of the auction options
    #[account(
        init,
        seeds = [AUCTION.as_bytes(), &args.auction_id, auctioneer.key().as_ref()],
        bump,
        space = 1000,
        payer = auctioneer,
    )]
    pub auction: Box<Account<'info, Auction>>,
    /// CHECK: This is zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This is zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub bids: UncheckedAccount<'info>,
    /// CHECK: This is zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub asks: UncheckedAccount<'info>,
    // Token vaults
    pub quote_mint: Account<'info, Mint>,
    pub base_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = quote_mint,
        token::authority = auction, // It should probably be the auction account, since it will sign
        seeds = [QUOTE_VAULT.as_bytes(), &args.auction_id, auctioneer.key().as_ref()],
        bump,
        payer = auctioneer,
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        token::mint = base_mint,
        token::authority = auction, // It should probably be the auction account, since it will sign
        seeds = [BASE_VAULT.as_bytes(), &args.auction_id, auctioneer.key().as_ref()],
        bump,
        payer = auctioneer,
    )]
    pub base_vault: Account<'info, TokenAccount>,
    // Sysvars
    pub rent: Sysvar<'info, Rent>,
    // Programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl InitAuction<'_> {
    pub fn validate_args(&self, args: &InitAuctionArgs) -> Result<()> {
        let clock = Clock::get()?;
        // Orders phase ends before it starts
        if args.end_order_phase <= args.start_order_phase {
            return Err(error!(CustomErrors::InvalidStartTimes));
        }
        // Orders phase should end in the future
        if args.end_order_phase <= clock.unix_timestamp {
            return Err(error!(CustomErrors::InvalidEndTimes));
        }
        // Decryption phase should end at or after the end of the order phase
        if args.end_decryption_phase < args.end_order_phase {
            return Err(error!(CustomErrors::InvalidDecryptionEndTime));
        }
        if args.min_base_order_size == 0 {
            return Err(error!(CustomErrors::InvalidMinBaseOrderSize));
        }
        if args.tick_size == 0 {
            return Err(error!(CustomErrors::InvalidTickSize));
        }

        if self.quote_mint.decimals != self.base_mint.decimals {
            return Err(error!(CustomErrors::IncompatibleMintDecimals));
        }

        Ok(())
    }
}

///
pub fn init_auction(ctx: Context<InitAuction>, args: &InitAuctionArgs) -> Result<()> {
    ctx.accounts.auction.set_inner(Auction {
        bump: *ctx.bumps.get("auction").unwrap(),
        bumps: AobBumps {
            quote_vault: *ctx.bumps.get("quote_vault").unwrap(),
            base_vault: *ctx.bumps.get("base_vault").unwrap(),
        },
        authority: ctx.accounts.auctioneer.key(),
        auction_id: args.auction_id,
        start_order_phase: args.start_order_phase,
        end_order_phase: args.end_order_phase,
        end_decryption_phase: args.end_decryption_phase,
        are_asks_encrypted: args.are_asks_encrypted,
        are_bids_encrypted: args.are_bids_encrypted,
        nacl_pubkey: args.nacl_pubkey.clone(),
        // Order book stuff
        event_queue: ctx.accounts.event_queue.key(),
        bids: ctx.accounts.bids.key(),
        asks: ctx.accounts.asks.key(),
        quote_mint: ctx.accounts.quote_mint.key(),
        base_mint: ctx.accounts.base_mint.key(),
        quote_vault: ctx.accounts.quote_vault.key(),
        base_vault: ctx.accounts.base_vault.key(),
        min_base_order_size: args.min_base_order_size,
        tick_size: args.tick_size,
        // Everything else defaults to 0
        current_bid_key: 0,
        current_ask_key: 0,
        current_bid_quantity_filled: 0,
        current_ask_quantity_filled: 0,
        total_quantity_filled_so_far: 0,
        has_found_clearing_price: false,
        total_quantity_matched: 0,
        remaining_bid_fills: 0,
        remaining_ask_fills: 0,
        final_bid_price: 0,
        final_ask_price: 0,
        clearing_price: 0,
        ask_search_stack_depth: 0,
        ask_search_stack_values: [0; 32],
        bid_search_stack_depth: 0,
        bid_search_stack_values: [0; 32],
    });

    // Init event queue
    let event_queue_header = EventQueueHeader::initialize(CALLBACK_INFO_LEN);
    event_queue_header
        .serialize(&mut (&mut ctx.accounts.event_queue.data.borrow_mut() as &mut [u8]))
        .unwrap();

    // Init orderbook
    Slab::initialize(
        &ctx.accounts.bids,
        &ctx.accounts.asks,
        ctx.accounts.auction.key(),
        CALLBACK_INFO_LEN,
    );

    Ok(())
}
