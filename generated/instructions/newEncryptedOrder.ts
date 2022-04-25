import { TransactionInstruction, PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface NewEncryptedOrderArgs {
  tokenQty: BN
  publicKey: Array<number>
  nonce: Array<number>
  cipherText: Array<number>
}

export interface NewEncryptedOrderAccounts {
  user: PublicKey
  auction: PublicKey
  openOrders: PublicKey
  quoteMint: PublicKey
  baseMint: PublicKey
  userQuote: PublicKey
  userBase: PublicKey
  quoteVault: PublicKey
  baseVault: PublicKey
  tokenProgram: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("tokenQty"),
  borsh.vecU8("publicKey"),
  borsh.vecU8("nonce"),
  borsh.vecU8("cipherText"),
])

export function newEncryptedOrder(
  args: NewEncryptedOrderArgs,
  accounts: NewEncryptedOrderAccounts
) {
  const keys = [
    { pubkey: accounts.user, isSigner: true, isWritable: false },
    { pubkey: accounts.auction, isSigner: false, isWritable: true },
    { pubkey: accounts.openOrders, isSigner: false, isWritable: true },
    { pubkey: accounts.quoteMint, isSigner: false, isWritable: false },
    { pubkey: accounts.baseMint, isSigner: false, isWritable: false },
    { pubkey: accounts.userQuote, isSigner: false, isWritable: true },
    { pubkey: accounts.userBase, isSigner: false, isWritable: true },
    { pubkey: accounts.quoteVault, isSigner: false, isWritable: true },
    { pubkey: accounts.baseVault, isSigner: false, isWritable: true },
    { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([152, 240, 109, 44, 124, 106, 29, 65])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      tokenQty: args.tokenQty,
      publicKey: Buffer.from(args.publicKey),
      nonce: Buffer.from(args.nonce),
      cipherText: Buffer.from(args.cipherText),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId: PROGRAM_ID, data })
  return ix
}
