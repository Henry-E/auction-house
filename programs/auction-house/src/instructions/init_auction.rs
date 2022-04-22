use anchor_lang::prelude::*;

use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::account_data::*;
use crate::consts::*;
use crate::error::CustomErrors;

use agnostic_orderbook::critbit::Slab;
use agnostic_orderbook::state::{AccountTag, EventQueueHeader, MarketState};

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
        seeds = [AUCTION.as_bytes(), &args.start_order_phase.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        space = 1000,
        payer = auctioneer,
    )]
    pub auction: Box<Account<'info, Auction>>,
    /// CHECK: This is a PDA   
    #[account(
        init,
        seeds = [MARKET_STATE.as_bytes(), &args.start_order_phase.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        space = 1000,
        payer = auctioneer,
    )]
    pub market_state: UncheckedAccount<'info>,
    /// CHECK: This is zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This is zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This is zeroed and owned by the program
    #[account(zero, owner = crate::ID)]
    pub ask_queue: UncheckedAccount<'info>,
    // Token vaults
    pub quote_mint: Account<'info, Mint>,
    pub base_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = base_mint,
        token::authority = auctioneer, // It should probably be the auction account, since it will sign
        seeds = [QUOTE_VAULT.as_bytes(), &args.start_order_phase.to_le_bytes(), auctioneer.key().as_ref()],
        bump,
        payer = auctioneer,
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        token::mint = base_mint,
        token::authority = auctioneer, // It should probably be the auction account, since it will sign
        seeds = [BASE_VAULT.as_bytes(), &args.start_order_phase.to_le_bytes(), auctioneer.key().as_ref()],
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
    pub fn validate_args(args: InitAuctionArgs) -> Result<()> {
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
        if args.min_base_order_size <= 0 {
            return Err(error!(CustomErrors::InvalidMinBaseOrderSize));
        }
        if args.tick_size <= 0 {
            return Err(error!(CustomErrors::InvalidTickSize));
        }

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct InitAuctionArgs {
    pub start_order_phase: i64,
    pub end_order_phase: i64,
    pub end_decryption_phase: i64,
    pub are_asks_encrypted: bool,
    pub are_bids_encrypted: bool,
    pub min_base_order_size: u64,
    pub tick_size: u64,
}

///
pub fn init_auction(ctx: Context<InitAuction>, args: InitAuctionArgs) -> Result<()> {
    ctx.accounts.auction.set_inner(Auction {
        bump: *ctx.bumps.get("auction").unwrap(),
        bumps: AobBumps {
            quote_vault: *ctx.bumps.get("quote_vault").unwrap(),
            base_vault: *ctx.bumps.get("base_vault").unwrap(),
            market_state: *ctx.bumps.get("market_state").unwrap(),
        },
        start_order_phase: args.start_order_phase,
        end_order_phase: args.end_order_phase,
        end_decryption_phase: args.end_decryption_phase,
        are_asks_encrypted: args.are_asks_encrypted,
        are_bids_encrypted: args.are_bids_encrypted,
        //
        quote_mint: ctx.accounts.quote_mint.key(),
        base_mint: ctx.accounts.base_mint.key(),
        quote_vault: ctx.accounts.quote_vault.key(),
        base_vault: ctx.accounts.base_vault.key(),
        min_base_order_size: args.min_base_order_size,
        tick_size: args.tick_size,
        // Everything else defaults to 0
        ..(*ctx.accounts.auction).clone().into_inner()
    });

    // Init market_state
    let mut market_state = MarketState::get_unchecked(&ctx.accounts.market_state);

    *market_state = MarketState {
        tag: AccountTag::Market as u64,
        caller_authority: [0u8; 32],
        event_queue: ctx.accounts.event_queue.key().to_bytes(),
        bids: ctx.accounts.bid_queue.key().to_bytes(),
        asks: ctx.accounts.ask_queue.key().to_bytes(),
        callback_info_len: CALLBACK_INFO_LEN as u64,
        callback_id_len: CALLBACK_ID_LEN as u64,
        fee_budget: 0,
        initial_lamports: ctx.accounts.market_state.lamports(),
        min_base_order_size: args.min_base_order_size,
        tick_size: args.tick_size,
        cranker_reward: 0,
    };

    // Init event queue
    let event_queue_header = EventQueueHeader::initialize(CALLBACK_INFO_LEN);
    event_queue_header
        .serialize(&mut (&mut ctx.accounts.event_queue.data.borrow_mut() as &mut [u8]))
        .unwrap();

    // Init orderbook
    Slab::initialize(
        &ctx.accounts.bid_queue,
        &ctx.accounts.ask_queue,
        ctx.accounts.market_state.key(),
        CALLBACK_INFO_LEN,
    );

    Ok(())
}
