import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccount, createMint, createMintToCheckedInstruction, getAccount, getMint, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import nacl from "tweetnacl";
import { AuctionHouse } from "../../target/types/auction_house";
import * as genAccs from "../../generated/accounts";
import * as genInstr from "../../generated/instructions";
import { Auction } from "./auction";
import { User, fetchUsers } from "./user";
import { EventFill, EventOut, EventQueue } from "@bonfida/aaob";

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

// Crank to decrypt orders on all the open orders accounts.
// Returns true if all encrypted open orders account were successfully decrypted.
// Returns false if any errors occured but will keep running the crank until all accounts are processed.
export async function decryptOrdersCrank(program: anchor.Program<AuctionHouse>, provider: anchor.Provider, auctionObj: Auction, batchSize: number = 50): Promise<boolean> {
    let fetchedUsers = await fetchUsers(program, provider, auctionObj, {onlyEncrypted: true});

    let anyErrors = false;
    let numDecryptedUsers = 0;
    let tempDecryptInstrs: Array<Promise<String>> = [];
    let startTime = Date.now();
    for (let user of fetchedUsers) {
        if (Date.now() / 1000  > auctionObj.endDecryptionPhase.toNumber()) {
            console.log("Decryption phase has ended");
            try {
                await Promise.all(tempDecryptInstrs);
            } catch (e) {
                console.log(e)
                anyErrors = true
            }
            console.log(tempDecryptInstrs.length, "orders in", (Date.now() - startTime)/1000);
            console.log(numDecryptedUsers, "orders in total");
            break
        }
        let sharedKey = Array.from(nacl.box.before(
            Uint8Array.from(user.naclPubkey),
            auctionObj.naclKeypair.secretKey
        ))
        let tx = new anchor.web3.Transaction;
        tx.add(genInstr.decryptOrder(
            {sharedKey},
            {...user, ...auctionObj}
        ));
        tempDecryptInstrs.push(provider.send(tx, [], {skipPreflight: true}));
        numDecryptedUsers += 1

        if (numDecryptedUsers % batchSize == 0){
            try {
                await Promise.all(tempDecryptInstrs);
            } catch (e) {
                console.log(e)
                anyErrors = true
            }
            console.log(tempDecryptInstrs.length, "open order accounts decrypted in", (Date.now() - startTime)/1000);
            console.log(numDecryptedUsers, "open order accounts in total");
            tempDecryptInstrs = [];
            startTime = Date.now();
        }
    }

    if (anyErrors) {
        // There were errors, it's possible not all the accounts were decrypted for one reason or another.
        // Failed decryptions can very well be for valid reasons, best to check the error logs.
        return false
    } else {
        return true
    }
}

// Crank to all the events on the event queue.
// Returns true if all events were consumed.
// Returns false if an errors occurs. There are valid consume events errors, like if there are no events left on the event queue
// Argument: numEventsToConsume is upper bounded more by the maximum number possible pubkeys in the transaction bytes than compute
export async function consumeEventsCrank(provider: anchor.Provider, auctionObj: Auction, numEventsToConsume: number = 10 ): Promise<boolean> {
    let thisAuction = await genAccs.Auction.fetch(provider.connection, auctionObj.auction);

    while (true) {
        let thisEventQueue = await EventQueue.load(provider.connection, thisAuction.eventQueue, 32);
        if (thisEventQueue.header.count.toNumber() == 0) {
            console.log("no events on the event queue to consume");
            return true 
        }
        numEventsToConsume = Math.min(numEventsToConsume, thisEventQueue.header.count.toNumber());

        let pubkeyStrs = new Set<String>(); // Set doesn't work with PublicKey type
        // idx is the number of events that will be processed by the consume events called
        let idx = 0;
        while (idx < numEventsToConsume) {
            try {
                let event = thisEventQueue.parseEvent(idx);
                let thisPubkey: PublicKey;
                if (event instanceof EventOut) {
                    thisPubkey = new PublicKey(event.callBackInfo);
                } else if (event instanceof EventFill) {
                    thisPubkey = new PublicKey(event.makerCallbackInfo);
                }
                pubkeyStrs.add(thisPubkey.toString());
                idx++
            } catch (e) {
                console.log(e);
                return false
            }
        }
        let tx = new anchor.web3.Transaction;
        let thisInstr = genInstr.consumeEvents(
            {limit: new BN(10), allowNoOp: false},
            {...auctionObj}
        );
        let remainingAccounts: anchor.web3.AccountMeta[] = [];
        for (let thisPubkeyStr of pubkeyStrs) {
            remainingAccounts.push({
                pubkey: new PublicKey(thisPubkeyStr), isSigner: false, isWritable: true
            });
        }
        thisInstr.keys = thisInstr.keys.concat(remainingAccounts);
        tx.add(thisInstr);
        try {
            await provider.send(tx, [], {skipPreflight: true});
        } catch (e) {
            console.log(e);
            return false
        }
    }
}

// Crank to settle and close empty open orders accounts (accounts with no orders on them).
// Returns true if all open orders accounts found were closed.
// Returns false if any errors occured but will keep running the crank until all accounts are processed.
export async function settleAndCloseOpenOrdersCrank(program: anchor.Program<AuctionHouse>, provider: anchor.Provider, auctionObj: Auction, batchSize: number = 50): Promise<boolean> {
    let fetchedUsers = await fetchUsers(program, provider, auctionObj, {onlyEmpty: true});

    let anyErrors = false;
    let numOpenOrdersClosed = 0;
    let tempCloseInstrs: Array<Promise<String>> = [];
    let startTime = Date.now();
    for (let user of fetchedUsers) {
        let tx = new anchor.web3.Transaction;
        tx.add(genInstr.settleAndCloseOpenOrders(
            {...auctionObj, ...user}
        ));
        tempCloseInstrs.push(provider.send(tx, [], {skipPreflight: true}));
        numOpenOrdersClosed++
        if (numOpenOrdersClosed % batchSize == 0) {
            try {
                await Promise.all(tempCloseInstrs);
            } catch (e) {
                console.log(e);
                anyErrors = true;
            }

            console.log(tempCloseInstrs.length, "open order accounts settled and closed in", (Date.now() - startTime)/1000);
            console.log(numOpenOrdersClosed, "open order accounts closed in total");
            tempCloseInstrs = [];
            startTime = Date.now();
        }
    }
    if (tempCloseInstrs.length > 0) {
        try {
            await Promise.all(tempCloseInstrs);
        } catch (e) {
            console.log(e);
            anyErrors = true;
        }
        console.log(tempCloseInstrs.length, "open order accounts settled and closed in", (Date.now() - startTime)/1000);
        console.log(numOpenOrdersClosed, "open order accounts closed in total");
        tempCloseInstrs = [];
        startTime = Date.now(); 
    }
    if (anyErrors) {
        // There were errors, it's possible not all the accounts were closed for one reason or another.
        // Best to check the error logs to see what went wrong.
        return false
    } else {
        return true
    }return false
}