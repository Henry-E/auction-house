export type CustomError =
  | NotImplemented
  | InvalidEndTimes
  | InvalidStartTimes
  | InvalidDecryptionEndTime
  | InvalidMinBaseOrderSize
  | InvalidTickSize
  | NoAskOrders
  | NoBidOrders
  | NoOrdersInOrderbook
  | CalcClearingPricePhaseNotActive
  | ClearingPriceAlreadyFound
  | NoClearingPriceYet
  | MatchOrdersPhaseNotActive
  | AuctionNotFinished
  | AobEventQueueFull
  | NoEventsProcessed
  | MissingOpenOrdersPubkeyInRemainingAccounts
  | UserSideDiffFromEventSide
  | OrderIdNotFound
  | OrderIdxNotValid
  | OrderPhaseHasNotStarted
  | OrderPhaseIsOver
  | OrderPhaseNotActive
  | DecryptionPhaseHasNotStarted
  | DecryptionPhaseHasEnded
  | DecryptionPhaseNotActive
  | MaxOrdersValueIsInvalid
  | EncryptedOrdersOnlyOnThisSide
  | UnencryptedOrdersOnlyOnThisSide
  | LimitPriceNotAMultipleOfTickSize
  | OrderBelowMinBaseOrderSize
  | TooManyOrders
  | EncryptionPubkeysDoNotMatch
  | IdenticalEncryptedOrderFound
  | InsufficientTokensForOrder
  | InvalidSharedKey
  | NodeKeyNotFound
  | OpenOrdersHasOpenOrders
  | OpenOrdersHasLockedTokens
  | OrderBookNotEmpty
  | EventQueueNotEmpty
  | NumericalOverflow
  | SlabIteratorOverflow

export class NotImplemented extends Error {
  readonly code = 6000
  readonly name = "NotImplemented"
  readonly msg = "Function not yet implemented"

  constructor() {
    super("6000: Function not yet implemented")
  }
}

export class InvalidEndTimes extends Error {
  readonly code = 6001
  readonly name = "InvalidEndTimes"
  readonly msg = "bids and asks order periods should end in the future"

  constructor() {
    super("6001: bids and asks order periods should end in the future")
  }
}

export class InvalidStartTimes extends Error {
  readonly code = 6002
  readonly name = "InvalidStartTimes"
  readonly msg = "bids and asks periods should start before they end"

  constructor() {
    super("6002: bids and asks periods should start before they end")
  }
}

export class InvalidDecryptionEndTime extends Error {
  readonly code = 6003
  readonly name = "InvalidDecryptionEndTime"
  readonly msg =
    "Invalid decryption end time, needs to finish after bids / asks end"

  constructor() {
    super(
      "6003: Invalid decryption end time, needs to finish after bids / asks end"
    )
  }
}

export class InvalidMinBaseOrderSize extends Error {
  readonly code = 6004
  readonly name = "InvalidMinBaseOrderSize"
  readonly msg = "Min base order size should be greater than zero"

  constructor() {
    super("6004: Min base order size should be greater than zero")
  }
}

export class InvalidTickSize extends Error {
  readonly code = 6005
  readonly name = "InvalidTickSize"
  readonly msg = "Tick size should be greater than zero"

  constructor() {
    super("6005: Tick size should be greater than zero")
  }
}

export class NoAskOrders extends Error {
  readonly code = 6006
  readonly name = "NoAskOrders"
  readonly msg = "No ask orders"

  constructor() {
    super("6006: No ask orders")
  }
}

export class NoBidOrders extends Error {
  readonly code = 6007
  readonly name = "NoBidOrders"
  readonly msg = "No bid orders"

  constructor() {
    super("6007: No bid orders")
  }
}

export class NoOrdersInOrderbook extends Error {
  readonly code = 6008
  readonly name = "NoOrdersInOrderbook"
  readonly msg = "No orders in the orderbook"

  constructor() {
    super("6008: No orders in the orderbook")
  }
}

export class CalcClearingPricePhaseNotActive extends Error {
  readonly code = 6009
  readonly name = "CalcClearingPricePhaseNotActive"
  readonly msg = "Calculating clearing price phase is not active"

  constructor() {
    super("6009: Calculating clearing price phase is not active")
  }
}

