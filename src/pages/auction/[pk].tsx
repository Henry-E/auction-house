import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Auction, OpenOrders } from "../../../generated/accounts";
import Modal from "../../components/Modal";
import useLocalStorageState from "../../hooks/useLocalStorageState";
import useWallet from "../../hooks/useWallet";
import * as nacl from "tweetnacl";

import useAuctionStore, {
  fetchAuction,
  fetchAuctions,
  fetchOpenOrders,
} from "../../stores/AuctionStore";
import useTokenStore, {
  fetchMintAndTokenAccount,
} from "../../stores/TokenStore";
import useWalletStore from "../../stores/WalletStore";
import useConnectionStore from "../../stores/ConnectionStore";
import { Side } from "../../../generated/types";
import {
  cancelEncryptedOrder,
  cancelOrder,
  initOpenOrders,
  newEncryptedOrder,
  newOrder,
} from "../../../generated/instructions";
import { toFp32, toFpLimitPrice } from "../../../tests/sdk/utils";
import { BN } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const AuctionView = () => {
  const router = useRouter();
  const { pk } = router.query;
  const { programId } = useAuctionStore((s) => s.program);
  const selected = useAuctionStore((s) => s.selected);
  const orders = useAuctionStore((s) => s.orders);
  const connection = useConnectionStore((s) => s.connection);
  const { tokenAccounts, mints } = useTokenStore((s) => s);
  const wallet = useWalletStore((s) => s.current);

  const [openBidModal, setOpenBidModal] = useState(false);

  const [localOrderKey] = useLocalStorageState(
    "localOrderKey",
    nacl.box.keyPair()
  );

  // local storage messes up the key encoding
  const secretKey = useMemo(() => {
    const buf = Buffer.alloc(nacl.box.secretKeyLength);
    for (let i = 0; i < nacl.box.secretKeyLength; ++i) {
      buf[i] = localOrderKey.secretKey[i];
    }
    return buf;
  }, [localOrderKey]);

  // derive shared secret
  const decryptionKey = useMemo(() => {
    console.log("memo", "decryptionKey", selected?.auction);
    if (selected?.auction) {
      return nacl.box.before(
        Uint8Array.from(selected.auction.naclPubkey),
        secretKey
      );
    }
  }, [selected, secretKey]);

  // TODO: move to token store
  const userBase = useMemo(() => {
    console.log("memo", "userBase", selected?.auction, tokenAccounts);

    if (tokenAccounts && selected?.auction.baseMint)
      return tokenAccounts[selected.auction.baseMint.toBase58()]?.address;
  }, [tokenAccounts, selected]);
  const userQuote = useMemo(() => {
    if (tokenAccounts && selected?.auction.quoteMint)
      return tokenAccounts[selected.auction.quoteMint.toBase58()]?.address;
  }, [tokenAccounts, selected]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      amount: 0,
      price: 0,
      deposit: 0,
    },
  });

  useEffect(() => {
    (async () => {
      if (pk) fetchAuction(new PublicKey(pk));
    })();
  }, [pk]);

  useEffect(() => {
    console.log("effect", "foo", pk, wallet?.publicKey?.toBase58());
    if (pk && wallet?.publicKey) {
      fetchOpenOrders(new PublicKey(pk), wallet.publicKey);
      fetchMintAndTokenAccount(selected?.auction.baseMint);
      fetchMintAndTokenAccount(selected?.auction.quoteMint);
    }
  }, [pk, wallet]);

  // useEffect(() => {
  //   console.log(
  //     "openBidModal",
  //     openBidModal,
  //     selected?.auction.quoteMint.toBase58()
  //   );
  //   if (openBidModal) {
  //     fetchMintAndTokenAccount(selected?.auction.baseMint);
  //     fetchMintAndTokenAccount(selected?.auction.quoteMint);
  //   }
  // }, [pk, openBidModal]);

  const createBid = async (data: any) => {
    (async () => {
      if (!wallet || !pk || !selected || !userBase || !userQuote) return;

      const auction = selected.auction;
      const { quoteMint, baseMint } = auction;

      // TODO: move to token store
      const baseDecimals = mints[baseMint.toBase58()]!.decimals;
      const quoteDecimals = mints[quoteMint.toBase58()]!.decimals;

      // TODO: move to auction store
      let [openOrdersPk] = await PublicKey.findProgramAddress(
        [
          wallet.publicKey!.toBuffer(),
          Buffer.from("open_orders"),
          Buffer.from(auction.auctionId),
          auction.authority.toBuffer(),
        ],
        programId
      );
      let [orderHistoryPk] = await PublicKey.findProgramAddress(
        [
          wallet.publicKey!.toBuffer(),
          Buffer.from("order_history"),
          Buffer.from(auction.auctionId),
          auction.authority.toBuffer(),
        ],
        programId
      );

      const tx = new Transaction();

      const openOrders = await OpenOrders.fetch(connection, openOrdersPk);
      if (!openOrders) {
        tx.add(
          initOpenOrders(
            { side: new Side.Bid(), maxOrders: 2 },
            {
              user: wallet.publicKey!,
              auction: new PublicKey(pk),
              openOrders: openOrdersPk,
              orderHistory: orderHistoryPk,
              quoteMint,
              baseMint,
              userQuote,
              userBase,
              systemProgram: SystemProgram.programId,
            }
          )
        );
      }
      console.log("createBid", watch(), auction);
      if (auction.areBidsEncrypted) {
        // convert into native values
        let price = toFp32(watch("price")).shln(32).div(auction.tickSize);
        let quantity = new BN(watch("amount") * Math.pow(10, baseDecimals));
        let tokenQty = new BN(watch("deposit") * Math.pow(10, quoteDecimals));
        console.log({ price, quantity, tokenQty });

        // encrypt native values
        let plainText = Buffer.concat(
          [price, quantity].map((bn) => {
            return bn.toArrayLike(Buffer, "le", 8);
          })
        );
        const nonce = nacl.randomBytes(nacl.box.nonceLength);

        console.log({
          plainText,
          nonce,
          pk: auction.naclPubkey,
          sk: secretKey,
        });
        let cipherText = nacl.box(
          Uint8Array.from(plainText),
          nonce,
          Uint8Array.from(auction.naclPubkey),
          secretKey
        );

        // local storage messes up my keys
        const naclPubkey = Buffer.alloc(nacl.box.publicKeyLength);
        for (let i = 0; i < nacl.box.publicKeyLength; ++i) {
          naclPubkey[i] = localOrderKey.publicKey[i];
        }

        console.log("createBid", "encrypted", naclPubkey, cipherText);
        tx.add(
          newEncryptedOrder(
            {
              tokenQty,
              naclPubkey: Array.from(naclPubkey),
              nonce: Array.from(nonce),
              cipherText: Array.from(cipherText),
            },
            {
              ...auction,

              user: wallet.publicKey!,
              auction: new PublicKey(pk),
              openOrders: openOrdersPk,
              userQuote,
              userBase,
              tokenProgram: TOKEN_PROGRAM_ID,
            }
          )
        );
      } else {
        tx.add(
          newOrder(
            {
              limitPrice: toFp32(watch("price")).shln(32).div(auction.tickSize),
              maxBaseQty: new BN(watch("amount") * Math.pow(10, baseDecimals)),
            },
            {
              ...auction,
              user: wallet.publicKey!,
              auction: new PublicKey(pk),
              openOrders: openOrdersPk,
              userQuote,
              userBase,
              tokenProgram: TOKEN_PROGRAM_ID,
            }
          )
        );
      }

      // send & confirm tx
      const sig = await wallet.sendTransaction(tx, connection);
      console.log("create bid", sig);

      await connection.confirmTransaction(sig);
      console.log("create bid confirmed");

      await fetchOpenOrders(new PublicKey(pk), wallet.publicKey!);
    })();
  };

  const cancelBid = async (i: number) => {
    console.log("cancel bid", i, { wallet, pk, selected, userBase, userQuote });

    if (!wallet || !pk || !selected || !userBase || !userQuote) return;
    const auction = selected.auction;

    let [openOrdersPk] = await PublicKey.findProgramAddress(
      [
        wallet.publicKey!.toBuffer(),
        Buffer.from("open_orders"),
        Buffer.from(auction.auctionId),
        auction.authority.toBuffer(),
      ],
      programId
    );

    const tx = new Transaction();
    tx.add(
      cancelEncryptedOrder(
        { orderIdx: i },
        {
          ...selected!.auction,
          user: wallet.publicKey!,
          auction: new PublicKey(pk),
          openOrders: openOrdersPk,
          userQuote,
          userBase,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      )
    );

    // send & confirm tx
    const sig = await wallet.sendTransaction(tx, connection);
    console.log("cancel bid", sig);

    await connection.confirmTransaction(sig);
    console.log("cancel bid confirmed");

    await fetchOpenOrders(new PublicKey(pk), wallet.publicKey!);
  };

  return (
    <>
      <h1>Actions:</h1>
      <div className="border p-1 inline-block">
        <button onClick={() => setOpenBidModal(true)}>bid</button>
      </div>

      <h1>Orders</h1>
      {orders?.oo && (
        <div>
          <p>Side: {orders.oo.side.kind}</p>
          <p>
            Base: {orders.oo.baseTokenFree.toString()} |{" "}
            {orders.oo.baseTokenLocked.toString()}
          </p>
          <p>
            Quote: {orders.oo.quoteTokenFree.toString()} |{" "}
            {orders.oo.quoteTokenLocked.toString()}
          </p>
          <p>Encrypted: {orders.oo.numOrders}</p>
          {decryptionKey &&
            orders.oo.encryptedOrders.map((o, i) => {
              try {
                const plainText = nacl.box.open.after(
                  Uint8Array.from(o.cipherText),
                  Uint8Array.from(o.nonce),
                  decryptionKey
                )!;
                const price =
                  new BN(plainText.slice(0, 8), undefined, "le")
                    .mul(selected!.auction.tickSize)
                    .shrn(32)
                    .toNumber() /
                  2 ** 32;
                const quantity =
                  new BN(plainText.slice(8, 16), undefined, "le").toNumber() /
                  10 ** 6;
                const deposit = o.tokenQty.toNumber() / 10 ** 6;
                return (
                  <div className="text-sm">
                    <p>Price: {price}</p>
                    <p>Quantity: {quantity}</p>
                    <p>Deposit: {deposit}</p>
                    <div className="border p-1 inline-block">
                      <button onClick={() => cancelBid(i)}>cancel</button>
                    </div>{" "}
                  </div>
                );
              } catch (e) {
                console.error(e);
                return <></>;
              }
            })}
        </div>
      )}

      <h1>Auction:</h1>
      <p>Pk: {pk}</p>
      <p>Tick Size: {selected && selected.auction.tickSize.toNumber()}</p>

      <p>Bids: </p>
      {selected?.bids.getL2DepthJS(10, false).map((p) => (
        <p>
          {p.size} @ {p.price}
        </p>
      ))}

      <p>Asks:</p>
      {selected?.asks.getL2DepthJS(10, true).map((p) => (
        <p>
          {p.size} @ {p.price}
        </p>
      ))}

      {openBidModal && (
        <Modal
          onClose={() => {
            setOpenBidModal(false);
          }}
          isOpen={openBidModal}
        >
          <div className="">
            <h2 className="text-xl">Create Bid</h2>
            <form onSubmit={handleSubmit(createBid)}>
              <p>
                Quote Balance:{" "}
                {tokenAccounts[
                  selected?.auction.quoteMint.toBase58()!
                ]?.amount.toString()}
              </p>

              <div>
                <label className="space-x-2">
                  <span>Amount:</span>
                  <input
                    type="number"
                    className="border"
                    {...register("amount")}
                  />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Price:</span>
                  <input
                    type="number"
                    className="border"
                    {...register("price")}
                  />
                </label>
              </div>

              {selected?.auction.areBidsEncrypted && (
                <div>
                  <label className="space-x-2">
                    <span>Deposit:</span>
                    <input
                      type="number"
                      className="border"
                      {...register("deposit")}
                    />
                  </label>
                </div>
              )}
              <input className="border p-1" type="submit" />
            </form>
          </div>
        </Modal>
      )}
    </>
  );
};

export default AuctionView;
