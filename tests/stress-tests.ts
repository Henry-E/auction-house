import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { AuctionHouse } from "../target/types/auction_house";
import {Auction, initAuctionObj, User, initUser, toFp32, toFpLimitPrice, getCreateAccountParams, sleep} from "./sdk";

import * as genInstr from "../generated/instructions";
import * as genTypes from "../generated/types";
import * as genAccs from "../generated/accounts";
import { Transaction } from "@solana/web3.js";
import { assert, expect } from "chai";

/// Yes, yes. I know it's dumb to do this typescript and not rust
describe("stress-tests", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.Provider.env();
    const wallet = provider.wallet as anchor.Wallet;
    anchor.setProvider(provider);
    const program = anchor.workspace.AuctionHouse as Program<AuctionHouse>;

    const auctionId = Array.from(Buffer.from("321".padEnd(10))); // Can be up to 10 characters long
    const areAsksEncrypted = false;
    const areBidsEncrypted = false;
    const minBaseOrderSize = new BN(1000);
    const tickSizeNum = 0.1;
    const tickSize = toFp32(tickSizeNum);
    const decryptionPhaseLength = 0;
    const eventQueueBytes = 1000000;
    
    let auction: Auction;
    let users: Array<User> = [];
    let numUsers = 300;
    let groupedNum = 50;
    const orderPhaseLength = 310;
    let maxNumOrders = 500;
    // const bidsBytes = 10_000;
    const bidsBytes = (104 + (80+32) * maxNumOrders);
    const asksBytes = bidsBytes;
    let maxOrders = new BN(5);

    let minPrice = 0.7;
    let maxPrice = 1.5;

    it("create auction and generate a bunch of users", async() => {
        auction = await initAuctionObj(program, provider, wallet, auctionId, areAsksEncrypted, areBidsEncrypted, minBaseOrderSize, tickSize, orderPhaseLength, decryptionPhaseLength);
        let tx = new anchor.web3.Transaction;
        let eventQueueParams = await getCreateAccountParams(program, provider, wallet, auction.eventQueue, eventQueueBytes);
        tx.add(anchor.web3.SystemProgram.createAccount(eventQueueParams));
        let bidsParams = await getCreateAccountParams(program, provider, wallet, auction.bids, bidsBytes);
        tx.add(anchor.web3.SystemProgram.createAccount(bidsParams));
        let asksParams = await getCreateAccountParams(program, provider, wallet, auction.asks, asksBytes);
        tx.add(anchor.web3.SystemProgram.createAccount(asksParams));
        tx.add(genInstr.initAuction(
        {args: {...auction}}, {...auction}
        ));
        await provider.send(tx, [auction.eventQueueKeypair, auction.bidsKeypair, auction.asksKeypair]);

        console.log("Create users");
        let tempUsers: Array<Promise<User>> = []
        let sides = [new genTypes.Side.Ask(), new genTypes.Side.Bid()];
        // let sides = new genTypes.Side.Ask();
        for (let bigIter = 0; bigIter < numUsers; bigIter+=groupedNum) {
            let startTime = Date.now();
            for (let thisUser = 0; thisUser < groupedNum; thisUser++) {
                // let thisSide = sides[Math.floor(Math.random()*sides.length)];
                // let's try to do an even split of bids and asks
                let thisSide: genTypes.SideKind;
                if (bigIter < numUsers/2){
                    thisSide = sides[0];
                } else {
                    thisSide = sides[1];
                }
                tempUsers.push(initUser(program, provider, wallet, auction, thisSide, new anchor.BN(1000_000_000), new anchor.BN(1000_000_000), maxOrders));
            }
            users = await Promise.all(tempUsers);
            console.log(groupedNum, " users created in ", (Date.now() - startTime)/1000, " seconds");
        }

        console.log("Create open orders accounts");
        let waitForInitOpenOrders: Array<Promise<String>> = [];
        let startTime = Date.now();
        for (let thisUser = 0; thisUser < numUsers; thisUser += 1) {
            // for (let thisUser = bigIter; thisUser < groupedNum; thisUser++) {
            // console.log(thisUser);
            tx = new anchor.web3.Transaction;
            tx.add(genInstr.initOpenOrders(
            {...users[thisUser]}, {...users[thisUser], ...auction}
            ));
            waitForInitOpenOrders.push(provider.send(tx, [users[thisUser].userKeypair], {skipPreflight: true}));
            if (thisUser % groupedNum == 0 ){
                await Promise.all(waitForInitOpenOrders);
                console.log(groupedNum, " users created in ", (Date.now() - startTime)/1000, " seconds");
                startTime = Date.now();
            }
        }
    });

    it("generates a bunch of new orders", async() => { 
        let startTime = Date.now();
        let numUsers = 0;
        let numOrders = 0;
        let allTheOrders: Array<Promise<String>> = []; 
        let displayedAskUser = false;
        let displayedBidUser = false;
        for (let user of users) {
            for (let thisOrder = 0; thisOrder < maxOrders.toNumber(); thisOrder++){
                if (Date.now() / 1000  > auction.endOrderPhase) {
                    break
                }
                let thisPrice: number;
                // Set it up so that all ask orders are for less than the bid orders
                let midPointPrice = (maxPrice - minPrice) / 2;
                let thisAskSide = new genTypes.Side.Ask();
                if (user.side === thisAskSide){
                    if (!displayedAskUser) {
                        console.log("Ask user, price", thisPrice);
                        console.log(JSON.stringify(user, null, 2));
                        displayedAskUser = true;
                    }
                    thisPrice = (Math.random() * (midPointPrice - minPrice + 1) + minPrice);
                } else {
                    thisPrice = (Math.random() * (maxPrice - midPointPrice + 1) + midPointPrice);
                    if (!displayedBidUser) {
                        console.log("Bid user, price", thisPrice);
                        console.log(JSON.stringify(user, null, 2));
                        displayedBidUser = true;
                    }
                }
                let tx = new anchor.web3.Transaction;
                tx.add(genInstr.newOrder(
                  {limitPrice: toFpLimitPrice(thisPrice, tickSizeNum), maxBaseQty: new BN(1_000_000)},
                  {...user, ...auction}
                ));
                allTheOrders.push(provider.send(tx, [user.userKeypair], {skipPreflight: true}));
                await sleep(0.11, false);
            }
            // if (numUsers % groupedNum == 0 ){
            console.log(allTheOrders.length, "orders in", (Date.now() - startTime)/1000);
            console.log(numOrders, "orders in total");
            // await sleep(1.3);
            // await Promise.all(allTheOrders);
            // console.log(groupedNum * maxOrders.toNumber(), " orders created in ", (Date.now() - startTime)/1000, " seconds");
            startTime = Date.now();
            allTheOrders = [];
            // }
            numOrders += 5
        }
    });

    it("Tries to find the price that will clear the order book", async() => {
        let remainingTimeToClearing = auction.endDecryptionPhase - (Date.now() / 1000);
        if (remainingTimeToClearing > 0) {
            await sleep(remainingTimeToClearing + 1);
        }
        let limit = 1;
        // for (var m = 0; m < 5; m++) {
        while(true) {
            try {
                let tx = new anchor.web3.Transaction;
                tx.add(genInstr.calculateClearingPrice(
                {limit: new BN(limit)},
                {...auction}
                ));
                await provider.send(tx, [], {skipPreflight: true});
                // limit -= 5;
                // if (limit <= 0) {
                //     limit = 1;
                //     // break
                // }
            } catch (e) {
                // console.log(e)
                break
            }
        }
        let thisAuction = await genAccs.Auction.fetch(provider.connection ,auction.auction);
        // console.log(JSON.stringify(thisAuction, null, 2));
        assert.isTrue(thisAuction.hasFoundClearingPrice, "Auction has found clearing price");

    });

    it("Tries to clear the order book by matching orders at the clearing price", async() => {
        let limit = 50;
        while(true) {
            try {
                let tx = new anchor.web3.Transaction;
                tx.add(genInstr.matchOrders(
                {limit: new BN(limit)},
                {...auction}
                ));
                await provider.send(tx, [], {skipPreflight: true});
            } catch (e) {
                // console.log(e)
                break
            }
        }
    });

});