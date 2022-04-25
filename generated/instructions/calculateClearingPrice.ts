import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface CalculateClearingPriceArgs {
  limit: number
}

export interface CalculateClearingPriceAccounts {
  auction: PublicKey
  bids: PublicKey
  asks: PublicKey
}

export const layout = borsh.struct([borsh.u16("limit")])

export function calculateClearingPrice(
  args: CalculateClearingPriceArgs,
  accounts: CalculateClearingPriceAccounts
) {
  const keys = [
    { pubkey: accounts.auction, isSigner: false, isWritable: true },
    { pubkey: accounts.bids, isSigner: false, isWritable: false },
    { pubkey: accounts.asks, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([250, 1, 132, 200, 99, 19, 181, 40])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      limit: args.limit,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data })
  return ix
}
