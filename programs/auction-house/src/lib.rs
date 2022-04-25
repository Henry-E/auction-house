use anchor_lang::prelude::*;
use anchor_spl::token;

use agnostic_orderbook::critbit::LeafNode;
use agnostic_orderbook::orderbook::OrderBookState;
use agnostic_orderbook::processor::new_order::Params;
use agnostic_orderbook::state::{
    get_side_from_order_id, Event, EventQueue, EventQueueHeader, Side, EVENT_QUEUE_HEADER_LEN,
};
use agnostic_orderbook::utils::{fp32_div, fp32_mul};

use xsalsa20poly1305::{
    aead::{Aead, NewAead},
    Nonce, XSalsa20Poly1305,
};

use std::cmp;
use std::convert::TryInto;

use access_controls::*;
use account_contexts::*;
use account_data::*;
use consts::*;
use error::*;
use instructions::*;

mod access_controls;
mod account_contexts;
mod account_data;
mod consts;
mod error;
mod instructions;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod auction_house {

    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        let this = Side::Ask;
        match this {
            Side::Bid => {
                msg!("hey it's a bid");
            }
            Side::Ask => {
                msg!("hey it's an ask");
            }
        }
        Ok(())
    }

    #[access_control(InitAuction::validate_args(args))]
    pub fn init_auction(ctx: Context<InitAuction>, args: InitAuctionArgs) -> Result<()> {
        instructions::init_auction(ctx, args)
    }

    #[access_control(ctx.accounts.access_control(max_orders))]
    pub fn init_open_orders(
        ctx: Context<InitOpenOrders>,
        side: Side,
        max_orders: u8,
    ) -> Result<()> {
        instructions::init_open_orders(ctx, side, max_orders)
    }

    #[access_control(ctx.accounts.access_control_new_order(limit_price, max_base_qty))]
    pub fn new_order(ctx: Context<NewOrder>, limit_price: u64, max_base_qty: u64) -> Result<()> {
        instructions::new_order(ctx, limit_price, max_base_qty)?;

        Err(error!(CustomErrors::NotImplemented))

        // TODO
        // Add the token transfer CPI calls
    }

    #[access_control(ctx.accounts.access_control_cancel_order(order_id))]
    pub fn cancel_order(ctx: Context<NewOrder>, order_id: u128) -> Result<()> {
        // TODO
        // Move this to its own function & file when we're on a bigger monitor

        let mut order_book = OrderBookState::new_safe(
            &ctx.accounts.bids.to_account_info(),
            &ctx.accounts.asks.to_account_info(),
            CALLBACK_INFO_LEN,
            CALLBACK_ID_LEN,
        )?;
        let slab = order_book.get_tree(get_side_from_order_id(order_id));
        let (node, _) = slab
            .remove_by_key(order_id)
            .ok_or(error!(CustomErrors::OrderIdNotFound))?;
        let leaf_node = node.as_leaf().unwrap();
        let total_base_qty = leaf_node.base_quantity;
        let total_quote_qty = fp32_mul(leaf_node.base_quantity, leaf_node.price());
        order_book.commit_changes();

        let open_orders = &mut *ctx.accounts.open_orders;
        let order_idx = open_orders.find_order_index(order_id)?;
        open_orders.orders.remove(order_idx);
        open_orders.num_orders = open_orders.num_orders.checked_sub(1).unwrap();

        match open_orders.side {
            Side::Ask => {
                open_orders.base_token_locked = open_orders
                    .base_token_locked
                    .checked_sub(total_base_qty)
                    .unwrap();
                token::transfer(
                    ctx.accounts
                        .transfer_base_vault()
                        .with_signer(&[auction_seeds!(ctx.accounts.auction)]),
                    total_base_qty,
                )?;
            }
            Side::Bid => {
                open_orders.quote_token_locked = open_orders
                    .quote_token_locked
                    .checked_sub(total_quote_qty)
                    .unwrap();
                token::transfer(
                    ctx.accounts
                        .transfer_quote_vault()
                        .with_signer(&[auction_seeds!(ctx.accounts.auction)]),
                    total_quote_qty,
                )?;
            }
        }

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    #[access_control(ctx.accounts.access_control_new_encrypted_order(&public_key))]
    pub fn new_encrypted_order(
        ctx: Context<NewEncryptedOrder>,
        token_qty: u64,
        public_key: Vec<u8>,
        nonce: Vec<u8>,
        cipher_text: Vec<u8>,
    ) -> Result<()> {
        let open_orders = &mut *ctx.accounts.open_orders;
        if open_orders.public_key.is_empty() {
            open_orders.public_key = public_key;
        }
        // TODO move to access control probably, not sure about reference stuff for the vars nonce and cipher text
        if open_orders
            .encrypted_orders
            .iter()
            .any(|order| order.nonce == nonce && order.cipher_text == cipher_text)
        {
            return Err(error!(CustomErrors::IdenticalEncryptedOrderFound));
        }
        let this_order = EncryptedOrder {
            nonce,
            cipher_text,
            token_qty,
        };
        open_orders.encrypted_orders.push(this_order);
        open_orders.num_orders += 1;

        match open_orders.side {
            Side::Ask => {
                open_orders.base_token_locked = open_orders
                    .base_token_locked
                    .checked_add(token_qty)
                    .unwrap();
                token::transfer(
                    ctx.accounts.transfer_user_base(),
                    token_qty,
                )?;
            }
            Side::Bid => {
                open_orders.quote_token_locked = open_orders
                    .quote_token_locked
                    .checked_add(token_qty)
                    .unwrap();
                token::transfer(
                    ctx.accounts.transfer_user_quote(),
                    token_qty,
                )?;
            }
        }

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    #[access_control(ctx.accounts.access_control_cancel_encrypted_order(order_idx))]
    pub fn cancel_encrypted_order(ctx: Context<NewEncryptedOrder>, order_idx: u8) -> Result<()> {
        let open_orders = &mut *ctx.accounts.open_orders;
        let this_order = open_orders.encrypted_orders.remove(order_idx as usize);
        open_orders.num_orders = open_orders.num_orders.checked_sub(1).unwrap();

        match open_orders.side {
            Side::Ask => {
                open_orders.base_token_locked = open_orders
                    .base_token_locked
                    .checked_sub(this_order.token_qty)
                    .unwrap();
                token::transfer(
                    ctx.accounts
                        .transfer_base_vault()
                        .with_signer(&[auction_seeds!(ctx.accounts.auction)]),
                        this_order.token_qty,
                )?;
            }
            Side::Bid => {
                open_orders.quote_token_locked = open_orders
                    .quote_token_locked
                    .checked_sub(this_order.token_qty)
                    .unwrap();
                token::transfer(
                    ctx.accounts
                        .transfer_quote_vault()
                        .with_signer(&[auction_seeds!(ctx.accounts.auction)]),
                        this_order.token_qty,
                )?;
            }
        }

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn decrypt_order(ctx: Context<DecryptOrder>, secret_key: Vec<u8>) -> Result<()> {
        // Load up all the AOB accounts
        let mut order_book = OrderBookState::new_safe(
            &ctx.accounts.bids.to_account_info(),
            &ctx.accounts.asks.to_account_info(),
            CALLBACK_INFO_LEN,
            CALLBACK_ID_LEN,
        )?;
        let header = {
            let mut event_queue_data: &[u8] =
                &ctx.accounts.event_queue.data.borrow()[0..EVENT_QUEUE_HEADER_LEN];
            EventQueueHeader::deserialize(&mut event_queue_data)
                .unwrap()
                .check()?
        };
        let mut event_queue = EventQueue::new_safe(
            header,
            &ctx.accounts.event_queue.to_account_info(),
            CALLBACK_INFO_LEN,
        )?;

        let key = xsalsa20poly1305::Key::from_slice(secret_key.as_slice());
        let cypher = XSalsa20Poly1305::new(key);

        let open_orders = &mut *ctx.accounts.open_orders;
        for encrypted_order in open_orders.encrypted_orders.clone().iter() {
            let nonce = Nonce::from_slice(encrypted_order.nonce.as_slice());
            // TODO Make sure that we're encrypting price and qty correctly on client side
            let price_and_quantity = cypher
                .decrypt(nonce, encrypted_order.cipher_text.as_slice())
                .unwrap();
            let limit_price = u64::from_le_bytes(price_and_quantity[0..8].try_into().unwrap());
            let max_base_qty = u64::from_le_bytes(price_and_quantity[8..16].try_into().unwrap());
            let max_quote_qty = fp32_mul(max_base_qty, limit_price);
            // If any order triggers an error, then none of the orders will be processed.
            validate_price_and_qty(
                &ctx.accounts.auction.clone().into_inner(),
                limit_price,
                max_base_qty,
            )?;
            // Make sure the order has enough tokens.
            // If the order is for less than token_qty then move that amount to token_free balance.
            match open_orders.side {
                Side::Ask => {
                    if encrypted_order.token_qty < max_base_qty {
                        return Err(error!(CustomErrors::InsufficientTokensForOrder));
                    }
                    let remaining_tokens =
                        encrypted_order.token_qty.checked_sub(max_base_qty).unwrap();
                    if remaining_tokens > 0 {
                        open_orders.base_token_free = open_orders
                            .base_token_free
                            .checked_add(remaining_tokens)
                            .unwrap();
                        open_orders.base_token_locked = open_orders
                            .base_token_locked
                            .checked_sub(remaining_tokens)
                            .unwrap();
                    }
                }
                Side::Bid => {
                    if encrypted_order.token_qty < max_quote_qty {
                        return Err(error!(CustomErrors::InsufficientTokensForOrder));
                    }
                    let remaining_tokens = encrypted_order
                        .token_qty
                        .checked_sub(max_quote_qty)
                        .unwrap();
                    if remaining_tokens > 0 {
                        open_orders.quote_token_free = open_orders
                            .quote_token_free
                            .checked_add(remaining_tokens)
                            .unwrap();
                        open_orders.quote_token_locked = open_orders
                            .quote_token_locked
                            .checked_sub(remaining_tokens)
                            .unwrap();
                    }
                }
            }
            // Place a new order
            let params = open_orders.new_order_params(limit_price, max_base_qty, max_quote_qty);
            let order_summary = order_book
                .new_order(
                    params,
                    &mut event_queue,
                    ctx.accounts.auction.min_base_order_size,
                )
                .unwrap();

            open_orders
                .orders
                .push(order_summary.posted_order_id.unwrap());
        }

        open_orders.encrypted_orders = Vec::new();

        Err(error!(CustomErrors::NotImplemented))
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn calculate_clearing_price(
        ctx: Context<CalculateClearingPrice>,
        limit: u16,
    ) -> Result<()> {
        let auction = &mut ctx.accounts.auction;

        let mut order_book = OrderBookState::new_safe(
            &ctx.accounts.bids.to_account_info(),
            &ctx.accounts.asks.to_account_info(),
            CALLBACK_INFO_LEN,
            CALLBACK_ID_LEN,
        )?;

        let bid_slab = order_book.get_tree(Side::Bid);
        let mut bid_iter = bid_slab.clone().into_iter(false);
        let mut current_bid: LeafNode;
        let ask_slab = order_book.get_tree(Side::Ask);
        let mut ask_iter = ask_slab.clone().into_iter(true);
        let mut current_ask: LeafNode;

        if auction.current_ask_key == 0 && auction.current_bid_key == 0 {
            current_bid = match bid_iter.next() {
                Some(bid) => bid,
                None => {
                    msg!("No orders found on the bid queue");
                    auction.has_found_clearing_price = true;
                    return Ok(());
                }
            };
            auction.current_bid_key = current_bid.key;
            current_ask = match ask_iter.next() {
                Some(ask) => ask,
                None => {
                    msg!("No orders found on the ask queue");
                    auction.has_found_clearing_price = true;
                    return Ok(());
                }
            };
            auction.current_ask_key = current_ask.key;
        } else {
            // TODO add a fake serialization function that iterates over the iterators
            // until it reaches the current bid/ask key. And errors if it can't find them
            // current_bid = bid_iter.next().unwrap();
            // current_ask = ask_iter.next().unwrap();
            msg!("intermediate serialization not implemented yet");
            return Err(error!(CustomErrors::NotImplemented));
        }

        for _ in 0..limit {
            let bid_quantity_remaining = current_bid
                .base_quantity
                .checked_sub(auction.current_bid_quantity_filled)
                .unwrap();
            let ask_quantity_remaining = current_ask
                .base_quantity
                .checked_sub(auction.current_ask_quantity_filled)
                .unwrap();
            let is_bid_gte_ask = bid_quantity_remaining >= ask_quantity_remaining;
            match is_bid_gte_ask {
                true => {
                    // Ask order is fully filled
                    auction.current_bid_quantity_filled = auction
                        .current_bid_quantity_filled
                        .checked_add(ask_quantity_remaining)
                        .unwrap();
                    auction.total_quantity_filled_so_far = auction
                        .total_quantity_filled_so_far
                        .checked_add(ask_quantity_remaining)
                        .unwrap();
                    match ask_iter.next() {
                        Some(new_ask) => {
                            if new_ask.price() > current_bid.price() {
                                // price have crossed
                                auction.has_found_clearing_price = true;
                                break;
                            }
                            current_ask = new_ask;
                            auction.current_ask_key = new_ask.key;
                            auction.current_ask_quantity_filled = 0;
                        }
                        None => {
                            // No more asks
                            auction.has_found_clearing_price = true;
                            break;
                        }
                    }
                }
                false => {
                    // Bid order is fully filled
                    auction.current_ask_quantity_filled = auction
                        .current_ask_quantity_filled
                        .checked_add(bid_quantity_remaining)
                        .unwrap();
                    auction.total_quantity_filled_so_far = auction
                        .total_quantity_filled_so_far
                        .checked_add(bid_quantity_remaining)
                        .unwrap();
                    match bid_iter.next() {
                        Some(new_bid) => {
                            if current_ask.price() > new_bid.price() {
                                // price have crossed
                                auction.has_found_clearing_price = true;
                                break;
                            }
                            current_bid = new_bid;
                            auction.current_bid_key = new_bid.key;
                            auction.current_bid_quantity_filled = 0;
                        }
                        None => {
                            // No more bids
                            auction.has_found_clearing_price = true;
                            break;
                        }
                    }
                }
            }
        }

        if auction.has_found_clearing_price {
            auction.total_quantity_matched = auction.total_quantity_filled_so_far;
            auction.remaining_bid_fills = auction.total_quantity_filled_so_far;
            auction.remaining_ask_fills = auction.total_quantity_filled_so_far;
            auction.final_bid_price = current_bid.price();
            auction.final_ask_price = current_ask.price();
            // For now clearing price defaults to lowest bid that fills the ask quantity
            auction.clearing_price = current_bid.price();
        }

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn match_orders(ctx: Context<MatchOrders>, limit: u16) -> Result<()> {
        let auction = &mut ctx.accounts.auction;

        let header = {
            let mut event_queue_data: &[u8] =
                &ctx.accounts.event_queue.data.borrow()[0..EVENT_QUEUE_HEADER_LEN];
            EventQueueHeader::deserialize(&mut event_queue_data)
                .unwrap()
                .check()?
        };
        let mut event_queue = EventQueue::new_safe(
            header,
            &ctx.accounts.event_queue.to_account_info(),
            CALLBACK_INFO_LEN,
        )?;

        let mut order_book = OrderBookState::new_safe(
            &ctx.accounts.bids.to_account_info(),
            &ctx.accounts.asks.to_account_info(),
            CALLBACK_INFO_LEN,
            CALLBACK_ID_LEN,
        )?;

        // Process all the bids first, then move onto the asks
        let side: Side;
        if order_book.bids_is_empty() {
            side = Side::Ask;
        } else {
            side = Side::Bid;
        }

        for _ in 0..limit {
            // bbo: best bid or offer
            let bbo_key = match order_book.find_bbo(side) {
                None => {
                    // Queue is empty
                    break;
                }
                Some(key) => key,
            };
            let bbo_node = *order_book
                .get_tree(side)
                .get_node(bbo_key)
                .unwrap()
                .as_leaf()
                .unwrap();
            match side {
                Side::Ask => {
                    let mut fill_size: u64 = 0;
                    if auction.remaining_ask_fills > 0 {
                        fill_size = cmp::min(bbo_node.base_quantity, auction.remaining_ask_fills);
                        let quote_size = fp32_mul(fill_size, auction.clearing_price);
                        let order_fill = Event::Fill {
                            taker_side: side.opposite(),
                            maker_callback_info: order_book
                                .get_tree(side)
                                .get_callback_info(bbo_node.callback_info_pt as usize)
                                .to_owned(),
                            taker_callback_info: Vec::new(),
                            maker_order_id: bbo_node.order_id(),
                            quote_size,
                            base_size: fill_size,
                        };
                        event_queue
                            .push_back(order_fill)
                            .map_err(|_| error!(CustomErrors::AobEventQueueFull))?;
                        auction.remaining_ask_fills =
                            auction.remaining_ask_fills.checked_sub(fill_size).unwrap();
                    }
                    let out_size = bbo_node.base_quantity.checked_sub(fill_size).unwrap();
                    let order_out = Event::Out {
                        side,
                        delete: true,
                        order_id: bbo_node.order_id(),
                        base_size: out_size,
                        callback_info: order_book
                            .get_tree(side)
                            .get_callback_info(bbo_node.callback_info_pt as usize)
                            .to_owned(),
                    };
                    event_queue
                        .push_back(order_out)
                        .map_err(|_| error!(CustomErrors::AobEventQueueFull))?;
                    order_book
                        .get_tree(side)
                        .remove_by_key(bbo_node.key)
                        .unwrap();
                }
                Side::Bid => {
                    let mut fill_size: u64 = 0;
                    if auction.remaining_bid_fills > 0 {
                        fill_size = cmp::min(bbo_node.base_quantity, auction.remaining_bid_fills);
                        let quote_size = fp32_mul(fill_size, auction.clearing_price);
                        let order_fill = Event::Fill {
                            taker_side: side.opposite(),
                            maker_callback_info: order_book
                                .get_tree(side)
                                .get_callback_info(bbo_node.callback_info_pt as usize)
                                .to_owned(),
                            taker_callback_info: Vec::new(),
                            maker_order_id: bbo_node.order_id(),
                            quote_size,
                            base_size: fill_size,
                        };
                        event_queue
                            .push_back(order_fill)
                            .map_err(|_| error!(CustomErrors::AobEventQueueFull))?;
                        auction.remaining_bid_fills =
                            auction.remaining_bid_fills.checked_sub(fill_size).unwrap();
                    }
                    let mut out_size = bbo_node.base_quantity - fill_size;
                    // Bids get a partial refund if they're filled at a lower price
                    if fill_size > 0 && bbo_node.price() > auction.clearing_price {
                        let quote_owed = fp32_mul(fill_size, bbo_node.price())
                            .checked_sub(fp32_mul(fill_size, auction.clearing_price))
                            .unwrap();
                        // Event::out only takes base size as an argument so
                        // need to convert quote owed to base using bbo's price
                        let base_owed = fp32_div(quote_owed, bbo_node.price());
                        out_size = out_size.checked_add(base_owed).unwrap();
                    }
                    let order_out = Event::Out {
                        side,
                        delete: true,
                        order_id: bbo_node.order_id(),
                        base_size: out_size,
                        callback_info: order_book
                            .get_tree(side)
                            .get_callback_info(bbo_node.callback_info_pt as usize)
                            .to_owned(),
                    };
                    event_queue
                        .push_back(order_out)
                        .map_err(|_| error!(CustomErrors::AobEventQueueFull))?;
                    order_book
                        .get_tree(side)
                        .remove_by_key(bbo_node.key)
                        .unwrap();
                }
            }
        }

        order_book.commit_changes();

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn consume_events(
        ctx: Context<ConsumeEvents>,
        limit: u16,
        allow_no_op: bool,
    ) -> Result<()> {
        let header = {
            let mut event_queue_data: &[u8] =
                &ctx.accounts.event_queue.data.borrow()[0..EVENT_QUEUE_HEADER_LEN];
            EventQueueHeader::deserialize(&mut event_queue_data)
                .unwrap()
                .check()?
        };
        let mut event_queue = EventQueue::new_safe(
            header,
            &ctx.accounts.event_queue.to_account_info(),
            CALLBACK_INFO_LEN,
        )?;

        let mut total_iterations: u16 = 0;

        for event in event_queue.iter().take(limit as usize) {
            // TODO make sure that this loop returns errors correctly
            match event {
                // We don't have the concept of a taker, so everything
                // hereafter refers to the maker as the user
                Event::Fill {
                    taker_side,
                    maker_order_id: _,
                    quote_size,
                    base_size,
                    maker_callback_info,
                    taker_callback_info: _,
                } => {
                    let user_side = taker_side.opposite();
                    let user_pubkey =
                        Pubkey::new_from_array(maker_callback_info.try_into().unwrap());
                    let user_account_info = ctx
                        .remaining_accounts
                        .iter()
                        .find(|remaining_account| remaining_account.key() == user_pubkey)
                        .ok_or(error!(
                            CustomErrors::MissingOpenOrdersPubkeyInRemainingAccounts
                        ))?;
                    let mut user_open_orders: Account<OpenOrders> =
                        Account::try_from(user_account_info)?;
                    // TODO what (if any) account validation is necessary?
                    // 1. Easy to check the sides match
                    // 2. Could check PDA but would prefer to do at the start
                    //  of the function, not in the loop, too inefficient
                    if user_open_orders.side != user_side {
                        return Err(error!(CustomErrors::UserSideDiffFromEventSide));
                    }
                    match user_side {
                        Side::Ask => {
                            user_open_orders.quote_token_free = user_open_orders
                                .quote_token_free
                                .checked_add(quote_size)
                                .unwrap();
                            user_open_orders.base_token_locked = user_open_orders
                                .base_token_locked
                                .checked_sub(base_size)
                                .unwrap();
                        }
                        Side::Bid => {
                            user_open_orders.base_token_free = user_open_orders
                                .base_token_free
                                .checked_add(base_size)
                                .unwrap();
                            user_open_orders.quote_token_locked = user_open_orders
                                .quote_token_locked
                                .checked_sub(quote_size)
                                .unwrap();
                        }
                    }
                    user_open_orders.exit(ctx.program_id)?;
                }
                Event::Out {
                    side,
                    order_id,
                    base_size,
                    callback_info,
                    delete: _,
                } => {
                    let user_side = side;
                    let user_pubkey = Pubkey::new_from_array(callback_info.try_into().unwrap());
                    let user_account_info = ctx
                        .remaining_accounts
                        .iter()
                        .find(|remaining_account| remaining_account.key() == user_pubkey)
                        .ok_or(error!(
                            CustomErrors::MissingOpenOrdersPubkeyInRemainingAccounts
                        ))?;
                    let mut user_open_orders: Account<OpenOrders> =
                        Account::try_from(user_account_info)?;
                    // TODO what (if any) account validation is necessary?
                    // 1. Easy to check the sides match
                    // 2. Could check PDA but would prefer to do at the start
                    //  of the function, not in the loop, too inefficient
                    if user_open_orders.side != user_side {
                        return Err(error!(CustomErrors::UserSideDiffFromEventSide));
                    }
                    match user_side {
                        Side::Ask => {
                            user_open_orders.base_token_free = user_open_orders
                                .base_token_free
                                .checked_add(base_size)
                                .unwrap();
                            user_open_orders.base_token_locked = user_open_orders
                                .base_token_locked
                                .checked_sub(base_size)
                                .unwrap();
                        }
                        Side::Bid => {
                            let price = (order_id >> 64) as u64;
                            let quote_size = fp32_mul(base_size, price);
                            user_open_orders.quote_token_free = user_open_orders
                                .quote_token_free
                                .checked_add(quote_size)
                                .unwrap();
                            user_open_orders.quote_token_locked = user_open_orders
                                .quote_token_locked
                                .checked_sub(quote_size)
                                .unwrap();
                        }
                    }

                    let order_idx = user_open_orders.find_order_index(order_id)?;
                    user_open_orders.orders.remove(order_idx);
                    user_open_orders.num_orders =
                        user_open_orders.num_orders.checked_sub(1).unwrap();

                    user_open_orders.exit(ctx.program_id)?;
                }
            }

            total_iterations += 1;
        }

        if total_iterations == 0 && !allow_no_op {
            return Err(error!(CustomErrors::NoEventsProcessed));
        }

        event_queue.pop_n(total_iterations.into());
        let mut event_queue_data: &mut [u8] = &mut ctx.accounts.event_queue.data.borrow_mut();
        event_queue.header.serialize(&mut event_queue_data).unwrap();
        msg!("num events processed: {}", total_iterations);

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn settle_and_close_open_orders(ctx: Context<SettleAndCloseOpenOrders>) -> Result<()> {
        let open_orders = &mut *ctx.accounts.open_orders;

        // This information + clearing price should be enough to display to the user after the auction
        ctx.accounts.order_history.set_inner(OrderHistory {
            bump: ctx.accounts.order_history.bump,
            side: open_orders.side,
            quote_amount_returned: open_orders.quote_token_free,
            base_amount_returned: open_orders.base_token_free,
        });

        // We have to set open orders.free values to 0 before calling the CPI
        // because of an immutable borrow compile error. Technically it would be
        // safe to omit setting the free values to 0 because of the anchor 
        // account close discriminator but better to be totally sure.
        let quote_token_free = open_orders.quote_token_free;
        let base_token_free = open_orders.base_token_free;
        open_orders.quote_token_free = 0;
        open_orders.base_token_free = 0;
        if quote_token_free > 0 {
            token::transfer(
                ctx.accounts
                    .transfer_quote_vault()
                    .with_signer(&[auction_seeds!(ctx.accounts.auction)]),
                    quote_token_free,
            )?;
        }
        if base_token_free > 0 {
            token::transfer(
                ctx.accounts
                    .transfer_base_vault()
                    .with_signer(&[auction_seeds!(ctx.accounts.auction)]),
                    base_token_free,
            )?;
        }

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn close_aob_accounts(ctx: Context<CloseAobAccounts>) -> Result<()> {
        let auctioneer_lamports = ctx.accounts.auctioneer.lamports();
        **ctx.accounts.auctioneer.lamports.borrow_mut() = auctioneer_lamports
            .checked_add(ctx.accounts.event_queue.lamports())
            .unwrap()
            .checked_add(ctx.accounts.bids.lamports())
            .unwrap()
            .checked_add(ctx.accounts.asks.lamports())
            .unwrap();

        **ctx.accounts.event_queue.lamports.borrow_mut() = 0;
        **ctx.accounts.bids.lamports.borrow_mut() = 0;
        **ctx.accounts.asks.lamports.borrow_mut() = 0;

        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
