import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { Program, ProgramError } from "@project-serum/anchor";
import { createAssociatedTokenAccount, createMint, createMintToCheckedInstruction, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AuctionHouse } from "../target/types/auction_house";
import { PublicKey, Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

import * as genInstr from "../generated/instructions";
import * as genTypes from "../generated/types";
import * as genAccs from "../generated/accounts";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
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
  const tickSize = toFp32(0.1);
  const eventQueueBytes = 1000000;
  const bidsBytes = 64000;
  const asksBytes = 64000;
  
  let auction: Auction;
  let users: Array<User>;
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
      endOrderPhase: nowBn.add(new anchor.BN(5)),
      endDecryptionPhase: nowBn.add(new anchor.BN(10)),
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
    userBase: PublicKey,
    userQuote: PublicKey,
    naclPubkey: Uint8Array,
    naclKeypair?: nacl.BoxKeyPair,
    side: genTypes.SideKind,
    maxOrders: BN,
  }

  async function initUser(provider: anchor.Provider, wallet: anchor.Wallet, auction: Auction, side: genTypes.SideKind, numBaseTokens: BN, numQuoteTokens: BN): Promise<User>  {
    let userKeypair = new anchor.web3.Keypair();
    let user = userKeypair.publicKey;
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
    let [openOrders] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [user.toBuffer(), Buffer.from("open_orders"), auction.startOrderPhase.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let naclKeypair = nacl.box.keyPair();
    let naclPubkey = naclKeypair.publicKey;
    return {
      userKeypair,
      user,
      openOrders,
      userBase,
      userQuote,
      naclKeypair,
      naclPubkey,
      side,
      maxOrders: new anchor.BN(3)
    }
  }

  function toFp32(num: number): BN {
    return new BN(Math.floor(num * 2 ** 32));
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

});
