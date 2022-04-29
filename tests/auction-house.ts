import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { Program, ProgramError } from "@project-serum/anchor";
import { createAssociatedTokenAccount, createMint, createMintToCheckedInstruction, getAccount, getMint, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AuctionHouse } from "../target/types/auction_house";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import nacl from "tweetnacl";

import * as genInstr from "../generated/instructions";
import * as genTypes from "../generated/types";
import * as genAccs from "../generated/accounts";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { assert, expect } from "chai";
import { fromCode } from "../generated/errors";
// import { Side } from "../generated/types";
import {Auction, initAuctionObj, User, initUser, toFp32, toFpLimitPrice, getCreateAccountParams, sleep} from "./sdk";

describe("auction-house", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  const wallet = provider.wallet as anchor.Wallet;
  anchor.setProvider(provider);
  const program = anchor.workspace.AuctionHouse as Program<AuctionHouse>;

  // This is probably a dumb way of doing this, the issue is that auctionId
  // is supposed to be an Array<number> in the InitAuctionArgs/Accounts but a
  // Uint8Array in the seeds
  const auctionId = Array.from(Buffer.from("123".padEnd(10))); // Can be up to 10 characters long
  const areAsksEncrypted = false;
  const areBidsEncrypted = true;
  const minBaseOrderSize = new BN(1000);
  const tickSizeNum = 0.1;
  const tickSize = toFp32(tickSizeNum);
  const orderPhaseLength = 8;
  const decryptionPhaseLength = 2;
  const eventQueueBytes = 1000000;
  const bidsBytes = 64000;
  const asksBytes = 64000;
  const maxOrders = new BN(2);
  
  let auction: Auction;
  let users: Array<User> = [];

  it("inits the auction", async() => {
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

    let thisAuction = await genAccs.Auction.fetch(provider.connection, auction.auction);
    assert.isTrue(thisAuction.auctionId.toString() == auctionId.toString(), "auction Ids match");
    assert.isTrue(thisAuction.authority.toString() == wallet.publicKey.toString(), "authorities match");
  });

  it("init open orders", async() => {
    let thisAskUser = await initUser(program, provider, wallet, auction, new genTypes.Side.Ask(), new anchor.BN(3_000_000), new anchor.BN(0), maxOrders);
    let thisBidUser = await initUser(program, provider, wallet, auction, new genTypes.Side.Bid(), new anchor.BN(0), new anchor.BN(2_200_000), maxOrders);
    users.push(thisAskUser, thisBidUser);
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.initOpenOrders(
      {...thisAskUser}, {...thisAskUser, ...auction}
    ));
    await provider.send(tx, [thisAskUser.userKeypair], {skipPreflight: true});
    tx = new anchor.web3.Transaction;
    tx.add(genInstr.initOpenOrders(
      {...thisBidUser}, {...thisBidUser, ...auction}
    ));
    await provider.send(tx, [thisBidUser.userKeypair], {skipPreflight: true});

    let askOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisAskUser.openOrders);
    let bidOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisBidUser.openOrders);
    assert.isTrue(askOpenOrders.authority.toString() == thisAskUser.user.toString(), "check ask open orders init correctly");
    assert.isTrue(bidOpenOrders.authority.toString() == thisBidUser.user.toString(), "check bid open orders init correctly");
  });

  it("places new orders", async() => {
    let thisAskUser = users[0];
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.newOrder(
      {limitPrice: toFpLimitPrice(0.9, tickSizeNum), maxBaseQty: new BN(1_000_000)},
      {...thisAskUser, ...auction}
    ));
    tx.add(genInstr.newOrder(
      {limitPrice: toFpLimitPrice(0.9, tickSizeNum), maxBaseQty: new BN(1_000_000)},
      {...thisAskUser, ...auction}
    ));
    await provider.send(tx, [thisAskUser.userKeypair], {skipPreflight: true});

    let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisAskUser.openOrders);
    assert.isTrue(thisOpenOrders.numOrders == 2, "check both orders have been placed");
  });

  it("cancels an order", async() => {
    let thisAskUser = users[0];
    let tx = new anchor.web3.Transaction;
    let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisAskUser.openOrders);
    let orderId = thisOpenOrders.orders[0];
    console.log(thisOpenOrders.baseTokenLocked.toString());
    tx.add(genInstr.cancelOrder(
      {orderId},
      {...thisAskUser, ...auction}
    ));
    await provider.send(tx, [thisAskUser.userKeypair], {skipPreflight: true});
    thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisAskUser.openOrders);
    console.log(await provider.connection.getTokenAccountBalance(thisAskUser.userBase));

    assert.isTrue(thisOpenOrders.numOrders == 1, "check the order has been cancelled");
  });

  it("new encrypted order", async() => {
    let thisBidUser = users[1];
    let nonce_1 = nacl.randomBytes(nacl.box.nonceLength);
    let nonce_2 = nacl.randomBytes(nacl.box.nonceLength);
    let priceNum = 1.1;
    let price = toFpLimitPrice(priceNum, tickSizeNum);
    let priceBuffer = price.toBuffer('le', 8);
    let quantityNum = 1_000_000;
    let quantity = new BN(quantityNum);
    let quantityBuffer = quantity.toBuffer('le', 8);
    let tokenQty = new BN(quantityNum * priceNum);
    let plainText = Buffer.concat([priceBuffer, quantityBuffer]);
    let cipherText_1 = nacl.box(
      plainText,
      nonce_1,
      Uint8Array.from(auction.naclPubkey),
      thisBidUser.naclKeypair.secretKey,
    )
    let cipherText_2 = nacl.box(
      plainText,
      nonce_2,
      Uint8Array.from(auction.naclPubkey),
      thisBidUser.naclKeypair.secretKey,
    )
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.newEncryptedOrder(
      {tokenQty, naclPubkey: thisBidUser.naclPubkey, nonce: Array.from(nonce_1), cipherText: Array.from(cipherText_1)},
      {...thisBidUser, ...auction}
    ));
    tx.add(genInstr.newEncryptedOrder(
      {tokenQty, naclPubkey: thisBidUser.naclPubkey, nonce: Array.from(nonce_2), cipherText: Array.from(cipherText_2)},
      {...thisBidUser, ...auction}
    ));
    await provider.send(tx, [thisBidUser.userKeypair], {skipPreflight: true});

    let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisBidUser.openOrders);
    assert.isTrue(thisOpenOrders.numOrders == 2, "check the orders have been added");
  });

  it("cancel encrypted order", async() => {
    let thisBidUser = users[1];
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.cancelEncryptedOrder(
      {orderIdx: new BN(0)},
      {...thisBidUser, ...auction}
    ));
    await provider.send(tx, [thisBidUser.userKeypair], {skipPreflight: true});

    let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisBidUser.openOrders);
    assert.isTrue(thisOpenOrders.numOrders == 1,  "check the orders have been added");
  });

  it("decrypts order", async() => {
    // TODO should we rename arg from secretKey to sharedKey?
    let thisBidUser = users[1];
    const sharedKey = Array.from(nacl.box.before(
      Uint8Array.from(thisBidUser.naclPubkey),
      auction.naclKeypair.secretKey
    ));
    let remainingTimeToDecryption = auction.endOrderPhase - (Date.now() / 1000);
    if (remainingTimeToDecryption > 0) {
      await sleep(remainingTimeToDecryption + 1);
    }
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.decryptOrder(
      {sharedKey},
      {...thisBidUser, ...auction}
    ));
    await provider.send(tx, [], {skipPreflight: true});

    let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisBidUser.openOrders);
    assert.isTrue(thisOpenOrders.encryptedOrders.length == 0, "check that the encrypted orders have been cleared out");
    assert.isTrue(thisOpenOrders.orders.length == 1,  "check the order has been added to the order book");
  });

  it("calculates the clearing price", async() => {
    let remainingTimeToClearing = auction.endDecryptionPhase - (Date.now() / 1000);
    if (remainingTimeToClearing > 0) {
      await sleep(remainingTimeToClearing + 1);
    }
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.calculateClearingPrice(
      {limit: new BN(10)},
      {...auction}
    ));
    await provider.send(tx, [], {skipPreflight: true});
    let thisAuction = await genAccs.Auction.fetch(provider.connection ,auction.auction);
    assert.isTrue(thisAuction.hasFoundClearingPrice, "Auction has found clearing price");
  });

  it("matches the price", async() => {
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.matchOrders(
      {limit: new BN(10)},
      {...auction}
    ));
    tx.add(genInstr.matchOrders(
      {limit: new BN(10)},
      {...auction}
    ));
    await provider.send(tx, [], {skipPreflight: true});
    let thisAuction = await genAccs.Auction.fetch(provider.connection ,auction.auction);
    assert.isTrue(thisAuction.remainingBidFills.eq(new BN(0)), "Bid orders filled");
    assert.isTrue(thisAuction.remainingAskFills.eq(new BN(0)), "Ask orders filled");
  });

  it("consumes events", async() => {
    let tx = new anchor.web3.Transaction;
    let thisInstr = genInstr.consumeEvents(
      {limit: new BN(10), allowNoOp: false},
      {...auction}
    );
    // This is how we add remaining accounts to the transaction instruction
    thisInstr.keys = thisInstr.keys.concat([
      {pubkey: users[0].openOrders, isSigner: false, isWritable: true},
      {pubkey: users[1].openOrders, isSigner: false, isWritable: true},
    ]);
    tx.add(thisInstr);
    await provider.send(tx, [], {skipPreflight: true});
    tx = new anchor.web3.Transaction;
    tx.add(genInstr.consumeEvents(
      {limit: new BN(10), allowNoOp: false},
      {...auction}
    ));
    let does_function_error = false;
    try {
      await provider.send(tx);
    } catch(e) {
      // 0x177f Error indicates there are no events left to process
      if (e.toString().includes("0x177f")){
        does_function_error = true;
      }
    }
    assert.isTrue(does_function_error);
  });

  it("settle and closes open orders", async() => {
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.settleAndCloseOpenOrders(
      {...auction, ...users[0]}
    ));
    tx.add(genInstr.settleAndCloseOpenOrders(
      {...auction, ...users[1]}
    ));
    await provider.send(tx, [], {skipPreflight: true});
    console.log(await provider.connection.getTokenAccountBalance(users[0].userBase));
    console.log(await provider.connection.getTokenAccountBalance(users[0].userQuote));
    console.log(await provider.connection.getTokenAccountBalance(users[1].userBase));
    console.log(await provider.connection.getTokenAccountBalance(users[1].userQuote));
  });
  
  it("close the AOB accounts and retrieve rent", async() => {
    let solBefore = await provider.connection.getBalance(wallet.publicKey);
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.closeAobAccounts(
      {...auction}
    ));
    await provider.send(tx, [], {skipPreflight: true});
    let solAfter = await provider.connection.getBalance(wallet.publicKey);
    assert.isTrue(solAfter > solBefore, "checking the Sol balance has increase from reclaiming rent");
  });
});
