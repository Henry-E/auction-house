import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface ConsumeEventsArgs {
  limit: number
  allowNoOp: boolean
}

export interface ConsumeEventsAccounts {
  auction: PublicKey
  eventQueue: PublicKey
}

export const layout = borsh.struct([
  borsh.u16("limit"),
  borsh.bool("allowNoOp"),
])

export function consumeEvents(
  args: ConsumeEventsArgs,
  accounts: ConsumeEventsAccounts
) {
  const keys = [
    { pubkey: accounts.auction, isSigner: false, isWritable: true },
    { pubkey: accounts.eventQueue, isSigner: false, isWritable: true },
  ]
  const identifier = Buffer.from([221, 145, 177, 52, 31, 47, 63, 201])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      limit: args.limit,
      allowNoOp: args.allowNoOp,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data })
  return ix
}
