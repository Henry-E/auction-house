use anchor_lang::prelude::*;

use agnostic_orderbook::state::{
    Event, EventQueue, EventQueueHeader, Side as AobSide, EVENT_QUEUE_HEADER_LEN,
};
use agnostic_orderbook::utils::fp32_mul;

use std::convert::TryInto;

use crate::account_data::*;
use crate::consts::*;
use crate::error::CustomErrors;

#[derive(Accounts)]
pub struct ConsumeEvents<'info> {
    // Program Accounts
    #[account(
        seeds = [AUCTION.as_bytes(), &auction.auction_id, auction.authority.as_ref()],
        bump = auction.bump,
        mut
    )]
    pub auction: Box<Account<'info, Auction>>,
    /// CHECK: This should be owned by the program
    #[account(
        address = auction.event_queue,
        owner = crate::ID,
        mut
    )]
    pub event_queue: UncheckedAccount<'info>,
    // Plus a bunch of Open orders accounts in remaining accounts
}

pub fn consume_events(ctx: Context<ConsumeEvents>, limit: u16, allow_no_op: bool) -> Result<()> {
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
                let user_pubkey = Pubkey::new_from_array(maker_callback_info.try_into().unwrap());
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
                if AobSide::from(user_open_orders.side) != user_side {
                    return Err(error!(CustomErrors::UserSideDiffFromEventSide));
                }
                match user_side {
                    AobSide::Ask => {
                        user_open_orders.quote_token_free = user_open_orders
                            .quote_token_free
                            .checked_add(quote_size)
                            .unwrap();
                        user_open_orders.base_token_locked = user_open_orders
                            .base_token_locked
                            .checked_sub(base_size)
                            .unwrap();
                    }
                    AobSide::Bid => {
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
                if AobSide::from(user_open_orders.side) != user_side {
                    return Err(error!(CustomErrors::UserSideDiffFromEventSide));
                }
                match user_side {
                    AobSide::Ask => {
                        user_open_orders.base_token_free = user_open_orders
                            .base_token_free
                            .checked_add(base_size)
                            .unwrap();
                        user_open_orders.base_token_locked = user_open_orders
                            .base_token_locked
                            .checked_sub(base_size)
                            .unwrap();
                    }
                    AobSide::Bid => {
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

                let order_idx = user_open_orders.find_order_index(&order_id)?;
                user_open_orders.orders.remove(order_idx);
                user_open_orders.num_orders = user_open_orders.num_orders.checked_sub(1).unwrap();

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

    Ok(())
}
