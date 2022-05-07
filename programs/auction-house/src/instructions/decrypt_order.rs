use std::convert::TryInto;

use anchor_lang::prelude::*;

use agnostic_orderbook::orderbook::OrderBookState;
use agnostic_orderbook::state::{EventQueue, EventQueueHeader, EVENT_QUEUE_HEADER_LEN};
use agnostic_orderbook::utils::fp32_mul;

use xsalsa20poly1305::{
    aead::{Aead, NewAead},
    Nonce, XSalsa20Poly1305,
};

use crate::access_controls::*;
use crate::consts::*;
use crate::error::CustomErrors;
use crate::program_accounts::*;
use crate::types::*;

#[derive(Accounts)]
pub struct DecryptOrder<'info> {
    // Doesn't need to be a signer because the encryption will fail anyway without
    // the correct shared key
    pub auctioneer: SystemAccount<'info>,
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.auction_id, auctioneer.key().as_ref()],
        bump = auction.bump,
        mut
    )]
    pub auction: Box<Account<'info, Auction>>,
    #[account(
        seeds = [open_orders.authority.as_ref(), OPEN_ORDERS.as_bytes(), &auction.auction_id, auctioneer.key().as_ref()],
        bump = open_orders.bump,
        mut
    )]
    pub open_orders: Box<Account<'info, OpenOrders>>,
    // AOB Accounts
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.event_queue,
        owner = crate::ID,
        mut
    )]
    pub event_queue: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.bids,
        owner = crate::ID,
        mut
    )]
    pub bids: UncheckedAccount<'info>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.asks,
        owner = crate::ID,
        mut
    )]
    pub asks: UncheckedAccount<'info>,
}

impl DecryptOrder<'_> {
    pub fn access_control(&self) -> Result<()> {
        let clock = Clock::get()?;
        let auction = self.auction.clone().into_inner();
        let open_orders = self.open_orders.clone().into_inner();

        if !is_decryption_phase_active(clock, &auction) {
            return Err(error!(CustomErrors::DecryptionPhaseNotActive));
        };
        encrypted_orders_only(&auction, &open_orders)?;

        Ok(())
    }
}

pub fn decrypt_order(ctx: Context<DecryptOrder>, shared_key: Vec<u8>) -> Result<()> {
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

    let key = xsalsa20poly1305::Key::from_slice(shared_key.as_slice());
    let cypher = XSalsa20Poly1305::new(key);

    let open_orders = &mut *ctx.accounts.open_orders;
    for encrypted_order in open_orders.encrypted_orders.clone().iter() {
        let nonce = Nonce::from_slice(encrypted_order.nonce.as_slice());
        // TODO Make sure that we're encrypting price and qty correctly on client side
        let price_and_quantity = cypher
            .decrypt(nonce, encrypted_order.cipher_text.as_slice())
            .map_err(|_| error!(CustomErrors::InvalidSharedKey))?;
        let limit_price = u64::from_le_bytes(price_and_quantity[0..8].try_into().unwrap());
        let max_base_qty = u64::from_le_bytes(price_and_quantity[8..16].try_into().unwrap());
        // If any order triggers an error, then none of the orders will be processed.
        validate_price_and_qty(
            &ctx.accounts.auction.clone().into_inner(),
            limit_price,
            max_base_qty,
        )?;
        // Place a new order
        let params = open_orders.new_order_params(limit_price, max_base_qty);
        let order_summary = order_book
            .new_order(
                params,
                &mut event_queue,
                ctx.accounts.auction.min_base_order_size,
            )
            .unwrap();
        // Make sure the order has enough tokens.
        // If the order is for less than token_qty then move that amount to token_free balance.
        match open_orders.side {
            Side::Ask => {
                if encrypted_order.token_qty < order_summary.total_base_qty {
                    return Err(error!(CustomErrors::InsufficientTokensForOrder));
                }
                let remaining_tokens = encrypted_order
                    .token_qty
                    .checked_sub(order_summary.total_base_qty)
                    .unwrap();
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
                if encrypted_order.token_qty < order_summary.total_quote_qty {
                    return Err(error!(CustomErrors::InsufficientTokensForOrder));
                }
                let remaining_tokens = encrypted_order
                    .token_qty
                    .checked_sub(order_summary.total_quote_qty)
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

        open_orders
            .orders
            .push(order_summary.posted_order_id.unwrap());
    }

    open_orders.encrypted_orders = Vec::new();
    order_book.commit_changes();
    let mut event_queue_header_data: &mut [u8] = &mut ctx.accounts.event_queue.data.borrow_mut();
    event_queue
        .header
        .serialize(&mut event_queue_header_data)
        .unwrap();
    Ok(())
}
