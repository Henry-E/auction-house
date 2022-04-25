import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface DecryptOrderArgs {
  secretKey: Array<number>
}

export interface DecryptOrderAccounts {
  auctioneer: PublicKey
  auction: PublicKey
  openOrders: PublicKey
  eventQueue: PublicKey
  bids: PublicKey
  asks: PublicKey
}

export const layout = borsh.struct([borsh.vecU8("secretKey")])

export function decryptOrder(
  args: DecryptOrderArgs,
  accounts: DecryptOrderAccounts
) {
  const keys = [
    { pubkey: accounts.auctioneer, isSigner: true, isWritable: false },
    { pubkey: accounts.auction, isSigner: false, isWritable: true },
    { pubkey: accounts.openOrders, isSigner: false, isWritable: true },
    { pubkey: accounts.eventQueue, isSigner: false, isWritable: true },
    { pubkey: accounts.bids, isSigner: false, isWritable: true },
    { pubkey: accounts.asks, isSigner: false, isWritable: true },
  ]
  const identifier = Buffer.from([152, 52, 238, 90, 73, 36, 184, 48])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      secretKey: Buffer.from(args.secretKey),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data })
  return ix
}
