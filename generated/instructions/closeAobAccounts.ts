import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface CloseAobAccountsAccounts {
  auctioneer: PublicKey
  auction: PublicKey
  eventQueue: PublicKey
  bids: PublicKey
  asks: PublicKey
}

export function closeAobAccounts(accounts: CloseAobAccountsAccounts) {
  const keys = [
    { pubkey: accounts.auctioneer, isSigner: false, isWritable: true },
    { pubkey: accounts.auction, isSigner: false, isWritable: true },
    { pubkey: accounts.eventQueue, isSigner: false, isWritable: true },
    { pubkey: accounts.bids, isSigner: false, isWritable: true },
    { pubkey: accounts.asks, isSigner: false, isWritable: true },
  ]
  const identifier = Buffer.from([91, 94, 95, 44, 180, 26, 236, 10])
  const data = identifier
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data })
  return ix
}
