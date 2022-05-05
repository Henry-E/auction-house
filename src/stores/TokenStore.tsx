import {
  Mint,
  Account as TokenAccount,
  getAssociatedTokenAddress,
  getMint,
  getAccount,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import produce from "immer";
import create, { State } from "zustand";
import useConnectionStore from "./ConnectionStore";
import useWalletStore from "./WalletStore";

export interface TokenStore extends State {
  mints: { [key: string]: Mint };
  tokenAccounts: { [key: string]: TokenAccount };
  set: (x: any) => void;
}

export const fetchMintAndTokenAccount = async (mint?: PublicKey) => {
  const { connection } = useConnectionStore.getState();
  const wallet = useWalletStore.getState();
  const { set } = useTokenStore.getState();

  const walletPk = wallet.current?.publicKey;
  if (!mint || !walletPk) return;

  const tokenAccountPk = await getAssociatedTokenAddress(mint, walletPk);

  const [mintInfo, accountInfo] = await Promise.all([
    getMint(connection, mint),
    getAccount(connection, tokenAccountPk),
  ]);
  const mintKey = mint.toBase58();

  console.log("fetchMintAndTokenAccount", { mintKey, mintInfo, accountInfo });

  set((s: TokenStore) => {
    s.mints[mintKey] = mintInfo;
    s.tokenAccounts[mintKey] = accountInfo;
  });
};

const useTokenStore = create<TokenStore>((set, _get) => ({
  mints: {},
  tokenAccounts: {},
  set: (fn) => set(produce(fn)),
}));

export default useTokenStore;
