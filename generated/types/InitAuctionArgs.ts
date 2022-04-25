import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh"

export interface InitAuctionArgsFields {
  startOrderPhase: BN
  endOrderPhase: BN
  endDecryptionPhase: BN
  areAsksEncrypted: boolean
  areBidsEncrypted: boolean
  minBaseOrderSize: BN
  tickSize: BN
}

export interface InitAuctionArgsJSON {
  startOrderPhase: string
  endOrderPhase: string
  endDecryptionPhase: string
  areAsksEncrypted: boolean
  areBidsEncrypted: boolean
  minBaseOrderSize: string
  tickSize: string
}

export class InitAuctionArgs {
  readonly startOrderPhase: BN
  readonly endOrderPhase: BN
  readonly endDecryptionPhase: BN
  readonly areAsksEncrypted: boolean
  readonly areBidsEncrypted: boolean
  readonly minBaseOrderSize: BN
  readonly tickSize: BN

  constructor(fields: InitAuctionArgsFields) {
    this.startOrderPhase = fields.startOrderPhase
    this.endOrderPhase = fields.endOrderPhase
    this.endDecryptionPhase = fields.endDecryptionPhase
    this.areAsksEncrypted = fields.areAsksEncrypted
    this.areBidsEncrypted = fields.areBidsEncrypted
    this.minBaseOrderSize = fields.minBaseOrderSize
    this.tickSize = fields.tickSize
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.i64("startOrderPhase"),
        borsh.i64("endOrderPhase"),
        borsh.i64("endDecryptionPhase"),
        borsh.bool("areAsksEncrypted"),
        borsh.bool("areBidsEncrypted"),
        borsh.u64("minBaseOrderSize"),
        borsh.u64("tickSize"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new InitAuctionArgs({
      startOrderPhase: obj.startOrderPhase,
      endOrderPhase: obj.endOrderPhase,
      endDecryptionPhase: obj.endDecryptionPhase,
      areAsksEncrypted: obj.areAsksEncrypted,
      areBidsEncrypted: obj.areBidsEncrypted,
      minBaseOrderSize: obj.minBaseOrderSize,
      tickSize: obj.tickSize,
    })
  }

  static toEncodable(fields: InitAuctionArgsFields) {
    return {
      startOrderPhase: fields.startOrderPhase,
      endOrderPhase: fields.endOrderPhase,
      endDecryptionPhase: fields.endDecryptionPhase,
      areAsksEncrypted: fields.areAsksEncrypted,
      areBidsEncrypted: fields.areBidsEncrypted,
      minBaseOrderSize: fields.minBaseOrderSize,
      tickSize: fields.tickSize,
    }
  }

  toJSON(): InitAuctionArgsJSON {
    return {
      startOrderPhase: this.startOrderPhase.toString(),
      endOrderPhase: this.endOrderPhase.toString(),
      endDecryptionPhase: this.endDecryptionPhase.toString(),
      areAsksEncrypted: this.areAsksEncrypted,
      areBidsEncrypted: this.areBidsEncrypted,
      minBaseOrderSize: this.minBaseOrderSize.toString(),
      tickSize: this.tickSize.toString(),
    }
  }

  static fromJSON(obj: InitAuctionArgsJSON): InitAuctionArgs {
    return new InitAuctionArgs({
      startOrderPhase: new BN(obj.startOrderPhase),
      endOrderPhase: new BN(obj.endOrderPhase),
      endDecryptionPhase: new BN(obj.endDecryptionPhase),
      areAsksEncrypted: obj.areAsksEncrypted,
      areBidsEncrypted: obj.areBidsEncrypted,
      minBaseOrderSize: new BN(obj.minBaseOrderSize),
      tickSize: new BN(obj.tickSize),
    })
  }

  toEncodable() {
    return InitAuctionArgs.toEncodable(this)
  }
}
