import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { Program, ProgramError } from "@project-serum/anchor";
import { createAssociatedTokenAccount, createMint, createMintToCheckedInstruction, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AuctionHouse } from "../target/types/auction_house";
import { PublicKey, Keypair } from "@solana/web3.js";

import * as genInstructions from "../generated/instructions";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { Side } from "../generated/types";

describe("auction-house", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  const wallet = provider.wallet as anchor.Wallet;
  anchor.setProvider(provider);

  const program = anchor.workspace.AuctionHouse as Program<AuctionHouse>;
  

  // let baseMint, quoteMint;

  // it("Init mints!", async () => {

  //   baseMint = await createMint(provider.connection,
  //       wallet.payer,
  //       wallet.publicKey,
  //       null,
  //       6
  //     );
  //   quoteMint = await createMint(provider.connection,
  //       wallet.payer,
  //       wallet.publicKey,
  //       null,
  //       6
  //     );

  // });

  it("inits the auction", async() => {
    let tx = new anchor.web3.Transaction();
    let nowBn = new anchor.BN(Date.now() / 1000);
    let [auction] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("auction"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let [quoteVault] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("quote_vault"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let [baseVault] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("base_vault"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let eventQueueKeypair = new anchor.web3.Keypair();
    let bidsKeypair = new anchor.web3.Keypair();
    let asksKeypair = new anchor.web3.Keypair();
    // tx.add(genInstructions.initAuction(
    //   {
    //     args: {
    //       startOrderPhase: nowBn,
    //       endOrderPhase: nowBn.add(new anchor.BN(5)),
    //       endDecryptionPhase: nowBn.add(new anchor.BN(10)),
    //       areAsksEncrypted: false,
    //       areBidsEncrypted: true,
    //       minBaseOrderSize: new anchor.BN(0),
    //       tickSize: new anchor.BN(0),
    //     }
    //   },
    //   {
    //     auctioneer: wallet.publicKey,
    //     auction,
    //     eventQueue: eventQueueKeypair.publicKey,
    //     bids: bidsKeypair.publicKey,
    //     asks: asksKeypair.publicKey,
    //     // quoteMint,
    //     // baseMint,
    //     quoteVault,
    //     baseVault,
    //     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //     systemProgram: anchor.web3.SystemProgram.programId,
    //   }
    // ))
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
    startOrderPhase: BN,
    endOrderPhase: BN,
    endDecryptionPhase: BN,
    areAsksEncrypted: boolean,
    areBidsEncrypted: boolean,
    minBaseOrderSize: BN,
    tickSize: BN, // FP32
    // publicEncryptionKey,
    // privateEncryptionKey,
  }

  async function initAuctionObj(provider: anchor.Provider, wallet: anchor.Wallet, areAsksEncrypted: boolean, areBidsEncrypted: boolean, minBaseOrderSize: BN, tickSize: BN): Promise<Auction> {
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
    let [auction] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("auction"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let [quoteVault] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("quote_vault"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let [baseVault] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("base_vault"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let eventQueueKeypair = new anchor.web3.Keypair();
    let eventQueue = eventQueueKeypair.publicKey;
    let bidsKeypair = new anchor.web3.Keypair();
    let bids = bidsKeypair.publicKey;
    let asksKeypair = new anchor.web3.Keypair();
    let asks = asksKeypair.publicKey;
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
      startOrderPhase: nowBn,
      endOrderPhase: nowBn.add(new anchor.BN(5)),
      endDecryptionPhase: nowBn.add(new anchor.BN(10)),
      areAsksEncrypted,
      areBidsEncrypted,
      minBaseOrderSize,
      tickSize,
    }
  }

  interface User {
    userKeypair: Keypair,
    user: PublicKey,
    openOrders: PublicKey,
    userBase: PublicKey,
    userQuote: PublicKey,
    // pub encryption key
    // private encryption key
    // side: ,
    maxOrders: BN,
  }

  async function initUser(provider: anchor.Provider, wallet: anchor.Wallet, auction: Auction, side: any, numBaseTokens: BN, numQuoteTokens: BN): Promise<User>  {
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
    return {
      userKeypair,
      user,
      openOrders,
      userBase,
      userQuote,
      // 
      //
      maxOrders: new anchor.BN(3)
    }
  }

});
