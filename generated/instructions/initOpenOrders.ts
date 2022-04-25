import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface InitOpenOrdersArgs {
  side: types.SideKind
  maxOrders: number
}

export interface InitOpenOrdersAccounts {
  user: PublicKey
  auction: PublicKey
  openOrders: PublicKey
  orderHistory: PublicKey
  quoteMint: PublicKey
  baseMint: PublicKey
  userQuote: PublicKey
  userBase: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([
  types.Side.layout("side"),
  borsh.u8("maxOrders"),
])

export function initOpenOrders(
  args: InitOpenOrdersArgs,
  accounts: InitOpenOrdersAccounts
) {
  const keys = [
    { pubkey: accounts.user, isSigner: true, isWritable: true },
    { pubkey: accounts.auction, isSigner: false, isWritable: false },
    { pubkey: accounts.openOrders, isSigner: false, isWritable: true },
    { pubkey: accounts.orderHistory, isSigner: false, isWritable: true },
    { pubkey: accounts.quoteMint, isSigner: false, isWritable: false },
    { pubkey: accounts.baseMint, isSigner: false, isWritable: false },
    { pubkey: accounts.userQuote, isSigner: false, isWritable: false },
    { pubkey: accounts.userBase, isSigner: false, isWritable: false },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([230, 167, 76, 177, 168, 44, 155, 13])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      side: args.side.toEncodable(),
      maxOrders: args.maxOrders,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data })
  return ix
}
