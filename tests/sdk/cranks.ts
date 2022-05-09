import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccount, createMint, createMintToCheckedInstruction, getAccount, getMint, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import nacl from "tweetnacl";
import { AuctionHouse } from "../../target/types/auction_house";
import * as genAccs from "../../generated/accounts";
import * as genInstr from "../../generated/instructions";
import { Auction } from "./auction";
import { User } from "./user";

// Crank to calculate the clearing price.
// Returns true if clearing price was found.
// Returns false if too many errors occured.
// TODO limit can be set higher than 1 once we have a serialized iterator.
export async function calcClearingPriceCrank(provider: anchor.Provider, wallet: anchor.Wallet, auctionObj: Auction, limit: number = 1 ): Promise<boolean> {
    let numErrors = 0;
    while (true) {
        try {
            let tx = new anchor.web3.Transaction;
            tx.add(genInstr.calculateClearingPrice(
                {limit: new BN(limit)},
                {...auctionObj}
            ));
            await provider.send(tx, [], {skipPreflight: true});
            numErrors = 0;
        } catch (e) {
            // "Calculating clearing price phase is not active"
            if (e.toString().includes("6009")) {
               return true 
            } else {
                console.log("Hit a failed transaction but continuing:", e);
                numErrors++
            }
            // 3 sequential transaction failures and we exit the loop
            if (numErrors > 2) {
                return false
            }
        }
    }
}

// Crank to match all the orders.
// Returns true if all orders were matched.
// Returns false if too many errors occured.
export async function matchOrdersCrank(provider: anchor.Provider, wallet: anchor.Wallet, auctionObj: Auction, limit: number = 1): Promise<boolean> {
    let numErrors = 0;
    while (true) {
        try {
            let tx = new anchor.web3.Transaction;
            tx.add(genInstr.matchOrders(
                {limit: new BN(limit)},
                {...auctionObj}
            ));
            await provider.send(tx, [], {skipPreflight: true});
            numErrors = 0;
        } catch (e) {
            // "Calculating clearing price phase is not active"
            if (e.toString().includes("6012")) {
               return true 
            } else {
                console.log("Hit a failed transaction but continuing:", e);
                numErrors++
            }
            // 3 sequential transaction failures and we exit the loop
            if (numErrors > 2) {
                return false
            }
        }
    }
}