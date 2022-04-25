import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh"

export interface EncryptedOrderFields {
  nonce: Array<number>
  cipherText: Array<number>
  tokenQty: BN
}

export interface EncryptedOrderJSON {
  nonce: Array<number>
  cipherText: Array<number>
  tokenQty: string
}

export class EncryptedOrder {
  readonly nonce: Array<number>
  readonly cipherText: Array<number>
  readonly tokenQty: BN

  constructor(fields: EncryptedOrderFields) {
    this.nonce = fields.nonce
    this.cipherText = fields.cipherText
    this.tokenQty = fields.tokenQty
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.vecU8("nonce"), borsh.vecU8("cipherText"), borsh.u64("tokenQty")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new EncryptedOrder({
      nonce: Array.from(obj.nonce),
      cipherText: Array.from(obj.cipherText),
      tokenQty: obj.tokenQty,
    })
  }

  static toEncodable(fields: EncryptedOrderFields) {
    return {
      nonce: Buffer.from(fields.nonce),
      cipherText: Buffer.from(fields.cipherText),
      tokenQty: fields.tokenQty,
    }
  }

  toJSON(): EncryptedOrderJSON {
    return {
      nonce: this.nonce,
      cipherText: this.cipherText,
      tokenQty: this.tokenQty.toString(),
    }
  }

  static fromJSON(obj: EncryptedOrderJSON): EncryptedOrder {
    return new EncryptedOrder({
      nonce: obj.nonce,
      cipherText: obj.cipherText,
      tokenQty: new BN(obj.tokenQty),
    })
  }

  toEncodable() {
    return EncryptedOrder.toEncodable(this)
  }
}
