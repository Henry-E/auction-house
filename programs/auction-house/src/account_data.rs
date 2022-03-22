use anchor_lang::prelude::*;

#[account]
// #[derive(Default)] TODO there's an error with having a default enum value
pub struct Auction {
    // General auction options
    pub bump: u8,
    pub authority: Pubkey,
    pub start_time: i64,
    pub end_asks: i64,
    pub start_bids: i64,
    pub end_bids: i64,
    pub are_asks_encrypted: bool,
    pub are_bids_encrypted: bool,
    pub final_price_type: FinalPriceTypes,
    // AOB related options
    // TODO: The public key of the vaults
    // TODO: the base mint and quote mint
    pub quote_mint: Pubkey,
    pub base_mint: Pubkey,
    pub quote_vault: Pubkey,
    pub base_vault: Pubkey,

    // TODO double check what options serum v4 uses
    pub base_token_lots: u64,
    pub quote_token_lots: u64,
    pub min_base_token_quantity: u64,
    // Intermediate information while matching the orderbook
    pub current_ask_key: u128,
    pub current_bid_key: u128,
    pub quantity_filled_in_this_bid: u64,
    pub quantity_filled_in_this_ask: u64,
    pub total_quantity_filled_so_far: u64,
    // Details once the auction clearing price has been found
    pub has_found_clearing_price: bool,
    pub total_quantity_matched: u64,
    pub final_ask_price: u64,
    pub final_bid_price: u64,
    pub clearing_price: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum FinalPriceTypes {
    BestBid,
    Midpoint,
}

#[account]
pub struct OpenOrders {
    pub bump: u8,
    pub authority: Pubkey,
    pub is_bids_account: bool,
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EncryptedOrder {
    pub nonce: Vec<u8>,
    pub cipher_text: Vec<u8>,
}

#[account]
pub struct OrderHistory {
    pub bump: u8,
    pub is_bids_account: bool,
    pub quote_amount_returned: u64,
    pub base_amount_returned: u64,
}