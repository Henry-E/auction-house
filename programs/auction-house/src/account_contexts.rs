use agnostic_orderbook::state::{EventQueue, EventQueueHeader, Side, EVENT_QUEUE_HEADER_LEN};
use anchor_lang::prelude::*;

use crate::account_data::*;
use crate::consts::*;
use crate::error::CustomErrors;

use agnostic_orderbook::orderbook::OrderBookState;

use anchor_spl::token::{Mint, Token, TokenAccount};

// // Flexible on design decisions such as:
// // - Using start time as part of the seeds to allow more than one auction
// //   per auctioneer account. Open to other suggestions on namespaces
// #[derive(Accounts)]
// #[instruction(args: InitAuctionArgs)]
// pub struct InitAuction<'info> {
//     #[account(mut)]
//     pub auctioneer: Signer<'info>,
//     // Program Accounts
//     // An account struct with all of the auction options
//     #[account(
//         init,
//         seeds = [AUCTION.as_bytes(), &args.start_time.to_le_bytes(), auctioneer.key().as_ref()],
//         bump,
//         space = 1000,
//         payer = auctioneer,
//     )]
//     pub auction: Box<Account<'info, Auction>>,
//     /// CHECK: This is a PDA
//     #[account(
//         init,
//         seeds = [MARKET_STATE.as_bytes(), &args.start_time.to_le_bytes(), auctioneer.key().as_ref()],
//         bump,
//         space = 1000,
//         payer = auctioneer,
//     )]
//     pub market_state: UncheckedAccount<'info>,
//     /// CHECK: This is zeroed and owned by the program
//     #[account(zero, owner = crate::ID)]
//     pub event_queue: UncheckedAccount<'info>,
//     /// CHECK: This is zeroed and owned by the program
//     #[account(zero, owner = crate::ID)]
//     pub bid_queue: UncheckedAccount<'info>,
//     /// CHECK: This is zeroed and owned by the program
//     #[account(zero, owner = crate::ID)]
//     pub ask_queue: UncheckedAccount<'info>,
//     // Token vaults
//     pub quote_mint: Account<'info, Mint>,
//     pub base_mint: Account<'info, Mint>,
//     #[account(
//         init,
//         token::mint = base_mint,
//         token::authority = auctioneer, // It should probably be the auction account, since it will sign
//         seeds = [QUOTE_VAULT.as_bytes(), &args.start_time.to_le_bytes(), auctioneer.key().as_ref()],
//         bump,
//         payer = auctioneer,
//     )]
//     pub quote_vault: Account<'info, TokenAccount>,
//     #[account(
//         init,
//         token::mint = base_mint,
//         token::authority = auctioneer, // It should probably be the auction account, since it will sign
//         seeds = [BASE_VAULT.as_bytes(), &args.start_time.to_le_bytes(), auctioneer.key().as_ref()],
//         bump,
//         payer = auctioneer,
//     )]
//     pub base_vault: Account<'info, TokenAccount>,
//     // Sysvars
//     pub rent: Sysvar<'info, Rent>,
//     // Programs
//     pub token_program: Program<'info, Token>,
//     pub system_program: Program<'info, System>,
// }

// impl InitAuction<'_> {
//     pub fn validate_args(args: InitAuctionArgs) -> Result<()> {
//         let clock = Clock::get()?;
//         // Let's not be too harsh about start times
//         if (args.start_time <= args.end_asks) | (args.start_bids <= args.end_bids) {
//             return Err(error!(CustomErrors::InvalidStartTimes));
//         }
//         if (args.end_asks <= clock.unix_timestamp) | (args.end_bids <= clock.unix_timestamp) {
//             return Err(error!(CustomErrors::InvalidEndTimes));
//         }
//         if args.min_base_order_size <= 0 {
//             return Err(error!(CustomErrors::InvalidMinBaseOrderSize));
//         }
//         if args.tick_size <= 0 {
//             return Err(error!(CustomErrors::InvalidTickSize));
//         }

//         Ok(())
//     }
// }

// // Flexible on design decisions such as:
// // should we check that the user has the associated token accounts that will
// // required later on when settling the auction
// #[derive(Accounts)]
// // #[instruction()]
// pub struct InitOpenOrders<'info> {
//     #[account(mut)]
//     pub user: Signer<'info>,
//     // Program accounts
//     #[account(
//         seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
//         bump = auction.bump,
//     )]
//     pub auction: Box<Account<'info, Auction>>,
//     #[account(
//         init,
//         seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
//         bump,
//         space = 500, // ??? We need quite a lot really with the encryption stuff
//         payer = user,
//     )]
//     pub open_orders: Box<Account<'info, OpenOrders>>,
//     #[account(
//         init,
//         seeds = [user.key().as_ref(), ORDER_HISTORY.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
//         bump,
//         space = 18,
//         payer = user,
//     )]
//     pub order_history: Account<'info, OrderHistory>,
//     // Token accounts
//     #[account(address = auction.quote_mint)]
//     pub quote_mint: Account<'info, Mint>,
//     #[account(address = auction.base_mint)]
//     pub base_mint: Account<'info, Mint>,
//     #[account(
//         associated_token::mint = quote_mint,
//         associated_token::authority = user,
//     )]
//     pub user_quote: Account<'info, TokenAccount>,
//     #[account(
//         associated_token::mint = base_mint,
//         associated_token::authority = user,
//     )]
//     pub user_base: Account<'info, TokenAccount>,
//     // Programs
//     pub system_program: Program<'info, System>,
// }

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

