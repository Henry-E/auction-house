use anchor_lang::prelude::*;

use bytemuck::try_from_bytes;

use std::ops::Deref;

// use agnostic_orderbook;
use agnostic_orderbook::state::{SelfTradeBehavior, Side};

use crate::error::CustomErrors;

#[account]
#[derive(Default)]
pub struct Auction {
    // General auction options
    pub bump: u8,
    pub bumps: AobBumps,
    pub authority: Pubkey,
    pub start_time: i64,
    pub end_asks: i64,
    pub start_bids: i64,
    pub end_bids: i64,
    pub end_decryption_phase: i64,
    pub are_asks_encrypted: bool,
    pub are_bids_encrypted: bool,
    // pub final_price_type: FinalPriceTypes,
    // Orderbook details
    pub quote_mint: Pubkey,
    pub base_mint: Pubkey,
    pub quote_vault: Pubkey,
    pub base_vault: Pubkey,
    pub min_base_order_size: u64,
    pub tick_size: u64,
    // Intermediate information while matching the orderbook
    pub current_bid_key: u128,
    pub current_ask_key: u128,
    pub current_bid_quantity_filled: u64,
    pub current_ask_quantity_filled: u64,
    pub total_quantity_filled_so_far: u64,
    // Details once the auction clearing price has been found
    pub has_found_clearing_price: bool,
    pub total_quantity_matched: u64,
    pub remaining_ask_fills: u64,
    pub remaining_bid_fills: u64,
    pub final_bid_price: u64,
    pub final_ask_price: u64,
    pub clearing_price: u64,
}

// #[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
// pub enum FinalPriceTypes {
//     BestBid,
//     Midpoint,
// }

// impl Default for FinalPriceTypes {
//     fn default() -> Self { FinalPriceTypes::BestBid }
// }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct AobBumps {
    pub quote_vault: u8,
    pub base_vault: u8,
    pub market_state: u8,
}

// #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
// pub struct InitAuctionArgs {
//     pub start_time: i64,
//     pub end_asks: i64,
//     pub start_bids: i64,
//     pub end_bids: i64,
//     pub min_base_order_size: u64,
//     pub tick_size: u64,
// }

#[account]
#[derive(Default)]
pub struct OpenOrders {
    pub bump: u8,
    pub authority: Pubkey,
    // TODO: I don't think we need a max num orders param
    // or to track it, because the program should error if too much
    // data is accessed or written to.
    pub max_orders: u8,
    // TODO replace with a Side enum possibly
    pub side: Side,
    // Encryption stuff
    pub public_key: Vec<u8>,
    pub encrypted_orders: Vec<EncryptedOrder>, // Probably max 4 - 8 orders
    // AOB stuff
    pub quote_token_locked: u64,
    pub quote_token_free: u64,
    pub base_token_locked: u64,
    pub base_token_free: u64,
    pub num_orders: u8,
    pub orders: Vec<u128>,
}

impl OpenOrders {
    pub fn find_order_index(&self, order_id: u128) -> Result<(usize)> {
        let idx = self
            .orders
            .iter()
            .enumerate()
            .find(|(_, this_order)| **this_order == order_id)
            .ok_or(error!(CustomErrors::OrderIdNotFound))?
            .0;
        Ok(idx)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EncryptedOrder {
    pub nonce: Vec<u8>,
    pub cipher_text: Vec<u8>,
    pub token_qty: u64,
}

#[account]
pub struct OrderHistory {
    pub bump: u8,
    pub side: Side,
    pub quote_amount_returned: u64,
    pub base_amount_returned: u64,
}

#[derive(Clone)]
pub struct MarketState(agnostic_orderbook::state::MarketState);

impl MarketState {
    pub const LEN: usize = agnostic_orderbook::state::MARKET_STATE_LEN;
}

impl anchor_lang::AccountDeserialize for MarketState {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
        let this = try_from_bytes::<agnostic_orderbook::state::MarketState>(buf).unwrap();
        let market = Self(*this);
        if market.tag != agnostic_orderbook::state::AccountTag::Market as u64 {
            return Err(error!(CustomErrors::InvalidAobMarketState));
        };
        Ok(market)
    }
}

impl anchor_lang::AccountSerialize for MarketState {}

impl anchor_lang::Owner for MarketState {
    fn owner() -> Pubkey {
        crate::ID
    }
}

impl Deref for MarketState {
    type Target = agnostic_orderbook::state::MarketState;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
