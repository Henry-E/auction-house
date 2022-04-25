import * as FinalPriceTypes from "./FinalPriceTypes"
import * as Side from "./Side"

export { AobBumps, AobBumpsFields, AobBumpsJSON } from "./AobBumps"
export {
  EncryptedOrder,
  EncryptedOrderFields,
  EncryptedOrderJSON,
} from "./EncryptedOrder"
export {
  InitAuctionArgs,
  InitAuctionArgsFields,
  InitAuctionArgsJSON,
} from "./InitAuctionArgs"
export { FinalPriceTypes }

export type FinalPriceTypesKind =
  | FinalPriceTypes.BestBid
  | FinalPriceTypes.Midpoint
export type FinalPriceTypesJSON =
  | FinalPriceTypes.BestBidJSON
  | FinalPriceTypes.MidpointJSON

export { Side }

export type SideKind = Side.Bid | Side.Ask
export type SideJSON = Side.BidJSON | Side.AskJSON