export class ClearingPriceAlreadyFound extends Error {
  readonly code = 6010
  readonly name = "ClearingPriceAlreadyFound"
  readonly msg = "Clearing price has already been found"

  constructor() {
    super("6010: Clearing price has already been found")
  }
}

export class NoClearingPriceYet extends Error {
  readonly code = 6011
  readonly name = "NoClearingPriceYet"
  readonly msg = "Clearing price not found yet"

  constructor() {
    super("6011: Clearing price not found yet")
  }
}

export class MatchOrdersPhaseNotActive extends Error {
  readonly code = 6012
  readonly name = "MatchOrdersPhaseNotActive"
  readonly msg = "Match orders phase is not active"

  constructor() {
    super("6012: Match orders phase is not active")
  }
}

export class AuctionNotFinished extends Error {
  readonly code = 6013
  readonly name = "AuctionNotFinished"
  readonly msg = "Auction not finished yet"

  constructor() {
    super("6013: Auction not finished yet")
  }
}

export class AobEventQueueFull extends Error {
  readonly code = 6014
  readonly name = "AobEventQueueFull"
  readonly msg = "AOB Event queue is full"

  constructor() {
    super("6014: AOB Event queue is full")
  }
}

export class NoEventsProcessed extends Error {
  readonly code = 6015
  readonly name = "NoEventsProcessed"
  readonly msg = "No events processed"

  constructor() {
    super("6015: No events processed")
  }
}

export class MissingOpenOrdersPubkeyInRemainingAccounts extends Error {
  readonly code = 6016
  readonly name = "MissingOpenOrdersPubkeyInRemainingAccounts"
  readonly msg = "Open orders pubkey not found in remaining accounts"

  constructor() {
    super("6016: Open orders pubkey not found in remaining accounts")
  }
}

export class UserSideDiffFromEventSide extends Error {
  readonly code = 6017
  readonly name = "UserSideDiffFromEventSide"
  readonly msg =
    "User's side doesn't make event side, definitely shouldn't ever happen"

  constructor() {
    super(
      "6017: User's side doesn't make event side, definitely shouldn't ever happen"
    )
  }
}

export class OrderIdNotFound extends Error {
  readonly code = 6018
  readonly name = "OrderIdNotFound"
  readonly msg = "Order id not found in list of orders"

  constructor() {
    super("6018: Order id not found in list of orders")
  }
}

export class OrderIdxNotValid extends Error {
  readonly code = 6019
  readonly name = "OrderIdxNotValid"
  readonly msg = "Order index is invalid"

  constructor() {
    super("6019: Order index is invalid")
  }
}

export class OrderPhaseHasNotStarted extends Error {
  readonly code = 6020
  readonly name = "OrderPhaseHasNotStarted"
  readonly msg = "Time for placing bid or ask orders hasn't started"

  constructor() {
    super("6020: Time for placing bid or ask orders hasn't started")
  }
}

export class OrderPhaseIsOver extends Error {
  readonly code = 6021
  readonly name = "OrderPhaseIsOver"
  readonly msg = "Time for placing bid or ask orders has finished"

  constructor() {
    super("6021: Time for placing bid or ask orders has finished")
  }
}

export class OrderPhaseNotActive extends Error {
  readonly code = 6022
  readonly name = "OrderPhaseNotActive"
  readonly msg = "It is not the time for placing bid or ask orders"

  constructor() {
    super("6022: It is not the time for placing bid or ask orders")
  }
}

export class DecryptionPhaseHasNotStarted extends Error {
  readonly code = 6023
  readonly name = "DecryptionPhaseHasNotStarted"
  readonly msg = "The phase for decrypting bid or ask orders hasn't started"

  constructor() {
    super("6023: The phase for decrypting bid or ask orders hasn't started")
  }
}

export class DecryptionPhaseHasEnded extends Error {
  readonly code = 6024
  readonly name = "DecryptionPhaseHasEnded"
  readonly msg = "The phase for decrypting bid or ask orders has finished"

  constructor() {
    super("6024: The phase for decrypting bid or ask orders has finished")
  }
}

