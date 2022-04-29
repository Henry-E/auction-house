import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccount, createMint, createMintToCheckedInstruction, getAccount, getMint, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import nacl from "tweetnacl";
import { AuctionHouse } from "../../target/types/auction_house";
import * as genTypes from "../../generated/types";
import { Auction } from "./auction";

export interface User {
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

export async function initUser(program: anchor.Program<AuctionHouse>, provider: anchor.Provider, wallet: anchor.Wallet, auction: Auction, side: genTypes.SideKind, numBaseTokens: BN, numQuoteTokens: BN, maxOrders: BN): Promise<User>  {
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
      [user.toBuffer(), Buffer.from("open_orders"), Buffer.from(auction.auctionId), wallet.publicKey.toBuffer()],
      program.programId
    );
    let [orderHistory] = await anchor.web3.PublicKey.findProgramAddress(
      [user.toBuffer(), Buffer.from("order_history"), Buffer.from(auction.auctionId), wallet.publicKey.toBuffer()],
      program.programId
    );
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
      maxOrders,
    }
  }
