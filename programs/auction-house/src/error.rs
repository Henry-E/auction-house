use anchor_lang::prelude::*;

#[error_code]
pub enum CustomErrors {
    #[msg("Function not yet implemented")]
    NotImplemented, // 6000
    #[msg("Invalid account data on AOB market state")]
    InvalidAobMarketState, // 6001
}