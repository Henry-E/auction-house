use anchor_lang::prelude::*;

use crate::{account_data::*, error::CustomErrors};

use agnostic_orderbook::{
    orderbook::OrderBookState,
    state::{EventQueueHeader, Side as AobSide},
};

pub fn is_order_phase_active(clock: Clock, auction: &Auction) -> bool {
    if clock.unix_timestamp < auction.start_order_phase {
        // return Err(error!(CustomErrors::OrderPhaseHasNotStarted));
        return false;
    }
    if auction.end_order_phase < clock.unix_timestamp {
        // return Err(error!(CustomErrors::OrderPhaseIsOver));
        return false;
    }
    true
}

pub fn is_decryption_phase_active(clock: Clock, auction: &Auction) -> bool {
    if clock.unix_timestamp < auction.end_order_phase {
        // return Err(error!(CustomErrors::DecryptionPhaseHasNotStarted));
        return false;
    }
    if auction.end_decryption_phase < clock.unix_timestamp {
        // return Err(error!(CustomErrors::DecryptionPhaseHasEnded));
        return false;
    }
    true
}

pub fn is_calc_clearing_price_phase_active(clock: Clock, auction: &Auction) -> bool {
    if clock.unix_timestamp < auction.end_decryption_phase {
        return false;
    }
    if auction.has_found_clearing_price {
        return false;
    }
    true
}

pub fn is_match_orders_phase_active(auction: &Auction, order_book: &OrderBookState) -> bool {
    if !auction.has_found_clearing_price {
        return false;
    }
    if order_book.is_empty() {
        return false;
    }
    true
}

pub fn is_auction_over(
    auction: &Auction,
    order_book: &OrderBookState,
    event_queue_header: &EventQueueHeader,
) -> bool {
    if !auction.has_found_clearing_price {
        return false;
    }
    if !order_book.is_empty() {
        return false;
    }
    if event_queue_header.count > 0 {
        return false;
    }
    true
}

pub fn validate_price_and_qty(
    auction: &Auction,
    limit_price: u64,
    max_base_qty: u64,
) -> Result<()> {
    // TODO need to fix this later because the modulo maths calculation is
    // incorrect
    if limit_price % auction.tick_size != 0 {
        msg!("limit {}, tick {}", limit_price, auction.tick_size);
        return Err(error!(CustomErrors::LimitPriceNotAMultipleOfTickSize));
    }
    if max_base_qty < auction.min_base_order_size {
        return Err(error!(CustomErrors::OrderBelowMinBaseOrderSize));
    }
    Ok(())
}

pub fn normal_orders_only(auction: &Auction, open_orders: &OpenOrders) -> Result<()> {
    if (auction.are_asks_encrypted && open_orders.side == Side::Ask)
        || (auction.are_bids_encrypted && open_orders.side == Side::Bid)
    {
        return Err(error!(CustomErrors::EncryptedOrdersOnlyOnThisSide));
    }
    Ok(())
}

pub fn encrypted_orders_only(auction: &Auction, open_orders: &OpenOrders) -> Result<()> {
    if (!auction.are_asks_encrypted && open_orders.side == Side::Ask)
        || (!auction.are_bids_encrypted && open_orders.side == Side::Bid)
    {
        return Err(error!(CustomErrors::UnencryptedOrdersOnlyOnThisSide));
    }
    Ok(())
}

pub fn has_space_for_new_orders(open_orders: &OpenOrders) -> Result<()> {
    if open_orders.num_orders == open_orders.max_orders {
        return Err(error!(CustomErrors::TooManyOrders));
    }
    Ok(())
}
