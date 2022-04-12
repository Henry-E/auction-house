use anchor_lang::prelude::*;

#[error_code]
pub enum CustomErrors {
    #[msg("Function not yet implemented")]
    NotImplemented, // 6000
    #[msg("Invalid account data on AOB market state")]
    InvalidAobMarketState, // 6001
    #[msg("bids and asks order periods should end in the future")]
    InvalidEndTimes,
    #[msg("bids and asks periods should start before they end")]
    InvalidStartTimes,
    #[msg("Min base order size should be greater than zero")]
    InvalidMinBaseOrderSize,
    #[msg("Tick size should be greater than zero")]
    InvalidTickSize,
    #[msg("No ask orders")]
    NoAskOrders,
    #[msg("No bid orders")]
    NoBidOrders,
}
