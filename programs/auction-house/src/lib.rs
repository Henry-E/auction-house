use anchor_lang::prelude::*;

use agnostic_orderbook::state::Side;

use account_contexts::*;
use account_data::*;
use error::*;

mod account_data;
mod consts;
mod account_contexts;
mod error;

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

    pub fn init_auction(ctx: Context<InitAuction>, start_time: i64) -> Result<()> {
        let auction: &mut Auction = &mut *ctx.accounts.auction;
        auction.start_time = start_time;
        Ok(())
    }

    pub fn init_open_orders(_ctx: Context<InitOpenOrders>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn new_order(_ctx: Context<NewOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn cancel_order(_ctx: Context<NewOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn new_encrypted_order(_ctx: Context<NewEncryptedOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }
    
    pub fn cancel_encrypted_order(_ctx: Context<NewEncryptedOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn decrypt_order(_ctx: Context<DecryptOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn calculate_clearing_price(_ctx: Context<CalculateClearingPrice>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

}

#[derive(Accounts)]
pub struct Initialize {}
