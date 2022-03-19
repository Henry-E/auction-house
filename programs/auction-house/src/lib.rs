use anchor_lang::prelude::*;

use agnostic_orderbook::state::Side;

use ctx::*;
use account::*;

mod account;
mod consts;
mod ctx;


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
}

#[derive(Accounts)]
pub struct Initialize {}
