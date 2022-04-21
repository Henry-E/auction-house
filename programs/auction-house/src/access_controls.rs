use anchor_lang::prelude::*;

use crate::{account_data::*, error::CustomErrors};

use agnostic_orderbook::state::Side;

pub fn is_order_phase_active(clock: Clock, auction: Auction) -> Result<()> {
    if auction.start_order_phase < clock.unix_timestamp {
        return Err(error!(CustomErrors::OrderPhaseHasNotStarted));
    }
    if auction.end_order_phase < clock.unix_timestamp {
        return Err(error!(CustomErrors::OrderPhaseIsOver));
    }
    Ok(())
}

pub fn normal_orders_only(auction: Auction, open_orders: OpenOrders) -> Result<()> {
    if (auction.are_asks_encrypted && open_orders.side == Side::Ask)
        || (auction.are_bids_encrypted && open_orders.side == Side::Bid)
    {
        return Err(error!(CustomErrors::EncryptedOrdersOnlyOnThisSide));
    }
    Ok(())
}

pub fn encrypted_orders_only(auction: Auction, open_orders: OpenOrders) -> Result<()> {
    if (!auction.are_asks_encrypted && open_orders.side == Side::Ask)
        || (!auction.are_bids_encrypted && open_orders.side == Side::Bid)
    {
        return Err(error!(CustomErrors::UnencryptedOrdersOnlyOnThisSide));
    }
    Ok(())
}

pub fn has_space_for_new_orders(open_orders: OpenOrders) -> Result<()> {
    if open_orders.num_orders == open_orders.max_orders {
        return Err(error!(CustomErrors::TooManyOrders));
    }
    Ok(())
}