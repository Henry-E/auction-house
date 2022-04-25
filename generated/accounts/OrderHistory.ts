import { PublicKey, Connection } from "@solana/web3.js"
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface OrderHistoryFields {
  bump: number
  side: types.SideKind
  quoteAmountReturned: BN
  baseAmountReturned: BN
}

export interface OrderHistoryJSON {
  bump: number
  side: types.SideJSON
  quoteAmountReturned: string
  baseAmountReturned: string
}

export class OrderHistory {
  readonly bump: number
  readonly side: types.SideKind
  readonly quoteAmountReturned: BN
  readonly baseAmountReturned: BN

  static readonly discriminator = Buffer.from([33, 107, 40, 81, 11, 0, 245, 31])

  static readonly layout = borsh.struct([
    borsh.u8("bump"),
    types.Side.layout("side"),
    borsh.u64("quoteAmountReturned"),
    borsh.u64("baseAmountReturned"),
  ])

  constructor(fields: OrderHistoryFields) {
    this.bump = fields.bump
    this.side = fields.side
    this.quoteAmountReturned = fields.quoteAmountReturned
    this.baseAmountReturned = fields.baseAmountReturned
  }

  static async fetch(
    c: Connection,
    address: PublicKey
  ): Promise<OrderHistory | null> {
    const info = await c.getAccountInfo(address)

    if (info === null) {
      return null
    }
    if (!info.owner.equals(PROGRAM_ID)) {
      throw new Error("account doesn't belong to this program")
    }

    return this.decode(info.data)
  }

  static async fetchMultiple(
    c: Connection,
    addresses: PublicKey[]
  ): Promise<Array<OrderHistory | null>> {
    const infos = await c.getMultipleAccountsInfo(addresses)

    return infos.map((info) => {
      if (info === null) {
        return null
      }
      if (!info.owner.equals(PROGRAM_ID)) {
        throw new Error("account doesn't belong to this program")
      }

      return this.decode(info.data)
    })
  }

  static decode(data: Buffer): OrderHistory {
    if (!data.slice(0, 8).equals(OrderHistory.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = OrderHistory.layout.decode(data.slice(8))

    return new OrderHistory({
      bump: dec.bump,
      side: types.Side.fromDecoded(dec.side),
      quoteAmountReturned: dec.quoteAmountReturned,
      baseAmountReturned: dec.baseAmountReturned,
    })
  }

  toJSON(): OrderHistoryJSON {
    return {
      bump: this.bump,
      side: this.side.toJSON(),
      quoteAmountReturned: this.quoteAmountReturned.toString(),
      baseAmountReturned: this.baseAmountReturned.toString(),
    }
  }

  static fromJSON(obj: OrderHistoryJSON): OrderHistory {
    return new OrderHistory({
      bump: obj.bump,
      side: types.Side.fromJSON(obj.side),
      quoteAmountReturned: new BN(obj.quoteAmountReturned),
      baseAmountReturned: new BN(obj.baseAmountReturned),
    })
  }
}
