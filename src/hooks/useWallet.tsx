import { useEffect, useMemo } from "react";

import { notify } from "../stores/NotificationStore";
import { fetchMintAndTokenAccount } from "../stores/TokenStore";
import useWalletStore, {
  DEFAULT_PROVIDER,
  getWalletProviderByUrl,
} from "../stores/WalletStore";

import useInterval, { SECONDS } from "./useInterval";
import useLocalStorageState from "./useLocalStorageState";

export default function useWallet() {
  const { current: wallet, providerUrl: selectedProviderUrl } = useWalletStore(
    (state) => state
  );

  const [savedProviderUrl, setSavedProviderUrl] = useLocalStorageState(
    "walletProvider",
    DEFAULT_PROVIDER.url
  );

  // initialize selection from local storage
  useEffect(() => {
    if (!selectedProviderUrl) {
      useWalletStore.setState((s) => {
        s.providerUrl = savedProviderUrl;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProviderUrl]);

  // save selection in local storage
  useEffect(() => {
    if (selectedProviderUrl && selectedProviderUrl != savedProviderUrl) {
      setSavedProviderUrl(selectedProviderUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProviderUrl]);

  const provider = useMemo(
    () => getWalletProviderByUrl(selectedProviderUrl),
    [selectedProviderUrl]
  );

  useEffect(() => {
    if (provider) {
      const updateWallet = () => {
        // hack to also update wallet synchronously in case it disconnects
        const wallet = provider.adapter;
        console.log("updateWallet", wallet);
        useWalletStore.setState((s) => {
          s.current = wallet;
        });
      };

      if (document.readyState !== "complete") {
        // wait to ensure that browser extensions are loaded
        const listener = () => {
          updateWallet();
          window.removeEventListener("load", listener);
        };
        window.addEventListener("load", listener);
        return () => window.removeEventListener("load", listener);
      } else {
        updateWallet();
      }
    }
  }, [provider]);

  useEffect(() => {
    if (!wallet) return;
    wallet.on("connect", async () => {
      useWalletStore.setState((s) => {
        s.connected = true;
      });
      notify({
        message: "Wallet connected",
        description:
          "Connected to wallet " +
          wallet!.publicKey!.toString().substr(0, 5) +
          "..." +
          wallet!.publicKey!.toString().substr(-5),
      });

      // load wallet dependent data
      // note: There's the possibility of a race condition here. Sometimes wallet connect
      // finishes before all other data loads. Hence the fetching of wallet dependent data
      // needs to be initiated both here and when other dependencies finish loading.
      // const market = useMarketStore.getState();
      // fetchMintAndTokenAccount(market.quoteCurrency?.mint);
      // fetchPositions();
    });
    wallet.on("disconnect", () => {
      useWalletStore.setState((s) => {
        s.connected = false;
      });
      notify({
        type: "info",
        message: "Disconnected from wallet",
      });
    });
    return () => {
      wallet?.disconnect?.();
      useWalletStore.setState((s) => {
        s.connected = false;
      });
    };
  }, [wallet]);

  // fetch on page load
  useEffect(() => {
    const pageLoad = async () => {
      console.log("pageLoad");
    };
    pageLoad();
  }, []);

  // refresh regularly
  useInterval(async () => {
    // fetchPositions();
  }, 10 * SECONDS);

  return {};
}
