use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitAuctionArgs {
    pub auction_id: [u8; 10],
    pub start_order_phase: i64,
    pub end_order_phase: i64,
    pub end_decryption_phase: i64,
    pub are_asks_encrypted: bool,
    pub are_bids_encrypted: bool,
    pub nacl_pubkey: Vec<u8>, // 32 bytes
    pub min_base_order_size: u64,
    pub tick_size: u64,
}