impl NewEncryptedOrder<'_> {
    pub fn access_control_new_encrypted_order(&self, public_key: &Vec<u8>) -> Result<()> {
        let clock = Clock::get()?;
        if (self.auction.end_asks < clock.unix_timestamp && self.open_orders.side == Side::Ask)
            || (self.auction.end_bids < clock.unix_timestamp && self.open_orders.side == Side::Bid)
        {
            return Err(error!(CustomErrors::BidOrAskOrdersAreFinished));
        }

        if (!self.auction.are_asks_encrypted && self.open_orders.side == Side::Ask)
            || (!self.auction.are_bids_encrypted && self.open_orders.side == Side::Bid)
        {
            return Err(error!(CustomErrors::UnencryptedOrdersOnlyOnThisSide));
        }

        if self.open_orders.num_orders == self.open_orders.max_orders {
            return Err(error!(CustomErrors::TooManyOrders));
        }

        if !self.open_orders.public_key.is_empty() && self.open_orders.public_key != *public_key {
            return Err(error!(CustomErrors::EncryptionPubkeysDoNotMatch));
        }
        Ok(())
    }

    pub fn access_control_cancel_encrypted_order(&self, order_idx: usize) -> Result<()> {
        let clock = Clock::get()?;
        // TODO
        // Add an access control that would allow encrypted orders to be cancelled after the decryption period
        if (self.auction.end_asks < clock.unix_timestamp && self.open_orders.side == Side::Ask)
            || (self.auction.end_bids < clock.unix_timestamp && self.open_orders.side == Side::Bid)
        {
            return Err(error!(CustomErrors::BidOrAskOrdersAreFinished));
        }

        if (!self.auction.are_asks_encrypted && self.open_orders.side == Side::Ask)
            || (!self.auction.are_bids_encrypted && self.open_orders.side == Side::Bid)
        {
            return Err(error!(CustomErrors::UnencryptedOrdersOnlyOnThisSide));
        }

        if self.open_orders.num_orders <= order_idx as u8 {
            return Err(error!(CustomErrors::OrderIdxNotValid));
        }

        Ok(())
    }
}

// #[derive(Accounts)]
// pub struct NewOrder<'info> {
//     pub user: Signer<'info>,
//     // Program Accounts
//     #[account(
//         seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
//         bump = auction.bump,
//     )]
//     pub auction: Box<Account<'info, Auction>>,
//     #[account(
//         seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
//         bump = open_orders.bump,
//         mut
//     )]
//     pub open_orders: Box<Account<'info, OpenOrders>>,
//     // AOB Accounts
//     #[account(
//         seeds = [MARKET_STATE.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
//         bump = auction.bumps.market_state,
//     )]
//     pub market_state: Account<'info, MarketState>,
//     /// CHECK: This should be owned by the program
//     #[account(
//         address = Pubkey::new_from_array(market_state.event_queue),
//         owner = crate::ID,
//         mut
//     )]
//     pub event_queue: UncheckedAccount<'info>,
//     /// CHECK: This should be owned by the program
//     #[account(
//         address = Pubkey::new_from_array(market_state.bids),
//         owner = crate::ID,
//         mut
//     )]
//     pub bid_queue: UncheckedAccount<'info>,
//     /// CHECK: This should be owned by the program
//     #[account(
//         address = Pubkey::new_from_array(market_state.asks),
//         owner = crate::ID,
//         mut
//     )]
//     pub ask_queue: UncheckedAccount<'info>,
//     // Token accounts
//     #[account(
//         constraint = user_token.owner == user.key(),
//         mut
//     )]
//     pub user_token: Account<'info, TokenAccount>,
//     #[account(
//         seeds = [QUOTE_VAULT.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
//         bump = auction.bumps.quote_vault,
//         mut
//     )]
//     pub quote_vault: Account<'info, TokenAccount>,
//     #[account(
//         seeds = [BASE_VAULT.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
//         bump = auction.bumps.base_vault,
//         mut
//     )]
//     pub base_vault: Account<'info, TokenAccount>,
//     // Programs
//     pub token_program: Program<'info, Token>,
// }

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
    #[account(
        seeds = [MARKET_STATE.as_bytes(), &auction.start_time.to_le_bytes(), auctioneer.key().as_ref()],
        bump = auction.bumps.market_state,
    )]
    pub market_state: Account<'info, MarketState>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.event_queue),
        owner = crate::ID,
        mut
    )]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.bids),
        owner = crate::ID,
        mut
    )]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.asks),
        owner = crate::ID,
        mut
    )]
    pub ask_queue: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CalculateClearingPrice<'info> {
    // Technically don't need the auctioneer to sign for this one
    // pub auctioneer: Signer<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
        mut
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [MARKET_STATE.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.market_state,
    )]
    pub market_state: Account<'info, MarketState>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.bids),
        owner = crate::ID,
    )]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.asks),
        owner = crate::ID,
    )]
    pub ask_queue: UncheckedAccount<'info>,
}

