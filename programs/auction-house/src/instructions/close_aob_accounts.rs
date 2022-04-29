use anchor_lang::prelude::*;

use agnostic_orderbook::orderbook::OrderBookState;
use agnostic_orderbook::state::{EventQueueHeader, EVENT_QUEUE_HEADER_LEN};

use crate::access_controls::*;
use crate::account_data::*;
use crate::consts::*;
use crate::error::CustomErrors;

#[derive(Accounts)]
pub struct CloseAobAccounts<'info> {
    // Technically doesn't need to be a signer for this function
    #[account(mut)]
    pub auctioneer: Signer<'info>,
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

impl CloseAobAccounts<'_> {
    pub fn access_control(&self) -> Result<()> {
        let auction = self.auction.clone().into_inner();
        let order_book = OrderBookState::new_safe(
            &self.bids.to_account_info(),
            &self.asks.to_account_info(),
            CALLBACK_INFO_LEN,
            CALLBACK_ID_LEN,
        )?;
        let event_queue_header = {
            let mut event_queue_data: &[u8] =
                &self.event_queue.data.borrow()[0..EVENT_QUEUE_HEADER_LEN];
            EventQueueHeader::deserialize(&mut event_queue_data)
                .unwrap()
                .check()?
        };

        if !is_auction_over(&auction, &order_book, &event_queue_header) {
            return Err(error!(CustomErrors::AuctionNotFinished));
        }

        Ok(())
    }
}

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

    Ok(())
}
