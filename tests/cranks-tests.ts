import * as anchor from "@project-serum/anchor";
import { PublicKey, SYSVAR_STAKE_HISTORY_PUBKEY } from "@solana/web3.js"
import { BN } from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { AuctionHouse } from "../target/types/auction_house";
import {Auction, initAuctionObj, fetchAuctionObj, User, initUser, toFp32, toFpLimitPrice, getCreateAccountParams, sleep, fetchUsers, calcClearingPriceCrank, matchOrdersCrank} from "./sdk";

import * as genInstr from "../generated/instructions";
import * as genTypes from "../generated/types";
import * as genAccs from "../generated/accounts";
import { Transaction } from "@solana/web3.js";
import { assert } from "chai";
import nacl from "tweetnacl";
import { types } from "util";
import { AccountDiscriminatorAlreadySet } from "../generated/errors/anchor";
import { EventFill, EventOut, EventQueue } from "@bonfida/aaob";
// import { fetchAuctionObj } from "./sdk/auction";

describe("Testing out the cranks for processing the auction phases", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.Provider.env();
    const wallet = provider.wallet as anchor.Wallet;
    anchor.setProvider(provider);
    const program = anchor.workspace.AuctionHouse as Program<AuctionHouse>;

    const auctionId = Array.from(Buffer.from("cranks".padEnd(10))); // Can be up to 10 characters long
    const areAsksEncrypted = false;
    const areBidsEncrypted = true;
    const minBaseOrderSize = new BN(100_000_000); // Min order size of $20 assuming $0.20 token price and 6 decimal places
    const tickSizeNum = 0.001; // $0.001 or 0.1c tick size
    const tickSize = toFp32(tickSizeNum);
    const eventQueueBytes = 1000000;
    
    const minSalePrice = 0.2; // $0.20 / 20c
    const numTokensForSale: BN = new BN(100_000_000_000_000); // 100 million tokens, assuming 6 decimal places
    let auctionNaclKeypair: nacl.BoxKeyPair;

    
    // Simulated user values
    const minPrice = 0.18; // Setting min price below the ask price just to add more diversity to the test
    const maxPrice = 0.40;
    const defaultUserUsdc = new BN(1_000_000_000_000); // $1 million, orders will be between $200 and $1 million
    
    let users: Array<User> = [];
    // const numUsers = 1250; // Needs to be 1,250 to make sure enough orders are sent through that some will be removed from the order book
    const numUsers = 50;
    const orderPhaseLength = (numUsers / 2);
    const decryptionPhaseLength = (numUsers / 6);
    const groupedNum = 50;
    const maxOrdersInOrderbook = 1000; // Should be a higher number once we have an serialized iterator
    const bidsBytes = (104 + (80+32) * maxOrdersInOrderbook);
    const asksBytes = bidsBytes;
    let maxOrders = new BN(2);


    it("create auction", async() => {
        let auctionObj = await initAuctionObj(program, provider, wallet, auctionId, areAsksEncrypted, areBidsEncrypted, minBaseOrderSize, tickSize, orderPhaseLength, decryptionPhaseLength);
        let tx = new anchor.web3.Transaction;
        let eventQueueParams = await getCreateAccountParams(program, provider, wallet, auctionObj.eventQueue, eventQueueBytes);
        tx.add(anchor.web3.SystemProgram.createAccount(eventQueueParams));
        let bidsParams = await getCreateAccountParams(program, provider, wallet, auctionObj.bids, bidsBytes);
        tx.add(anchor.web3.SystemProgram.createAccount(bidsParams));
        let asksParams = await getCreateAccountParams(program, provider, wallet, auctionObj.asks, asksBytes);
        tx.add(anchor.web3.SystemProgram.createAccount(asksParams));
        tx.add(genInstr.initAuction(
        {args: {...auctionObj}}, {...auctionObj}
        ));
        await provider.send(tx, [auctionObj.eventQueueKeypair, auctionObj.bidsKeypair, auctionObj.asksKeypair]);

        let thisAuction = await genAccs.Auction.fetch(provider.connection, auctionObj.auction);
        assert.isTrue(thisAuction.auctionId.toString() == auctionId.toString(), "auction Ids match");
        assert.isTrue(thisAuction.authority.toString() == wallet.publicKey.toString(), "authorities match");

        auctionNaclKeypair = auctionObj.naclKeypair;
    });

    it("create the IDO token seller and place the order", async() => {
        let auctionObj = await fetchAuctionObj(program, provider, wallet.publicKey, auctionId);
        let daoUser = await initUser(program, provider, wallet, auctionObj, new genTypes.Side.Ask(), numTokensForSale, new anchor.BN(0), maxOrders);
        // All of these instructions would pass through a DAO vote and be executed via CPI
        let tx = new anchor.web3.Transaction;
        tx.add(genInstr.initOpenOrders(
            {...daoUser}, {...daoUser, ...auctionObj}
        ));
        tx.add(genInstr.newOrder(
            {limitPrice: toFpLimitPrice(minSalePrice, (auctionObj.tickSize.toNumber() / (2**32))), maxBaseQty: numTokensForSale},
            {...daoUser, ...auctionObj}
        ));
        let txId = await provider.send(tx, [daoUser.userKeypair], {skipPreflight: true});

        let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, daoUser.openOrders);
        console.log(JSON.stringify(thisOpenOrders, null, 2));
        assert.isTrue(thisOpenOrders.numOrders == 1, "check the order has been placed");
        assert.isTrue(thisOpenOrders.baseTokenLocked.eq(numTokensForSale), "all the tokens are locked up");
    });

    it("generate a bunch of users, open orders accounts and new orders", async() => {
        let auctionObj = await fetchAuctionObj(program, provider, wallet.publicKey, auctionId);

        console.log("Create Users");
        let tempUsers: Array<Promise<User>>;
        let thisSide = new genTypes.Side.Bid();
        for (let bigIter = 0; bigIter < numUsers; bigIter+=groupedNum) {
            tempUsers = []
            let startTime = Date.now();
            for (let thisUser = 0; thisUser < groupedNum; thisUser++) {
                tempUsers.push(initUser(program, provider, wallet, auctionObj, thisSide, new anchor.BN(0), defaultUserUsdc, maxOrders));
            }
            users.push(...await Promise.all(tempUsers));
            console.log(groupedNum, "users created in", (Date.now() - startTime)/1000, "seconds");
        }

        console.log("Create open orders accounts");
        let tempOpenOrders: Array<Promise<String>> = [];
        let startTime = Date.now();
        for (let thisUser = 0; thisUser < numUsers; thisUser += 1) {
            let tx = new anchor.web3.Transaction;
            tx.add(genInstr.initOpenOrders(
                {...users[thisUser]}, {...users[thisUser], ...auctionObj}
            ));
            tempOpenOrders.push(provider.send(tx, [users[thisUser].userKeypair], {skipPreflight: true}));
            if (thisUser % groupedNum == groupedNum - 1 ){
                await Promise.all(tempOpenOrders);
                console.log(tempOpenOrders.length, "open order accounts created in", (Date.now() - startTime)/1000, "seconds");
                startTime = Date.now();
                tempOpenOrders = [];
            }
        }

        startTime = Date.now();
        let numOrders = 0;
        let tempOrders: Array<Promise<String>> = []; 
        for (let user of users) {
            if (Date.now() / 1000  > auctionObj.endOrderPhase.toNumber()) {
                await Promise.all(tempOrders);
                console.log(tempOrders.length, "orders in", (Date.now() - startTime)/1000);
                console.log(numOrders, "orders in total");
                break
            }
            let thisPriceNum = Math.random() * (maxPrice - minPrice) + minPrice;
            let priceBuffer = toFpLimitPrice(thisPriceNum, tickSizeNum).toBuffer('le', 8);
            // This max base qty calc could be done less awkwardly for sure
            let maxBaseQty = new BN(Math.random() * (defaultUserUsdc.toNumber() / thisPriceNum - minBaseOrderSize.toNumber()) + minBaseOrderSize.toNumber());
            let qtyBuffer = maxBaseQty.toBuffer('le', 8);
            let tokenQty = new BN(maxBaseQty.toNumber() * thisPriceNum);
            let plainText = Buffer.concat([priceBuffer, qtyBuffer]);
            
            let nonce = nacl.randomBytes(nacl.box.nonceLength);
            let cipherText = nacl.box(
                plainText,
                nonce,
                Uint8Array.from(auctionObj.naclPubkey),
                user.naclKeypair.secretKey,
            )

            let tx = new anchor.web3.Transaction;
            tx.add(genInstr.newEncryptedOrder(
                {tokenQty, naclPubkey: user.naclPubkey, nonce: Array.from(nonce), cipherText: Array.from(cipherText)},
                {...user, ...auctionObj}
            ));

            tempOrders.push(provider.send(tx, [user.userKeypair], {skipPreflight: true}));
            numOrders += 1
            await sleep(0.11, false);
            if (numOrders % groupedNum == 0){
                await Promise.all(tempOrders);
                console.log(tempOrders.length, "orders in", (Date.now() - startTime)/1000);
                console.log(numOrders, "orders in total");
                tempOrders = [];
                startTime = Date.now();
            }
        }

        let numCheckedUsers = 0
        for (let user of users) {
            let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, user.openOrders);
            assert.isTrue(thisOpenOrders.encryptedOrders.length == 1, "checking all the orders have been placed");
            assert.isTrue(thisOpenOrders.quoteTokenLocked.gt(new BN(0)), "check the money went in lol, can't trust AOB anymore");
            numCheckedUsers++
            if (numCheckedUsers >= numOrders) {
                break
            }
        }
    });

    it("decrypt a bunch of open orders", async() => {
        let auctionObj = await fetchAuctionObj(program, provider, wallet.publicKey, auctionId, auctionNaclKeypair);

        let remainingTimeToDecryption = auctionObj.endOrderPhase.toNumber() - (Date.now() / 1000);
        if (remainingTimeToDecryption > 0) {
          await sleep(remainingTimeToDecryption + 1);
        }

        // TODO put this into a function
        let fetchedUsers = await fetchUsers(program, provider, auctionObj, {onlyEncrypted: true});

        let numDecryptedUsers = 0;
        let tempDecryptInstrs: Array<Promise<String>> = [];
        let startTime = Date.now();
        for (let user of fetchedUsers) {
            if (Date.now() / 1000  > auctionObj.endDecryptionPhase.toNumber()) {
                console.log("Decryption phase has ended");
                await Promise.all(tempDecryptInstrs);
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
            tempDecryptInstrs.push(provider.send(tx));
            numDecryptedUsers += 1

            if (numDecryptedUsers % groupedNum == 0){
                await Promise.all(tempDecryptInstrs);
                console.log(tempDecryptInstrs.length, "open order accounts decrypted in", (Date.now() - startTime)/1000);
                console.log(numDecryptedUsers, "open order accounts in total");
                tempDecryptInstrs = [];
                startTime = Date.now();
            }
        }

        for (let user of fetchedUsers) {
            let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, user.openOrders);
            // TODO it's possible that there are certain open orders accounts which cannot be decrypted
            // These shouldn't still be in the list of fetchedUsers and we might even benefit from having
            // a flag to indicate that the orders failed.
            assert.isTrue(thisOpenOrders.encryptedOrders.length == 0, "checking all the orders have been decrypted");
            assert.isTrue(thisOpenOrders.numOrders > 0, "checking that the orders have actually hit the book");
        }
    });

    it("Crank that will find the clearing price for the auction", async() => {
        let auctionObj = await fetchAuctionObj(program, provider, wallet.publicKey, auctionId);
        let remainingTimeToClearing = auctionObj.endDecryptionPhase.toNumber() - (Date.now() / 1000);
        if (remainingTimeToClearing > 0) {
            await sleep(remainingTimeToClearing + 1);
        }

        await calcClearingPriceCrank(provider, wallet, auctionObj, 1);

        let thisAuction = await genAccs.Auction.fetch(provider.connection, auctionObj.auction);
        console.log(JSON.stringify(thisAuction, null, 2));
        assert.isTrue(thisAuction.hasFoundClearingPrice, "checking the clearing price has been found");
        assert.isTrue(thisAuction.clearingPrice.toNumber() / (2 ** 32) >= minSalePrice, "check the clearing price is valid, assuming valid orders were placed");
        assert.isTrue(thisAuction.totalQuantityMatched.toNumber() > 0, "check the quantity matched is valid, assuming valid orders were placed");
    });

    it("Match orders at the clearing price and total quantity matched, then remove them from order book", async() => {
        let auctionObj = await fetchAuctionObj(program, provider, wallet.publicKey, auctionId);
        let thisAuction = await genAccs.Auction.fetch(provider.connection, auctionObj.auction);
        assert.isTrue(thisAuction.hasFoundClearingPrice, "checking the clearing price has been found");

        await matchOrdersCrank(provider, wallet, auctionObj, 20);
        thisAuction = await genAccs.Auction.fetch(provider.connection, auctionObj.auction);
        assert.isTrue(thisAuction.remainingAskFills.toNumber() == 0, "check the entire matched quantity has been processed");
        assert.isTrue(thisAuction.remainingBidFills.toNumber() == 0, "check the entire matched quantity has been processed");
        // TODO could also add a check that the order book is empty but we haven't spent any time messing around with AOB ts stuff yet.
    });

    it("Consume events", async() => {
        let auctionObj = await fetchAuctionObj(program, provider, wallet.publicKey, auctionId);

        // This is the start of the function
        let numEventsToConsume = 10; // Bounded more by the maximum number possible pubkeys in the transaction bytes
        let thisAuction = await genAccs.Auction.fetch(provider.connection, auctionObj.auction);

        while (true) {
            let thisEventQueue = await EventQueue.load(provider.connection, thisAuction.eventQueue, 32);
            if (thisEventQueue.header.count.toNumber() == 0) {
                console.log("no events on the event queue to consume");
                break
                // return true
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
                    // if (e.toString().include("Invalid data provided")) {
                    //     console.log("no more events left on the event queue once these", idx, "events are consumed");
                    // }
                    break
                    // return false
                }
            }
            console.log(JSON.stringify(Array.from(pubkeyStrs), null, 2));
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
            await provider.send(tx, [], {skipPreflight: true});
        }
    });


});