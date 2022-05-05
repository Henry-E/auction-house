use agnostic_orderbook::state::Side as AobSide;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
pub enum Side {
    Bid,
    Ask,
}

impl From<Side> for AobSide {
    fn from(side: Side) -> AobSide {
        match side {
            Side::Bid => AobSide::Bid,
            Side::Ask => AobSide::Ask,
        }
    }
}

impl Default for Side {
    fn default() -> Self {
        Side::Bid
    }
}
