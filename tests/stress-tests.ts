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
    const orderPhaseLength = 600;
    const decryptionPhaseLength = 0;
    const eventQueueBytes = 1000000;
    const bidsBytes = 64000;
    const asksBytes = 64000;

    let auction: Auction;
    let users: Array<User> = [];
    let numUsers = 100;
    let maxOrders = new BN(7);

    let minPrice = 0.7;
    let maxPrice = 1.5;

    it("generates a lot of orders", async() => {
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
        for (let thisUser = 0; thisUser < numUsers; thisUser++) {
            let thisSide = sides[Math.floor(Math.random()*sides.length)];
            tempUsers.push(initUser(program, provider, wallet, auction, thisSide, new anchor.BN(1000_000_000), new anchor.BN(1000_000_000), maxOrders));
        }
        users = await Promise.all(tempUsers);

        console.log("Create open orders accounts");
        let waitForInitOpenOrders: Array<Promise<String>> = [];
        for (let user of users) {
            tx = new anchor.web3.Transaction;
            tx.add(genInstr.initOpenOrders(
            {...user}, {...user, ...auction}
            ));
            waitForInitOpenOrders.push(provider.send(tx, [user.userKeypair], {skipPreflight: true}));
        }
        await Promise.all(waitForInitOpenOrders);

        console.log("Place 7 orders per user");
        let allTheOrders: Array<Promise<String>> = []; 
        for (let user of users) {
            for (let thisOrder = 0; thisOrder < maxOrders.toNumber(); thisOrder++){
                if (Date.now() / 1000  > auction.endOrderPhase) {
                    break
                }
                let thisPrice = (Math.random() * (maxPrice - minPrice + 1) + minPrice);
                let tx = new anchor.web3.Transaction;
                tx.add(genInstr.newOrder(
                  {limitPrice: toFpLimitPrice(thisPrice, tickSizeNum), maxBaseQty: new BN(1_000_000)},
                  {...user, ...auction}
                ));
                allTheOrders.push(provider.send(tx, [user.userKeypair], {skipPreflight: true}));
            }
        }
    }); 

    it("Tries to clear the order book", async() => {
        let remainingTimeToClearing = auction.endDecryptionPhase - (Date.now() / 1000);
        if (remainingTimeToClearing > 0) {
        await sleep(remainingTimeToClearing + 1);
        }
        for (var m = 0; m < 5; m++) {
            try {
                let tx = new anchor.web3.Transaction;
                tx.add(genInstr.calculateClearingPrice(
                {limit: new BN(100)},
                {...auction}
                ));
                await provider.send(tx, [], {skipPreflight: true});
            } catch (e) {
                console.log(e)
            }
        }
        let thisAuction = await genAccs.Auction.fetch(provider.connection ,auction.auction);
        console.log(JSON.stringify(thisAuction, null, 2));
        assert.isTrue(thisAuction.hasFoundClearingPrice, "Auction has found clearing price");

        // for (var iteration = 0;)

    });

});