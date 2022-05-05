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
export { Side }

export type SideKind = Side.Bid | Side.Ask
export type SideJSON = Side.BidJSON | Side.AskJSON
