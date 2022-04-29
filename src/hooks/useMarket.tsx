import { QUOTE_INDEX } from "@blockworks-foundation/mango-client";
import { MangoClient } from "@blockworks-foundation/mango-client";
import { useEffect } from "react";
import { getConnectionContext } from "../stores/ConnectionContext";
import useMarketStore, { MarketStore } from "../stores/MarketStore";
import { fetchPositions } from "../stores/PositionStore";
import { fetchMintAndTokenAccount } from "../stores/TokenStore";

export default function useMarket() {
  const market = useMarketStore((state) => state);
  const { groupConfig, marketConfig, set } = market;

  useEffect(() => {
    const pageLoad = async () => {
      // fetch market on page load
      const { connection } = getConnectionContext(groupConfig.cluster);
      const client = new MangoClient(connection, groupConfig.mangoProgramId);
      const group = await client.getMangoGroup(groupConfig.publicKey);

      set((s: MarketStore) => {
        s.client = client;
        s.group = group;
        s.info = group.perpMarkets[marketConfig.marketIndex];
        s.quoteCurrency = group.tokens[QUOTE_INDEX];
      });

      const [perpMarket, _rootBanks] = await Promise.all([
        group.loadPerpMarket(
          connection,
          marketConfig.marketIndex,
          marketConfig.baseDecimals,
          marketConfig.quoteDecimals
        ),
        group.loadRootBanks(connection),
      ]);

      set((s: MarketStore) => {
        s.market = perpMarket;
      });

      // subscribe to price cache changes
      const cacheSub = group.onCacheChange(connection, (cache) => {
        const indexPrice = group.getPriceUi(marketConfig.marketIndex, cache);
        set((s: MarketStore) => {
          s.cache = cache;
          s.indexPrice = indexPrice;
        });
      });

      // trigger: fetch all market dependent loads
      // just in case wallet was connected before the market loaded
      fetchMintAndTokenAccount(group.tokens[QUOTE_INDEX].mint);
      fetchPositions();
    };
    pageLoad();
  }, [groupConfig, marketConfig, set]);

  return market;
}
