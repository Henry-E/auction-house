import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface NewOrderArgs {
  limitPrice: BN
  maxBaseQty: BN
}

export interface NewOrderAccounts {
  user: PublicKey
  auction: PublicKey
  openOrders: PublicKey
  eventQueue: PublicKey
  bids: PublicKey
  asks: PublicKey
  quoteMint: PublicKey
  baseMint: PublicKey
  userQuote: PublicKey
  userBase: PublicKey
  quoteVault: PublicKey
  baseVault: PublicKey
  tokenProgram: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("limitPrice"),
  borsh.u64("maxBaseQty"),
])

export function newOrder(args: NewOrderArgs, accounts: NewOrderAccounts) {
  const keys = [
    { pubkey: accounts.user, isSigner: true, isWritable: false },
    { pubkey: accounts.auction, isSigner: false, isWritable: false },
    { pubkey: accounts.openOrders, isSigner: false, isWritable: true },
    { pubkey: accounts.eventQueue, isSigner: false, isWritable: true },
    { pubkey: accounts.bids, isSigner: false, isWritable: true },
    { pubkey: accounts.asks, isSigner: false, isWritable: true },
    { pubkey: accounts.quoteMint, isSigner: false, isWritable: false },
    { pubkey: accounts.baseMint, isSigner: false, isWritable: false },
    { pubkey: accounts.userQuote, isSigner: false, isWritable: true },
    { pubkey: accounts.userBase, isSigner: false, isWritable: true },
    { pubkey: accounts.quoteVault, isSigner: false, isWritable: true },
    { pubkey: accounts.baseVault, isSigner: false, isWritable: true },
    { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([153, 0, 116, 34, 241, 46, 40, 139])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      limitPrice: args.limitPrice,
      maxBaseQty: args.maxBaseQty,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data })
  return ix
}
