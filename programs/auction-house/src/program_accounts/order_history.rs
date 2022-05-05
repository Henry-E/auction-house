use anchor_lang::prelude::*;

use crate::types::*;

#[account]
pub struct OrderHistory {
    pub bump: u8,
    pub auction: Pubkey,
    pub side: Side,
    pub quote_amount_returned: u64,
    pub base_amount_returned: u64,
}
