import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface SettleAndCloseOpenOrdersAccounts {
  user: PublicKey
  auction: PublicKey
  openOrders: PublicKey
  orderHistory: PublicKey
  quoteVault: PublicKey
  baseVault: PublicKey
  quoteMint: PublicKey
  baseMint: PublicKey
  userQuote: PublicKey
  userBase: PublicKey
  systemProgram: PublicKey
  tokenProgram: PublicKey
}

export function settleAndCloseOpenOrders(
  accounts: SettleAndCloseOpenOrdersAccounts
) {
  const keys = [
    { pubkey: accounts.user, isSigner: false, isWritable: true },
    { pubkey: accounts.auction, isSigner: false, isWritable: false },
    { pubkey: accounts.openOrders, isSigner: false, isWritable: true },
    { pubkey: accounts.orderHistory, isSigner: false, isWritable: true },
    { pubkey: accounts.quoteVault, isSigner: false, isWritable: true },
    { pubkey: accounts.baseVault, isSigner: false, isWritable: true },
    { pubkey: accounts.quoteMint, isSigner: false, isWritable: false },
    { pubkey: accounts.baseMint, isSigner: false, isWritable: false },
    { pubkey: accounts.userQuote, isSigner: false, isWritable: true },
    { pubkey: accounts.userBase, isSigner: false, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([224, 158, 68, 49, 222, 197, 3, 235])
  const data = identifier
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data })
  return ix
}
