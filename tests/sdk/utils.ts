import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AuctionHouse } from "../../target/types/auction_house";

export function toFp32(num: number): BN {
    return new BN(Math.floor(num * 2 ** 32));
  }

export function toFpLimitPrice(limitPrice: number, tickSize: number): BN {
    let priceMultiple = new BN(Math.floor(limitPrice / tickSize));
    return priceMultiple.mul(toFp32(tickSize));
  }

export async function getCreateAccountParams(program: anchor.Program<AuctionHouse>, provider: anchor.Provider, wallet: anchor.Wallet, newPubkey: PublicKey, space: number): Promise<anchor.web3.CreateAccountParams> {
    let rentExemptionAmount = await provider.connection.getMinimumBalanceForRentExemption(space);
    return {
      fromPubkey: wallet.publicKey,
      newAccountPubkey: newPubkey,
      lamports: rentExemptionAmount,
      space,
      programId: program.programId
    }
  }

export function sleep(seconds: number, print?: boolean) {
    if (print == false) {
    } else {
      console.log("Sleeping for", seconds , " seconds");
    }

    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
