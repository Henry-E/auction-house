use anchor_lang::prelude::*;

use agnostic_orderbook::processor::new_order::Params;
use agnostic_orderbook::state::{SelfTradeBehavior, Side as AobSide};

use crate::error::CustomErrors;
use crate::types::*;

#[account]
#[derive(Default, Debug)]
pub struct OpenOrders {
    pub bump: u8,
    pub authority: Pubkey,
    pub this_open_orders: Pubkey,
    pub auction: Pubkey,
    // TODO: I don't think we need a max num orders param
    // or to track it, because the program should error if too much
    // data is accessed or written to.
    pub max_orders: u8,
    // TODO replace with a Side enum possibly
    pub side: Side,
    // Encryption stuff
    pub nacl_pubkey: Vec<u8>,
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
    pub fn find_order_index(&self, order_id: &u128) -> Result<usize> {
        let idx = self
            .orders
            .iter()
            .position(|this_order| this_order == order_id)
            .ok_or_else(|| error!(CustomErrors::OrderIdNotFound))?;
        Ok(idx)
    }

    pub fn new_order_params(
        &self,
        limit_price: u64,
        max_base_qty: u64,
        // max_quote_qty: u64,
    ) -> Params {
        Params {
            max_base_qty,
            max_quote_qty: u64::MAX,
            limit_price,
            side: AobSide::from(self.side),
            callback_info: self.this_open_orders.to_bytes().to_vec(),
            post_only: true,
            post_allowed: true,
            // self trade behaviour is ignored, this is a vestigial argument
            self_trade_behavior: SelfTradeBehavior::AbortTransaction,
            match_limit: 1,
        }
    }
}
