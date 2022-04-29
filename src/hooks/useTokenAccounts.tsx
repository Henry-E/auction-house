import * as spl from "@solana/spl-token";
import { useMemo } from "react";
import useMarketStore from "../stores/MarketStore";
import useTokenStore, { TokenStore } from "../stores/TokenStore";

export default function useTokenAccounts(): TokenStore & {
  quoteMint?: spl.MintInfo;
  quoteTokenAccount?: spl.AccountInfo;
} {
  const quoteCurrency = useMarketStore((s) => s.quoteCurrency);
  const token = useTokenStore((s) => s);

  // wrap expensive string processing in memo
  const result = useMemo(() => {
    if (!quoteCurrency) return token;

    const quotePk = quoteCurrency.mint.toBase58();
    return Object.assign(
      {
        quoteMint: token.mints[quotePk],
        quoteTokenAccount: token.tokenAccounts[quotePk],
      },
      token
    );
  }, [quoteCurrency, token]);

  return result;
}
