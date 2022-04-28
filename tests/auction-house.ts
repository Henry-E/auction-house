import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { Program, ProgramError } from "@project-serum/anchor";
import { createAssociatedTokenAccount, createMint, createMintToCheckedInstruction, getAccount, getMint, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AuctionHouse } from "../target/types/auction_house";
import { PublicKey, Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

import * as genInstr from "../generated/instructions";
import * as genTypes from "../generated/types";
import * as genAccs from "../generated/accounts";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { assert } from "chai";
import { fromCode } from "../generated/errors";
// import { Side } from "../generated/types";

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
  const eventQueueBytes = 1000000;
  const bidsBytes = 64000;
  const asksBytes = 64000;
  
  let auction: Auction;
  let users: Array<User> = [];
  let startOrderPhase: BN;

  it("inits the auction", async() => {
    auction = await initAuctionObj(provider, wallet, auctionId, areAsksEncrypted, areBidsEncrypted, minBaseOrderSize, tickSize);
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
    let thisAskUser = await initUser(provider, wallet, auction, new genTypes.Side.Ask(), new anchor.BN(2_000_000), new anchor.BN(0));
    let thisBidUser = await initUser(provider, wallet, auction, new genTypes.Side.Bid(), new anchor.BN(0), new anchor.BN(2_200_000));
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
      thisBidUser.naclKeypair.secretKey,
      Uint8Array.from(auction.naclPubkey),
    )
    let cipherText_2 = nacl.box(
      plainText,
      nonce_2,
      thisBidUser.naclKeypair.secretKey,
      Uint8Array.from(auction.naclPubkey),
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
    let remainingTimeToDecryption = (Date.now() / 1000) - auction.endOrderPhase;
    if (remainingTimeToDecryption > 0) {
      await sleep(remainingTimeToDecryption);
    }
    let tx = new anchor.web3.Transaction;
    tx.add(genInstr.decryptOrder(
      {secretKey: sharedKey},
      {...thisBidUser, ...auction}
    ));
    await provider.send(tx, [thisBidUser.userKeypair], {skipPreflight: true});

    let thisOpenOrders = await genAccs.OpenOrders.fetch(provider.connection, thisBidUser.openOrders);
    assert.isTrue(thisOpenOrders.orders.length == 1,  "check the order has been added to the order book");
  });


  interface Auction {
    // Accounts
    auctioneer: PublicKey,
    auction: PublicKey,
    eventQueue: PublicKey,
    eventQueueKeypair: Keypair,
    bids: PublicKey,
    bidsKeypair: Keypair,
    asks: PublicKey,
    asksKeypair: Keypair,
    quoteMint: PublicKey,
    baseMint: PublicKey,
    quoteVault: PublicKey,
    baseVault: PublicKey,
    rent: PublicKey,
    tokenProgram: PublicKey,
    systemProgram: PublicKey,
    // Args
    auctionId: Array<number>,
    startOrderPhase: BN,
    endOrderPhase: BN,
    endDecryptionPhase: BN,
    areAsksEncrypted: boolean,
    areBidsEncrypted: boolean,
    minBaseOrderSize: BN,
    tickSize: BN, // FP32
    naclPubkey: Array<number>,
    naclKeypair?: nacl.BoxKeyPair,
  }

  async function initAuctionObj(provider: anchor.Provider, wallet: anchor.Wallet, auctionId: Array<number>, areAsksEncrypted: boolean, areBidsEncrypted: boolean, minBaseOrderSize: BN, tickSize: BN): Promise<Auction> {
    let baseMint = await createMint(provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
      );
    let quoteMint = await createMint(provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
      );
    let tx = new anchor.web3.Transaction();
    let nowBn = new anchor.BN(Date.now() / 1000);
    // let auctionIdArray = Array.from(auctionId);
    let [auction] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("auction"), Buffer.from(auctionId), wallet.publicKey.toBuffer()],
      program.programId
    )
    let [quoteVault] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("quote_vault"), Buffer.from(auctionId), wallet.publicKey.toBuffer()],
      program.programId
    )
    let [baseVault] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("base_vault"), Buffer.from(auctionId), wallet.publicKey.toBuffer()],
      program.programId
    )
    let eventQueueKeypair = new anchor.web3.Keypair();
    let eventQueue = eventQueueKeypair.publicKey;
    let bidsKeypair = new anchor.web3.Keypair();
    let bids = bidsKeypair.publicKey;
    let asksKeypair = new anchor.web3.Keypair();
    let asks = asksKeypair.publicKey;
    let naclKeypair = nacl.box.keyPair();
    let naclPubkey = Array.from(naclKeypair.publicKey);
    return {
      auctioneer: wallet.publicKey,
      auction,
      eventQueue,
      eventQueueKeypair,
      bids,
      bidsKeypair,
      asks,
      asksKeypair,
      quoteMint,
      baseMint,
      quoteVault,
      baseVault,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      // Args
      auctionId,
      startOrderPhase: nowBn,
      endOrderPhase: nowBn.add(new anchor.BN(10)),
      endDecryptionPhase: nowBn.add(new anchor.BN(15)),
      areAsksEncrypted,
      areBidsEncrypted,
      minBaseOrderSize,
      tickSize,
      naclKeypair,
      naclPubkey,
    }
  }

  interface User {
    userKeypair: Keypair,
    user: PublicKey,
    openOrders: PublicKey,
    orderHistory: PublicKey,
    userBase: PublicKey,
    userQuote: PublicKey,
    naclPubkey: Array<number>,
    naclKeypair?: nacl.BoxKeyPair,
    side: genTypes.SideKind,
    maxOrders: BN,
  }

  async function initUser(provider: anchor.Provider, wallet: anchor.Wallet, auction: Auction, side: genTypes.SideKind, numBaseTokens: BN, numQuoteTokens: BN): Promise<User>  {
    let userKeypair = new anchor.web3.Keypair();
    let user = userKeypair.publicKey;
    await provider.connection.requestAirdrop(user, 1_000_000_00)
    let userBase = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      auction.baseMint,
      user
    );
    let userQuote = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      auction.quoteMint,
      user
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      auction.baseMint,
      userBase,
      wallet.publicKey,
      numBaseTokens.toNumber(),
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      auction.quoteMint,
      userQuote,
      wallet.publicKey,
      numQuoteTokens.toNumber(),
    );
      // [Buffer.from("quote_vault"), Buffer.from(auctionId), wallet.publicKey.toBuffer()],
    let [openOrders] = await anchor.web3.PublicKey.findProgramAddress(
      [user.toBuffer(), Buffer.from("open_orders"), Buffer.from(auctionId), wallet.publicKey.toBuffer()],
      program.programId
    );
    let [orderHistory] = await anchor.web3.PublicKey.findProgramAddress(
      [user.toBuffer(), Buffer.from("order_history"), Buffer.from(auctionId), wallet.publicKey.toBuffer()],
      program.programId
    );
    // Calculation for the space needed in the open orders account
    // varies a lot based on whether accounts are encrypted or not
    // console.log("dumb console log");
    let naclKeypair = nacl.box.keyPair();
    let naclPubkey = Array.from(naclKeypair.publicKey);
    return {
      userKeypair,
      user,
      openOrders,
      orderHistory,
      userBase,
      userQuote,
      naclKeypair,
      naclPubkey,
      side,
      maxOrders: new anchor.BN(2),
    }
  }

  function toFp32(num: number): BN {
    return new BN(Math.floor(num * 2 ** 32));
  }

  function toFpLimitPrice(limitPrice: number, tickSize: number): BN {
    let priceMultiple = new BN(Math.floor(limitPrice / tickSize));
    return priceMultiple.mul(toFp32(tickSize));
  }

  async function getCreateAccountParams(program: anchor.Program<AuctionHouse>, provider: anchor.Provider, wallet: anchor.Wallet, newPubkey: PublicKey, space: number): Promise<anchor.web3.CreateAccountParams> {
    let rentExemptionAmount = await provider.connection.getMinimumBalanceForRentExemption(space);
    return {
      fromPubkey: wallet.publicKey,
      newAccountPubkey: newPubkey,
      lamports: rentExemptionAmount,
      space,
      programId: program.programId
    }
  }

  function sleep(ms: number) {
    console.log("Sleeping for", ms / 1000, "seconds");
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


});
