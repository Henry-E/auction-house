import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAssociatedTokenAccount, mintTo, getAssociatedTokenAddress} from "@solana/spl-token";
import nacl from "tweetnacl";
import { AuctionHouse } from "../../target/types/auction_house";
import * as genTypes from "../../generated/types";
import * as genAccs from "../../generated/accounts";
import { Auction } from "./auction";
import { SSL_OP_NETSCAPE_CA_DN_BUG } from "constants";


export interface User {
    userKeypair?: Keypair,
    user: PublicKey,
    openOrders: PublicKey,
    orderHistory: PublicKey,
    userBase: PublicKey,
    userQuote: PublicKey,
    naclPubkey: Array<number>,
    naclKeypair?: nacl.BoxKeyPair,
    side: genTypes.SideKind,
    maxOrders: number,
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
    if (numBaseTokens.gt(new BN(0))){
      await mintTo(
        provider.connection,
        wallet.payer,
        auction.baseMint,
        userBase,
        wallet.publicKey,
        numBaseTokens.toNumber(),
      );
    }
    if (numQuoteTokens.gt(new BN(0))){
      await mintTo(
        provider.connection,
        wallet.payer,
        auction.quoteMint,
        userQuote,
        wallet.publicKey,
        numQuoteTokens.toNumber(),
      );
    }
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
      maxOrders //: maxOrders.toNumber(), // Some weirdness going on with maxOrder types in the generated client
    }
  }
  export async function fetchUsers(program: anchor.Program<AuctionHouse>, provider: anchor.Provider, auction: Auction, opts?: {onlyEncrypted?: boolean, onlyEmpty?: boolean}): Promise<Array<User>>  {
    const programAccounts = await provider.connection.getParsedProgramAccounts(
      program.programId,
        {
          filters: [
            {
              memcmp: {
                offset: 73,
                bytes: auction.auction.toString(),
              },
            }
          ]
        }
      );
    // console.log(accounts);
    let users: Array<User> = [];
    for (let thisAccount of programAccounts) {
      let thisOpenOrders = genAccs.OpenOrders.decode(thisAccount.account.data as Buffer);
      if (opts.onlyEncrypted && thisOpenOrders.encryptedOrders.length == 0) {
        continue
      }
      if (opts.onlyEmpty && thisOpenOrders.numOrders > 0) {
        continue
      }
      let [orderHistory] = await anchor.web3.PublicKey.findProgramAddress(
        [thisOpenOrders.authority.toBuffer(), Buffer.from("order_history"), Buffer.from(auction.auctionId), auction.auctioneer.toBuffer()],
        program.programId
      );
      let thisUser: User = {
        ...thisOpenOrders,
        openOrders: thisOpenOrders.thisOpenOrders,
        user: thisOpenOrders.authority,
        orderHistory,
        userBase: await getAssociatedTokenAddress(auction.baseMint, thisOpenOrders.authority),
        userQuote: await getAssociatedTokenAddress(auction.quoteMint, thisOpenOrders.authority),
      }
      users.push(thisUser);
    }
    return users
  }