export class DecryptionPhaseNotActive extends Error {
  readonly code = 6025
  readonly name = "DecryptionPhaseNotActive"
  readonly msg = "It is not the time for decrypting bid or ask orders"

  constructor() {
    super("6025: It is not the time for decrypting bid or ask orders")
  }
}

export class MaxOrdersValueIsInvalid extends Error {
  readonly code = 6026
  readonly name = "MaxOrdersValueIsInvalid"
  readonly msg = "Max orders value is either too high or too low, min 1 max 8"

  constructor() {
    super("6026: Max orders value is either too high or too low, min 1 max 8")
  }
}

export class EncryptedOrdersOnlyOnThisSide extends Error {
  readonly code = 6027
  readonly name = "EncryptedOrdersOnlyOnThisSide"
  readonly msg = "Can only place encrypted orders on this side of the book"

  constructor() {
    super("6027: Can only place encrypted orders on this side of the book")
  }
}

export class UnencryptedOrdersOnlyOnThisSide extends Error {
  readonly code = 6028
  readonly name = "UnencryptedOrdersOnlyOnThisSide"
  readonly msg =
    "Can only place regular (unencrypted) orders on this side of the book"

  constructor() {
    super(
      "6028: Can only place regular (unencrypted) orders on this side of the book"
    )
  }
}

export class LimitPriceNotAMultipleOfTickSize extends Error {
  readonly code = 6029
  readonly name = "LimitPriceNotAMultipleOfTickSize"
  readonly msg = "Limit price must be a multiple of the assigned tick size"

  constructor() {
    super("6029: Limit price must be a multiple of the assigned tick size")
  }
}

export class OrderBelowMinBaseOrderSize extends Error {
  readonly code = 6030
  readonly name = "OrderBelowMinBaseOrderSize"
  readonly msg = "Max base order size is below the minimum"

  constructor() {
    super("6030: Max base order size is below the minimum")
  }
}

export class TooManyOrders extends Error {
  readonly code = 6031
  readonly name = "TooManyOrders"
  readonly msg = "Open orders account already has the maximum amount of orders"

  constructor() {
    super("6031: Open orders account already has the maximum amount of orders")
  }
}

export class EncryptionPubkeysDoNotMatch extends Error {
  readonly code = 6032
  readonly name = "EncryptionPubkeysDoNotMatch"
  readonly msg =
    "The public key stored in this open orders account doesn't match the public key passed in"

  constructor() {
    super(
      "6032: The public key stored in this open orders account doesn't match the public key passed in"
    )
  }
}

export class IdenticalEncryptedOrderFound extends Error {
  readonly code = 6033
  readonly name = "IdenticalEncryptedOrderFound"
  readonly msg = "An identical encrypted order found in the open orders account"

  constructor() {
    super("6033: An identical encrypted order found in the open orders account")
  }
}

export class InsufficientTokensForOrder extends Error {
  readonly code = 6034
  readonly name = "InsufficientTokensForOrder"
  readonly msg =
    "Not enough tokens provided for the order requested. For simplicity of processing, this prevents all encrypted orders in the open orders account being processed. You can cancel the encrypted orders after the decryption period has finished."

  constructor() {
    super(
      "6034: Not enough tokens provided for the order requested. For simplicity of processing, this prevents all encrypted orders in the open orders account being processed. You can cancel the encrypted orders after the decryption period has finished."
    )
  }
}

export class InvalidSharedKey extends Error {
  readonly code = 6035
  readonly name = "InvalidSharedKey"
  readonly msg = "The shared key passed in cannot decrypt these orders"

  constructor() {
    super("6035: The shared key passed in cannot decrypt these orders")
  }
}

export class NodeKeyNotFound extends Error {
  readonly code = 6036
  readonly name = "NodeKeyNotFound"
  readonly msg =
    "Failed to find the current ask/bid key in the orderbook, this should never happen!"

  constructor() {
    super(
      "6036: Failed to find the current ask/bid key in the orderbook, this should never happen!"
    )
  }
}

export class OpenOrdersHasOpenOrders extends Error {
  readonly code = 6037
  readonly name = "OpenOrdersHasOpenOrders"
  readonly msg =
    "Can't close an open orders account that has open orders, try cancelling all orders first"

