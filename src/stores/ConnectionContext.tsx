import { Connection } from "@solana/web3.js";

export interface EndpointInfo {
  name: string;
  url: string;
}

const ENDPOINTS: EndpointInfo[] = [
  {
    name: "mainnet",
    url: process.env.MAINNET_RPC || "https://sfo13.rpcpool.com",
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

interface ConnectionContext {
  cluster: string;
  connection: Connection;
  endpoint: string;
}

export function getConnectionContext(cluster: string): ConnectionContext {
  const ENDPOINT = ENDPOINTS.find((e) => e.name === cluster) || ENDPOINTS[0];
  return {
    cluster: ENDPOINT!.name,
    connection: new Connection(ENDPOINT!.url, "recent"),
    endpoint: ENDPOINT!.url,
  };
}
