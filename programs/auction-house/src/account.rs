use anchor_lang::prelude::*;

#[account]
// #[derive(Default)] TODO there's an error with having a default enum value
pub struct Auction {
    // General auction options
    pub bump: u8,
    pub auctioneer: Pubkey,
    pub start_time: i64,
    pub end_asks: i64,
    pub start_bids: i64,
    pub end_bids: i64,
    pub are_asks_encrypted: bool,
    pub are_bids_encrypted: bool,
    pub final_price_type: FinalPriceTypes,
    // AOB related options
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