  constructor() {
    super(
      "6037: Can't close an open orders account that has open orders, try cancelling all orders first"
    )
  }
}

export class OpenOrdersHasLockedTokens extends Error {
  readonly code = 6038
  readonly name = "OpenOrdersHasLockedTokens"
  readonly msg =
    "Can't close an open orders account that has locked tokens, try cancelling all orders first"

  constructor() {
    super(
      "6038: Can't close an open orders account that has locked tokens, try cancelling all orders first"
    )
  }
}

export class OrderBookNotEmpty extends Error {
  readonly code = 6039
  readonly name = "OrderBookNotEmpty"
  readonly msg = "Order book should be empty"

  constructor() {
    super("6039: Order book should be empty")
  }
}

export class EventQueueNotEmpty extends Error {
  readonly code = 6040
  readonly name = "EventQueueNotEmpty"
  readonly msg = "Event queue should be empty"

  constructor() {
    super("6040: Event queue should be empty")
  }
}

export class NumericalOverflow extends Error {
  readonly code = 6041
  readonly name = "NumericalOverflow"
  readonly msg =
    "Some issue with the FP32 multiplication / division messed the maths up"

  constructor() {
    super(
      "6041: Some issue with the FP32 multiplication / division messed the maths up"
    )
  }
}

export class SlabIteratorOverflow extends Error {
  readonly code = 6042
  readonly name = "SlabIteratorOverflow"
  readonly msg = "Slab iterator stack overflow"

  constructor() {
    super("6042: Slab iterator stack overflow")
  }
}

export function fromCode(code: number): CustomError | null {
  switch (code) {
    case 6000:
      return new NotImplemented()
    case 6001:
      return new InvalidEndTimes()
    case 6002:
      return new InvalidStartTimes()
    case 6003:
      return new InvalidDecryptionEndTime()
    case 6004:
      return new InvalidMinBaseOrderSize()
    case 6005:
      return new InvalidTickSize()
    case 6006:
      return new NoAskOrders()
    case 6007:
      return new NoBidOrders()
    case 6008:
      return new NoOrdersInOrderbook()
    case 6009:
      return new CalcClearingPricePhaseNotActive()
    case 6010:
      return new ClearingPriceAlreadyFound()
    case 6011:
      return new NoClearingPriceYet()
    case 6012:
      return new MatchOrdersPhaseNotActive()
    case 6013:
      return new AuctionNotFinished()
    case 6014:
      return new AobEventQueueFull()
    case 6015:
      return new NoEventsProcessed()
    case 6016:
      return new MissingOpenOrdersPubkeyInRemainingAccounts()
    case 6017:
      return new UserSideDiffFromEventSide()
    case 6018:
      return new OrderIdNotFound()
    case 6019:
      return new OrderIdxNotValid()
    case 6020:
      return new OrderPhaseHasNotStarted()
    case 6021:
      return new OrderPhaseIsOver()
    case 6022:
      return new OrderPhaseNotActive()
    case 6023:
      return new DecryptionPhaseHasNotStarted()
    case 6024:
      return new DecryptionPhaseHasEnded()
    case 6025:
      return new DecryptionPhaseNotActive()
    case 6026:
      return new MaxOrdersValueIsInvalid()
    case 6027:
      return new EncryptedOrdersOnlyOnThisSide()
    case 6028:
      return new UnencryptedOrdersOnlyOnThisSide()
    case 6029:
      return new LimitPriceNotAMultipleOfTickSize()
    case 6030:
      return new OrderBelowMinBaseOrderSize()
    case 6031:
      return new TooManyOrders()
    case 6032:
      return new EncryptionPubkeysDoNotMatch()
    case 6033:
      return new IdenticalEncryptedOrderFound()
    case 6034:
      return new InsufficientTokensForOrder()
    case 6035:
      return new InvalidSharedKey()
    case 6036:
      return new NodeKeyNotFound()
    case 6037:
      return new OpenOrdersHasOpenOrders()
    case 6038:
      return new OpenOrdersHasLockedTokens()
    case 6039:
      return new OrderBookNotEmpty()
    case 6040:
      return new EventQueueNotEmpty()
    case 6041:
      return new NumericalOverflow()
    case 6042:
      return new SlabIteratorOverflow()
  }

  return null
}
