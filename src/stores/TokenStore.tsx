import * as spl from "@solana/spl-token";
import produce from "immer";
import create, { State } from "zustand";
import useWalletStore from "./WalletStore";

export interface TokenStore extends State {
  mints: { [key: string]: spl.MintInfo };
  tokenAccounts: { [key: string]: spl.AccountInfo };
  set: (x: any) => void;
}

export const fetchMintAndTokenAccount = async (mint?: PublicKey) => {
  const wallet = useWalletStore.getState();
  const tokens = useTokenStore.getState();

  const walletPk = wallet.current?.publicKey;
  if (!mint || !walletPk) return;

  const tokenAccountPk = await spl.Token.getAssociatedTokenAddress(
    spl.ASSOCIATED_TOKEN_PROGRAM_ID,
    spl.TOKEN_PROGRAM_ID,
    mint,
    walletPk
  );

  const token = new spl.Token(
    connection,
    mint,
    spl.TOKEN_PROGRAM_ID,
    null as any
  );

  const [mintInfo, accountInfo] = await Promise.all([
    token.getMintInfo(),
    token.getAccountInfo(tokenAccountPk),
  ]);
  const mintKey = mint.toBase58();

  tokens.set((s: TokenStore) => {
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
