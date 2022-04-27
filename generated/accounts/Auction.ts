import { PublicKey, Connection } from "@solana/web3.js"
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface AuctionFields {
  bump: number
  bumps: types.AobBumpsFields
  authority: PublicKey
  auctionId: Array<number>
  startOrderPhase: BN
  endOrderPhase: BN
  endDecryptionPhase: BN
  areAsksEncrypted: boolean
  areBidsEncrypted: boolean
  naclPubkey: Array<number>
  eventQueue: PublicKey
  bids: PublicKey
  asks: PublicKey
  quoteMint: PublicKey
  baseMint: PublicKey
  quoteVault: PublicKey
  baseVault: PublicKey
  minBaseOrderSize: BN
  tickSize: BN
  currentBidKey: BN
  currentAskKey: BN
  currentBidQuantityFilled: BN
  currentAskQuantityFilled: BN
  totalQuantityFilledSoFar: BN
  hasFoundClearingPrice: boolean
  totalQuantityMatched: BN
  remainingAskFills: BN
  remainingBidFills: BN
  finalBidPrice: BN
  finalAskPrice: BN
  clearingPrice: BN
}

export interface AuctionJSON {
  bump: number
  bumps: types.AobBumpsJSON
  authority: string
  auctionId: Array<number>
  startOrderPhase: string
  endOrderPhase: string
  endDecryptionPhase: string
  areAsksEncrypted: boolean
  areBidsEncrypted: boolean
  naclPubkey: Array<number>
  eventQueue: string
  bids: string
  asks: string
  quoteMint: string
  baseMint: string
  quoteVault: string
  baseVault: string
  minBaseOrderSize: string
  tickSize: string
  currentBidKey: string
  currentAskKey: string
  currentBidQuantityFilled: string
  currentAskQuantityFilled: string
  totalQuantityFilledSoFar: string
  hasFoundClearingPrice: boolean
  totalQuantityMatched: string
  remainingAskFills: string
  remainingBidFills: string
  finalBidPrice: string
  finalAskPrice: string
  clearingPrice: string
}

export class Auction {
  readonly bump: number
  readonly bumps: types.AobBumps
  readonly authority: PublicKey
  readonly auctionId: Array<number>
  readonly startOrderPhase: BN
  readonly endOrderPhase: BN
  readonly endDecryptionPhase: BN
  readonly areAsksEncrypted: boolean
  readonly areBidsEncrypted: boolean
  readonly naclPubkey: Array<number>
  readonly eventQueue: PublicKey
  readonly bids: PublicKey
  readonly asks: PublicKey
  readonly quoteMint: PublicKey
  readonly baseMint: PublicKey
  readonly quoteVault: PublicKey
  readonly baseVault: PublicKey
  readonly minBaseOrderSize: BN
  readonly tickSize: BN
  readonly currentBidKey: BN
  readonly currentAskKey: BN
  readonly currentBidQuantityFilled: BN
  readonly currentAskQuantityFilled: BN
  readonly totalQuantityFilledSoFar: BN
  readonly hasFoundClearingPrice: boolean
  readonly totalQuantityMatched: BN
  readonly remainingAskFills: BN
  readonly remainingBidFills: BN
  readonly finalBidPrice: BN
  readonly finalAskPrice: BN
  readonly clearingPrice: BN

  static readonly discriminator = Buffer.from([
    218, 94, 247, 242, 126, 233, 131, 81,
  ])

