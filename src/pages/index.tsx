import type { NextPage } from "next";
import Head from "next/head";
import ConnectWalletButton from "../components/ConnectWalletButton";

import styles from "../styles/Home.module.css";

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Mango Slice</title>
        <meta name="description" content="Mango Markets" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header>
        <ConnectWalletButton />
      </header>

      <main className={styles.main}>
        <h1>hello</h1>
      </main>
    </div>
  );
};

export default Home;
