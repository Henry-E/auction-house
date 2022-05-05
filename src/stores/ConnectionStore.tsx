import { Provider, setProvider } from "@project-serum/anchor";
import { Connection } from "@solana/web3.js";
import produce from "immer";
import create, { State } from "zustand";

export interface EndpointInfo {
  name: string;
  url: string;
}

const ENDPOINTS: EndpointInfo[] = [
  {
    name: "mainnet",
    url: process.env.MAINNET_RPC || "https://mango.rpcpool.com",
  },
  {
    name: "devnet",
    url: process.env.DEVNET_RPC || "https://mango.devnet.rpcpool.com",
  },
  {
    name: "localnet",
    url: "http://127.0.0.1:8899",
  },
];

export function getConnection(cluster: string) {
  const ENDPOINT = ENDPOINTS.find((e) => e.name === cluster);
  return {
    connection: new Connection(ENDPOINT!.url, "processed"),
    endpoint: ENDPOINT!,
  };
}

const DEFAULT_CONNECTION = getConnection("devnet");
setProvider(
  new Provider(DEFAULT_CONNECTION.connection, null as any, {
    preflightCommitment: "confirmed",
    commitment: "processed",
  })
);

export interface ConnectionStore extends State {
  connection: Connection;
  endpoint: EndpointInfo;
  set: (x: any) => void;
}

const useConnectionStore = create<ConnectionStore>((set, _get) => ({
  ...DEFAULT_CONNECTION,
  set: (fn) => set(produce(fn)),
}));

export default useConnectionStore;
