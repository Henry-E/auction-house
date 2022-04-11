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

    #[access_control(InitAuction::validate_args(args))]
    pub fn init_auction(ctx: Context<InitAuction>, args: InitAuctionArgs) -> Result<()> {
        let auction: &mut Auction = &mut *ctx.accounts.auction;
        auction.start_time = args.start_time;
        
        // TODO update auction account with a bunch of deets

        // TODO initialize the orderbook accounts
        
            // Basically everything from create_market.rs in aob except
            // the account checks
            // Load market
            // load event queue
            // init slab

        Ok(())
    }

    pub fn init_open_orders(_ctx: Context<InitOpenOrders>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))

        // TODO Just update ctx.accounts.auction with relevant values

        // Ok(())
    }

    pub fn new_order(_ctx: Context<NewOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))

        // TODO
            // load the orderbook
            // load the event queue
            // Put together new_order::params
            // Send the new order
            // Update relevant values on the open orders account
                // order id, quote token locked, base token locked

        // Ok(())
    }

    pub fn cancel_order(_ctx: Context<NewOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))

        // TODO
            // Any non-aob accounts we already have loaded up
            // Check the order_id is in the vector, just do a loop over the order_ids vector, it's no big deal
            // Load the aob market state
            // Load the orderbook
            // Get the slab, remove order_id by key, get the order details from the node
            // Match the side of the order
            // Update user account quote/base tokens locked/free
            // Delete the order_id from vector of open orders

        // Ok(())
    }

    pub fn new_encrypted_order(_ctx: Context<NewEncryptedOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))

        // TODO
        // Args
            // Public key
            // Encryption values - nonce + cipher text
            // quote / base token quantity
        // Access control 
            // Check the public key is correct if has already been added
        // Function
            // Check if public key hasn't already been added and add it if not
            // Create an EncryptedOrder struct using the nonce, cipher text and token quantity
            // Check that the same Encrypted Order struct isn't already in the vector
            // Add it to the encrypted orders vector
            // Match the side of the account
                // Transfer over the token amount of currency to the base / quote vault
                // Add the values to the base / quote locked
        
        // Ok(())
    }
    
    pub fn cancel_encrypted_order(_ctx: Context<NewEncryptedOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))

        // TODO
        // Args
            // cipher text + nonce of order to cancel
        // Access control
            // Bid / Ask time hasn't finished
        // Function
            // Loop over the encrypted orders to find the cipher text that matches the input
                // Error if the order isn't found. There's a special - end of loop call function option
            // Match the side of the account
                // Reduce the order's token_locked from base/quote token locked
                // Transfer token_locked quantity of tokens base /quote token vault
        
        // Ok(())
    }

    pub fn decrypt_order(_ctx: Context<DecryptOrder>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))

        // TODO
        // Args
            // Secret key
        // Access control
            // 	After order period has finished
            // 	Before decryption period has finished
        // Function
            // Iterate over all the encrypted orders
                // Decrypt the price and quantity of each order from the cipher text
            // 	Validate the decrypted values
                // 	Price lots
                // 	Quantity lots
                // 	Sufficient quote/base tokens locked
                // 	Anything else that is validated by unencrypted order
            // 	If this is a bid and price * quantity < locked tokens 
                // 	reduce remaining amount from quote tokens locked 
                // 	Increase the quote token free by remaining amount
            // 	Post the order to the AOB, same as in new uncencrypted order, and add the order id to orders

        // Ok(())
    }

    pub fn calculate_clearing_price(_ctx: Context<CalculateClearingPrice>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn match_orders(_ctx: Context<MatchOrders>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn consume_events(_ctx: Context<ConsumeEvents>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn prune_orders(_ctx: Context<MatchOrders>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn settle_and_close_open_orders(_ctx: Context<SettleAndCloseOpenOrders>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }

    pub fn close_aob_accounts(_ctx: Context<CloseAobAccounts>) -> Result<()> {
        Err(error!(CustomErrors::NotImplemented))
        // Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
