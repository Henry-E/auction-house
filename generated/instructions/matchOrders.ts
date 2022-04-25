import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface MatchOrdersArgs {
  limit: number
}

export interface MatchOrdersAccounts {
  auction: PublicKey
  eventQueue: PublicKey
  bids: PublicKey
  asks: PublicKey
}

export const layout = borsh.struct([borsh.u16("limit")])

export function matchOrders(
  args: MatchOrdersArgs,
  accounts: MatchOrdersAccounts
) {
  const keys = [
    { pubkey: accounts.auction, isSigner: false, isWritable: true },
    { pubkey: accounts.eventQueue, isSigner: false, isWritable: true },
    { pubkey: accounts.bids, isSigner: false, isWritable: true },
    { pubkey: accounts.asks, isSigner: false, isWritable: true },
  ]
  const identifier = Buffer.from([17, 1, 201, 93, 7, 51, 251, 134])
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