  static readonly layout = borsh.struct([
    borsh.u8("bump"),
    types.AobBumps.layout("bumps"),
    borsh.publicKey("authority"),
    borsh.array(borsh.u8(), 10, "auctionId"),
    borsh.i64("startOrderPhase"),
    borsh.i64("endOrderPhase"),
    borsh.i64("endDecryptionPhase"),
    borsh.bool("areAsksEncrypted"),
    borsh.bool("areBidsEncrypted"),
    borsh.vecU8("naclPubkey"),
    borsh.publicKey("eventQueue"),
    borsh.publicKey("bids"),
    borsh.publicKey("asks"),
    borsh.publicKey("quoteMint"),
    borsh.publicKey("baseMint"),
    borsh.publicKey("quoteVault"),
    borsh.publicKey("baseVault"),
    borsh.u64("minBaseOrderSize"),
    borsh.u64("tickSize"),
    borsh.u128("currentBidKey"),
    borsh.u128("currentAskKey"),
    borsh.u64("currentBidQuantityFilled"),
    borsh.u64("currentAskQuantityFilled"),
    borsh.u64("totalQuantityFilledSoFar"),
    borsh.bool("hasFoundClearingPrice"),
    borsh.u64("totalQuantityMatched"),
    borsh.u64("remainingAskFills"),
    borsh.u64("remainingBidFills"),
    borsh.u64("finalBidPrice"),
    borsh.u64("finalAskPrice"),
    borsh.u64("clearingPrice"),
  ])

  constructor(fields: AuctionFields) {
    this.bump = fields.bump
    this.bumps = new types.AobBumps({ ...fields.bumps })
    this.authority = fields.authority
    this.auctionId = fields.auctionId
    this.startOrderPhase = fields.startOrderPhase
    this.endOrderPhase = fields.endOrderPhase
    this.endDecryptionPhase = fields.endDecryptionPhase
    this.areAsksEncrypted = fields.areAsksEncrypted
    this.areBidsEncrypted = fields.areBidsEncrypted
    this.naclPubkey = fields.naclPubkey
    this.eventQueue = fields.eventQueue
    this.bids = fields.bids
    this.asks = fields.asks
    this.quoteMint = fields.quoteMint
    this.baseMint = fields.baseMint
    this.quoteVault = fields.quoteVault
    this.baseVault = fields.baseVault
    this.minBaseOrderSize = fields.minBaseOrderSize
    this.tickSize = fields.tickSize
    this.currentBidKey = fields.currentBidKey
    this.currentAskKey = fields.currentAskKey
    this.currentBidQuantityFilled = fields.currentBidQuantityFilled
    this.currentAskQuantityFilled = fields.currentAskQuantityFilled
    this.totalQuantityFilledSoFar = fields.totalQuantityFilledSoFar
    this.hasFoundClearingPrice = fields.hasFoundClearingPrice
    this.totalQuantityMatched = fields.totalQuantityMatched
    this.remainingAskFills = fields.remainingAskFills
    this.remainingBidFills = fields.remainingBidFills
    this.finalBidPrice = fields.finalBidPrice
    this.finalAskPrice = fields.finalAskPrice
    this.clearingPrice = fields.clearingPrice
  }

