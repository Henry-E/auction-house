import create, { State } from "zustand";
import produce from "immer";
import { SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolletWalletAdapter } from "@solana/wallet-adapter-sollet";

export const WALLET_PROVIDERS = [
  {
    name: "Phantom",
    url: "https://www.phantom.app",
    icon: "https://www.phantom.app/img/logo.png",
    adapter: new PhantomWalletAdapter(),
  },
  {
    name: "Sollet.io",
    url: "https://www.sollet.io",
    icon: "https://cdn.jsdelivr.net/gh/solana-labs/oyster@main/assets/wallets/sollet.svg",
    adapter: new SolletWalletAdapter({ provider: "https://www.sollet.io" }),
  },
];

export const DEFAULT_PROVIDER = WALLET_PROVIDERS[0];

export const getWalletProviderByUrl = (searchUrl?: string) =>
  WALLET_PROVIDERS.find(({ url }) => url === searchUrl) || DEFAULT_PROVIDER;

export interface WalletStore extends State {
  connected: boolean;
  current?: SignerWalletAdapter;
  providerUrl?: string;
  set: (x: any) => void;
}

const useWalletStore = create<WalletStore>((set, _get) => ({
  connected: false,
  set: (fn) => set(produce(fn)),
}));

export default useWalletStore;
