use anchor_lang::prelude::*;
use anchor_spl::token;

use crate::consts::*;
use crate::instructions::NewEncryptedOrder;
use crate::program_accounts::*;
use crate::types::*;

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

    Ok(())
}
