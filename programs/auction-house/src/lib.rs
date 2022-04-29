use anchor_lang::prelude::*;

use account_data::*;
use instructions::*;

mod access_controls;
mod account_data;
mod consts;
mod error;
mod instructions;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod auction_house {
    use super::*;

    #[access_control(InitAuction::validate_args(&args))]
    pub fn init_auction(ctx: Context<InitAuction>, args: InitAuctionArgs) -> Result<()> {
        instructions::init_auction(ctx, &args)
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
        instructions::new_order(ctx, limit_price, max_base_qty)
    }

    #[access_control(ctx.accounts.access_control_cancel_order(&order_id))]
    pub fn cancel_order(ctx: Context<NewOrder>, order_id: u128) -> Result<()> {
        instructions::cancel_order(ctx, order_id)
    }

    #[access_control(ctx.accounts.access_control_new_encrypted_order(&nacl_pubkey))]
    pub fn new_encrypted_order(
        ctx: Context<NewEncryptedOrder>,
        token_qty: u64,
        nacl_pubkey: Vec<u8>,
        nonce: Vec<u8>,
        cipher_text: Vec<u8>,
    ) -> Result<()> {
        instructions::new_encrypted_order(ctx, token_qty, nacl_pubkey, nonce, cipher_text)
    }

    #[access_control(ctx.accounts.access_control_cancel_encrypted_order(order_idx))]
    pub fn cancel_encrypted_order(ctx: Context<NewEncryptedOrder>, order_idx: u8) -> Result<()> {
        instructions::cancel_encrypted_order(ctx, order_idx)
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn decrypt_order(ctx: Context<DecryptOrder>, shared_key: Vec<u8>) -> Result<()> {
        instructions::decrypt_order(ctx, shared_key)
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn calculate_clearing_price(
        ctx: Context<CalculateClearingPrice>,
        limit: u16,
    ) -> Result<()> {
        instructions::calculate_clearing_price(ctx, limit)
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn match_orders(ctx: Context<MatchOrders>, limit: u16) -> Result<()> {
        instructions::match_orders(ctx, limit)
    }

    pub fn consume_events(
        ctx: Context<ConsumeEvents>,
        limit: u16,
        allow_no_op: bool,
    ) -> Result<()> {
        instructions::consume_events(ctx, limit, allow_no_op)
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn settle_and_close_open_orders(ctx: Context<SettleAndCloseOpenOrders>) -> Result<()> {
        instructions::settle_and_close_open_orders(ctx)
    }

    #[access_control(ctx.accounts.access_control())]
    pub fn close_aob_accounts(ctx: Context<CloseAobAccounts>) -> Result<()> {
        instructions::close_aob_accounts(ctx)
    }
}
