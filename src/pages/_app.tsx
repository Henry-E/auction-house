import "../styles/globals.css";
import type { AppProps } from "next/app";
import useWallet from "../hooks/useWallet";

function MyApp({ Component, pageProps }: AppProps) {
  useWallet();
  return <Component {...pageProps} />;
}

export default MyApp;