impl DecryptOrder<'_> {
    pub fn access_control(&self) -> Result<()> {
        // TODO
        // Add check that order time has finished
        // Add check that decryption time has not finished
        // Add check that this side of the order book allows encrypted orders

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }
}

#[derive(Accounts)]
pub struct MatchOrders<'info> {
    // Technically don't need the auctioneer to sign for this one
    // pub auctioneer: Signer<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
        mut
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [MARKET_STATE.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.market_state,
    )]
    pub market_state: Account<'info, MarketState>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.event_queue),
        owner = crate::ID,
        mut
    )]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.bids),
        owner = crate::ID,
        mut
    )]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.asks),
        owner = crate::ID,
        mut
    )]
    pub ask_queue: UncheckedAccount<'info>,
}

impl<'info> MatchOrders<'info> {
    /// Access Controls
    /// 1. Clearing price must have been found before matching can happen
    /// 2. There must be orders in the orderbook for matching to happen
    pub fn access_control(&self) -> Result<()> {
        if !self.auction.has_found_clearing_price {
            return Err(error!(CustomErrors::NoClearingPriceYet));
        }

        let orderbook = OrderBookState::new_safe(
            &self.bid_queue.to_account_info(),
            &self.ask_queue.to_account_info(),
            CALLBACK_INFO_LEN,
            CALLBACK_ID_LEN,
        )?;

        if orderbook.is_empty() {
            return Err(error!(CustomErrors::NoOrdersInOrderbook));
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ConsumeEvents<'info> {
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
        mut
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [MARKET_STATE.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.market_state,
    )]
    pub market_state: Account<'info, MarketState>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.event_queue),
        owner = crate::ID,
        mut
    )]
    pub event_queue: UncheckedAccount<'info>,
    // Plus a bunch of Open orders accounts in remaining accounts
}

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
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [user.key().as_ref(), OPEN_ORDERS.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = open_orders.bump,
        mut,
        close = user,
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    #[account(
        seeds = [user.key().as_ref(), ORDER_HISTORY.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = order_history.bump,
        mut
    )]
    pub order_history: Account<'info, OrderHistory>, // Persists after open_orders has closed
    // Token Accounts
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
    #[account(address = auction.quote_mint)]
    pub quote_mint: Account<'info, Mint>,
    #[account(address = auction.base_mint)]
    pub base_mint: Account<'info, Mint>,
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

#[derive(Accounts)]
pub struct CloseAobAccounts<'info> {
    // Technically doesn't need to be a signer for this function
    #[account(mut)]
    pub auctioneer: Signer<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bump,
        mut
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [MARKET_STATE.as_bytes(), &auction.start_time.to_le_bytes(), auction.authority.as_ref()],
        bump = auction.bumps.market_state,
        mut,
    )]
    pub market_state: Account<'info, MarketState>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.event_queue),
        owner = crate::ID,
        mut
    )]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.bids),
        owner = crate::ID,
        mut
    )]
    pub bid_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = Pubkey::new_from_array(market_state.asks),
        owner = crate::ID,
        mut
    )]
    pub ask_queue: UncheckedAccount<'info>,
}

impl CloseAobAccounts<'_> {
    pub fn access_control(&self) -> Result<()> {
        if !self.auction.has_found_clearing_price {
            return Err(error!(CustomErrors::NoClearingPriceYet));
        }

        let order_book = OrderBookState::new_safe(
            &self.bid_queue.to_account_info(),
            &self.ask_queue.to_account_info(),
            CALLBACK_INFO_LEN,
            CALLBACK_ID_LEN,
        )?;
        if !order_book.is_empty() {
            return Err(error!(CustomErrors::OrderBookNotEmpty));
        }

        let event_queue_header = {
            let mut event_queue_data: &[u8] =
                &self.event_queue.data.borrow()[0..EVENT_QUEUE_HEADER_LEN];
            EventQueueHeader::deserialize(&mut event_queue_data)
                .unwrap()
                .check()?
        };
        if event_queue_header.count > 0 {
            return Err(error!(CustomErrors::EventQueueNotEmpty));
        }

        Ok(())
    }
}
