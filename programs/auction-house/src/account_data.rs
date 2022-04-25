use anchor_lang::prelude::*;

use bytemuck::try_from_bytes;

use std::ops::Deref;

// use agnostic_orderbook;
use agnostic_orderbook::processor::new_order::Params;
use agnostic_orderbook::state::{SelfTradeBehavior, Side};

use crate::error::CustomErrors;

#[account]
#[derive(Default)]
pub struct Auction {
    // General auction options
    pub bump: u8,
    pub bumps: AobBumps,
    pub authority: Pubkey,
    pub start_order_phase: i64,
    pub end_order_phase: i64,
    pub end_decryption_phase: i64,
    pub are_asks_encrypted: bool,
    pub are_bids_encrypted: bool,
    // pub final_price_type: FinalPriceTypes,
    // Orderbook details
    pub event_queue: Pubkey,
    pub bids: Pubkey,
    pub asks: Pubkey,
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

#[macro_export]
macro_rules! auction_seeds {
    ( $auction:expr ) => {
        &[
            AUCTION.as_bytes(),
            &$auction.start_order_phase.to_le_bytes(),
            $auction.authority.as_ref(),
            &[$auction.bump],
        ]
    };
}

pub use auction_seeds;

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
}

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

    pub fn new_order_params(
        &self,
        limit_price: u64,
        max_base_qty: u64,
        max_quote_qty: u64,
    ) -> Params {
        Params {
            max_base_qty,
            max_quote_qty,
            limit_price,
            side: self.side,
            callback_info: Vec::new(),
            post_only: true,
            post_allowed: true,
            // self trade behaviour is ignored, this is a vestigial argument
            self_trade_behavior: agnostic_orderbook::state::SelfTradeBehavior::DecrementTake,
            match_limit: 1,
        }
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