  static async fetch(
    c: Connection,
    address: PublicKey
  ): Promise<Auction | null> {
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
  ): Promise<Array<Auction | null>> {
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

  static decode(data: Buffer): Auction {
    if (!data.slice(0, 8).equals(Auction.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = Auction.layout.decode(data.slice(8))

    return new Auction({
      bump: dec.bump,
      bumps: types.AobBumps.fromDecoded(dec.bumps),
      authority: dec.authority,
      auctionId: dec.auctionId,
      startOrderPhase: dec.startOrderPhase,
      endOrderPhase: dec.endOrderPhase,
      endDecryptionPhase: dec.endDecryptionPhase,
      areAsksEncrypted: dec.areAsksEncrypted,
      areBidsEncrypted: dec.areBidsEncrypted,
      naclPubkey: Array.from(dec.naclPubkey),
      eventQueue: dec.eventQueue,
      bids: dec.bids,
      asks: dec.asks,
      quoteMint: dec.quoteMint,
      baseMint: dec.baseMint,
      quoteVault: dec.quoteVault,
      baseVault: dec.baseVault,
      minBaseOrderSize: dec.minBaseOrderSize,
      tickSize: dec.tickSize,
      currentBidKey: dec.currentBidKey,
      currentAskKey: dec.currentAskKey,
      currentBidQuantityFilled: dec.currentBidQuantityFilled,
      currentAskQuantityFilled: dec.currentAskQuantityFilled,
      totalQuantityFilledSoFar: dec.totalQuantityFilledSoFar,
      hasFoundClearingPrice: dec.hasFoundClearingPrice,
      totalQuantityMatched: dec.totalQuantityMatched,
      remainingAskFills: dec.remainingAskFills,
      remainingBidFills: dec.remainingBidFills,
      finalBidPrice: dec.finalBidPrice,
      finalAskPrice: dec.finalAskPrice,
      clearingPrice: dec.clearingPrice,
    })
  }

  toJSON(): AuctionJSON {
    return {
      bump: this.bump,
      bumps: this.bumps.toJSON(),
      authority: this.authority.toString(),
      auctionId: this.auctionId,
      startOrderPhase: this.startOrderPhase.toString(),
      endOrderPhase: this.endOrderPhase.toString(),
      endDecryptionPhase: this.endDecryptionPhase.toString(),
      areAsksEncrypted: this.areAsksEncrypted,
      areBidsEncrypted: this.areBidsEncrypted,
      naclPubkey: this.naclPubkey,
      eventQueue: this.eventQueue.toString(),
      bids: this.bids.toString(),
      asks: this.asks.toString(),
      quoteMint: this.quoteMint.toString(),
      baseMint: this.baseMint.toString(),
      quoteVault: this.quoteVault.toString(),
      baseVault: this.baseVault.toString(),
      minBaseOrderSize: this.minBaseOrderSize.toString(),
      tickSize: this.tickSize.toString(),
      currentBidKey: this.currentBidKey.toString(),
      currentAskKey: this.currentAskKey.toString(),
      currentBidQuantityFilled: this.currentBidQuantityFilled.toString(),
      currentAskQuantityFilled: this.currentAskQuantityFilled.toString(),
      totalQuantityFilledSoFar: this.totalQuantityFilledSoFar.toString(),
      hasFoundClearingPrice: this.hasFoundClearingPrice,
      totalQuantityMatched: this.totalQuantityMatched.toString(),
      remainingAskFills: this.remainingAskFills.toString(),
      remainingBidFills: this.remainingBidFills.toString(),
      finalBidPrice: this.finalBidPrice.toString(),
      finalAskPrice: this.finalAskPrice.toString(),
      clearingPrice: this.clearingPrice.toString(),
    }
  }

  static fromJSON(obj: AuctionJSON): Auction {
    return new Auction({
      bump: obj.bump,
      bumps: types.AobBumps.fromJSON(obj.bumps),
      authority: new PublicKey(obj.authority),
      auctionId: obj.auctionId,
      startOrderPhase: new BN(obj.startOrderPhase),
      endOrderPhase: new BN(obj.endOrderPhase),
      endDecryptionPhase: new BN(obj.endDecryptionPhase),
      areAsksEncrypted: obj.areAsksEncrypted,
      areBidsEncrypted: obj.areBidsEncrypted,
      naclPubkey: obj.naclPubkey,
      eventQueue: new PublicKey(obj.eventQueue),
      bids: new PublicKey(obj.bids),
      asks: new PublicKey(obj.asks),
      quoteMint: new PublicKey(obj.quoteMint),
      baseMint: new PublicKey(obj.baseMint),
      quoteVault: new PublicKey(obj.quoteVault),
      baseVault: new PublicKey(obj.baseVault),
      minBaseOrderSize: new BN(obj.minBaseOrderSize),
      tickSize: new BN(obj.tickSize),
      currentBidKey: new BN(obj.currentBidKey),
      currentAskKey: new BN(obj.currentAskKey),
      currentBidQuantityFilled: new BN(obj.currentBidQuantityFilled),
      currentAskQuantityFilled: new BN(obj.currentAskQuantityFilled),
      totalQuantityFilledSoFar: new BN(obj.totalQuantityFilledSoFar),
      hasFoundClearingPrice: obj.hasFoundClearingPrice,
      totalQuantityMatched: new BN(obj.totalQuantityMatched),
      remainingAskFills: new BN(obj.remainingAskFills),
      remainingBidFills: new BN(obj.remainingBidFills),
      finalBidPrice: new BN(obj.finalBidPrice),
      finalAskPrice: new BN(obj.finalAskPrice),
      clearingPrice: new BN(obj.clearingPrice),
    })
  }
}
