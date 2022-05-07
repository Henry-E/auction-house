import { Program, setProvider, Provider, BN } from "@project-serum/anchor";
import produce from "immer";
import create, { State } from "zustand";
import { AuctionHouse } from "../../target/types/auction_house";
import * as idl from "../../target/idl/auction_house.json";
import useConnectionStore, { getConnection } from "./ConnectionStore";
import { PublicKey } from "@solana/web3.js";
import { Slab } from "@bonfida/aaob";
import { Auction, OpenOrders, OrderHistory } from "../../generated/accounts";

export interface AuctionStore extends State {
  program: Program<AuctionHouse>;
  auctions: any[];
  loadingAuctions: boolean;
  selected?: { auction: Auction; bids: Slab; asks: Slab };
  orders?: { oo: OpenOrders | null; oh: OrderHistory | null };
  set: (x: any) => void;
}

const loadSlab = async (pk: PublicKey) => {
  const { connection } = useConnectionStore.getState();
  const info = await connection.getAccountInfo(pk);
  if (!info?.data) {
    throw new Error("Invalid account");
  }
  return Slab.deserialize(info.data, new BN(0));
};

export const fetchAuction = async (pk: PublicKey) => {
  let { auctions, set } = useAuctionStore.getState();

  if (auctions.length == 0) {
    auctions = await fetchAuctions();
  }

  const auctionIndex = auctions.findIndex((a) => a.publicKey.equals(pk));
  console.log("fetchAuction", auctionIndex);
  if (auctionIndex > -1) {
    const auction = new Auction(auctions[auctionIndex].account);

    const [bids, asks] = await Promise.all([
      loadSlab(auction.bids),
      loadSlab(auction.asks),
    ]);

    set((s: AuctionStore) => {
      s.selected = { auction, bids, asks };
    });
  }
};

export const fetchOpenOrders = async (pk: PublicKey, wallet: PublicKey) => {
  const { connection } = useConnectionStore.getState();

  let { program, auctions, set } = useAuctionStore.getState();

  if (auctions.length == 0) {
    auctions = await fetchAuctions();
  }

  const auctionIndex = auctions.findIndex((a) => a.publicKey.equals(pk));
  console.log("fetchOpenOrders", auctionIndex);

  if (auctionIndex > -1) {
    const auction = new Auction(auctions[auctionIndex].account);

    let [oopk] = await PublicKey.findProgramAddress(
      [
        wallet.toBuffer(),
        Buffer.from("open_orders"),
        Buffer.from(auction.auctionId),
        auction.authority.toBuffer(),
      ],
      program.programId
    );
    let [ohpk] = await PublicKey.findProgramAddress(
      [
        wallet.toBuffer(),
        Buffer.from("order_history"),
        Buffer.from(auction.auctionId),
        auction.authority.toBuffer(),
      ],
      program.programId
    );

    const [oo, oh] = await Promise.all([
      OpenOrders.fetch(connection, oopk),
      OrderHistory.fetch(connection, ohpk),
    ]);

    set((s: AuctionStore) => {
      s.orders = { oo, oh };
    });
  }
};

export const fetchAuctions = async () => {
  const { program, set } = useAuctionStore.getState();

  set((s: AuctionStore) => {
    s.loadingAuctions = true;
  });

  const auctions = await program.account.auction.all();
  console.log("fetchAuctions", auctions);

  set((s: AuctionStore) => {
    s.auctions = auctions;
    s.loadingAuctions = false;
  });

  return auctions;
};

const DEFAULT_CONNECTION = getConnection("devnet");
setProvider(
  new Provider(DEFAULT_CONNECTION.connection, null as any, {
    preflightCommitment: "confirmed",
    commitment: "processed",
  })
);

const useAuctionStore = create<AuctionStore>((set, _get) => ({
  program: new Program<any>(
    idl,
    "HNs9zDcM1TCwbpbfrYXf3KPic9raPj4rqau7XNYsmTBw"
  ) as Program<AuctionHouse>,
  auctions: [],
  loadingAuctions: false,
  set: (fn) => set(produce(fn)),
}));

export default useAuctionStore;
