import "../styles/globals.css";
import styles from "../styles/Home.module.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import ConnectWalletButton from "../components/ConnectWalletButton";

import useWallet from "../hooks/useWallet";

function MyApp({ Component, pageProps }: AppProps) {
  useWallet();
  return (
    <div className={styles.container}>
      <Head>
        <title>Mango Markets</title>
        <meta name="description" content="Mango Markets" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="flex justify-end">
        <ConnectWalletButton />
      </header>
      <main className={styles.main}>
        <Component {...pageProps} />
      </main>
    </div>
  );
}

export default MyApp;
