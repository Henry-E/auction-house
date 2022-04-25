import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@project-serum/borsh"

export interface BestBidJSON {
  kind: "BestBid"
}

export class BestBid {
  readonly discriminator = 0
  readonly kind = "BestBid"

  toJSON(): BestBidJSON {
    return {
      kind: "BestBid",
    }
  }

  toEncodable() {
    return {
      BestBid: {},
    }
  }
}

export interface MidpointJSON {
  kind: "Midpoint"
}

export class Midpoint {
  readonly discriminator = 1
  readonly kind = "Midpoint"

  toJSON(): MidpointJSON {
    return {
      kind: "Midpoint",
    }
  }

  toEncodable() {
    return {
      Midpoint: {},
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDecoded(obj: any): types.FinalPriceTypesKind {
  if (typeof obj !== "object") {
    throw new Error("Invalid enum object")
  }

  if ("BestBid" in obj) {
    return new BestBid()
  }
  if ("Midpoint" in obj) {
    return new Midpoint()
  }

  throw new Error("Invalid enum object")
}

export function fromJSON(
  obj: types.FinalPriceTypesJSON
): types.FinalPriceTypesKind {
  switch (obj.kind) {
    case "BestBid": {
      return new BestBid()
    }
    case "Midpoint": {
      return new Midpoint()
    }
  }
}

export function layout(property?: string) {
  const ret = borsh.rustEnum([
    borsh.struct([], "BestBid"),
    borsh.struct([], "Midpoint"),
  ])
  if (property !== undefined) {
    return ret.replicate(property)
  }
  return ret
}
