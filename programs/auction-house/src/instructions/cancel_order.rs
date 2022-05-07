use anchor_lang::prelude::*;
use anchor_spl::token;

use agnostic_orderbook::orderbook::OrderBookState;
use agnostic_orderbook::state::get_side_from_order_id;
use bonfida_utils::fp_math::fp32_mul;

use crate::consts::*;
use crate::error::CustomErrors;
use crate::instructions::NewOrder;
use crate::program_accounts::*;
use crate::types::*;

pub fn cancel_order(ctx: Context<NewOrder>, order_id: u128) -> Result<()> {
    let mut order_book = OrderBookState::new_safe(
        &ctx.accounts.bids.to_account_info(),
        &ctx.accounts.asks.to_account_info(),
        CALLBACK_INFO_LEN,
        CALLBACK_ID_LEN,
    )?;
    let slab = order_book.get_tree(get_side_from_order_id(order_id));
    let (node, _) = slab
        .remove_by_key(order_id)
        .ok_or_else(|| error!(CustomErrors::OrderIdNotFound))?;
    let leaf_node = node.as_leaf().unwrap();
    let total_base_qty = leaf_node.base_quantity;
    let total_quote_qty = fp32_mul(leaf_node.base_quantity, leaf_node.price()).ok_or_else(| | error!(CustomErrors::NumericalOverflow))?;
    order_book.commit_changes();

    let open_orders = &mut *ctx.accounts.open_orders;
    let order_idx = open_orders.find_order_index(&order_id)?;
    open_orders.orders.remove(order_idx);
    open_orders.num_orders = open_orders.num_orders.checked_sub(1).unwrap();

    match open_orders.side {
        Side::Ask => {
            msg!("total_base_qty {}", total_base_qty);
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
    Ok(())
}
