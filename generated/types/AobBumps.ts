import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh"

export interface AobBumpsFields {
  quoteVault: number
  baseVault: number
}

export interface AobBumpsJSON {
  quoteVault: number
  baseVault: number
}

export class AobBumps {
  readonly quoteVault: number
  readonly baseVault: number

  constructor(fields: AobBumpsFields) {
    this.quoteVault = fields.quoteVault
    this.baseVault = fields.baseVault
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.u8("quoteVault"), borsh.u8("baseVault")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new AobBumps({
      quoteVault: obj.quoteVault,
      baseVault: obj.baseVault,
    })
  }

  static toEncodable(fields: AobBumpsFields) {
    return {
      quoteVault: fields.quoteVault,
      baseVault: fields.baseVault,
    }
  }

  toJSON(): AobBumpsJSON {
    return {
      quoteVault: this.quoteVault,
      baseVault: this.baseVault,
    }
  }

  static fromJSON(obj: AobBumpsJSON): AobBumps {
    return new AobBumps({
      quoteVault: obj.quoteVault,
      baseVault: obj.baseVault,
    })
  }

  toEncodable() {
    return AobBumps.toEncodable(this)
  }
}
