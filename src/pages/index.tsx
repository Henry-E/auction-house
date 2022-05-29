import { BN, getProvider } from "@project-serum/anchor";
import {
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import useAuctionStore, { fetchAuctions } from "../stores/AuctionStore";
import * as nacl from "tweetnacl";
import { Auction, getCreateAccountParams, toFp32 } from "../../tests/sdk";
import { initAuction } from "../../generated/instructions";
import { Auction as GenAuction } from "../../generated/accounts";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import Modal from "../components/Modal";
import useLocalStorageState, {
  handleParseKeyPairArray,
} from "../hooks/useLocalStorageState";

const AuctionItem = ({
  pk,
  auction,
  localAuctionKeys,
}: {
  pk: PublicKey;
  auction: GenAuction;
  localAuctionKeys: nacl.BoxKeyPair[];
}) => {
  const localAuctionKeyIndex = localAuctionKeys
    .map((a) => a.publicKey)
    .findIndex((a) => auction.naclPubkey.every((b, i) => b === a[i]));

  return (
    <>
      <tr key={pk.toString()}>
        <td>{auction.auctionId}</td>
        <td>
          {new Date(auction.startOrderPhase.toNumber() * 1000).toLocaleString()}
        </td>
        <td>
          {new Date(auction.endOrderPhase.toNumber() * 1000).toLocaleString()}
        </td>
        <td>
          {new Date(
            auction.endDecryptionPhase.toNumber() * 1000
          ).toLocaleString()}
        </td>
        <td>{auction.clearingPrice.toNumber()}</td>
        <td>{auction.totalQuantityMatched.toNumber()}</td>
        <td>{auction.remainingBidFills.toNumber()}</td>
        <td>{auction.remainingAskFills.toNumber()}</td>
        <td>
          <a href={`/auction/${pk.toBase58()}`}>user</a>
          {localAuctionKeyIndex > -1 && (
            <>
              <span> </span>
              <a href={`/admin/${pk.toBase58()}`}>admin</a>
            </>
          )}
        </td>
      </tr>
    </>
  );
};

const AuctionsList = () => {
  const { program, auctions, loadingAuctions } = useAuctionStore((s) => s);

  const [localAuctionKeys, setLocalAuctionKeys] = useLocalStorageState(
    "localAuctionKeys",
    [] as nacl.BoxKeyPair[],
    handleParseKeyPairArray
  );

  const [openCreateAuctionModal, setOpenCreateAuctionModal] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      baseMint: "GoES7CDvee2AiNWNBoGuuQnEwD8b1qyMXL77cxSDf3Vd",
      quoteMint: "ATDQACtXEBK6C5p8qc7bXBswi12FSBgbzTuLhR1fpeUC",
      areAsksEncrypted: false,
      areBidsEncrypted: true,
      minBaseOrderSize: 1000,
      tickSize: 0.1,
      orderPhaseLength: 86400, // 24h
      decryptionPhaseLength: 3600, // 1h
      eventQueueBytes: 1000000,
      bidsBytes: 64000,
      asksBytes: 64000,
      maxOrders: 2,
    },
  });

  useEffect(() => {
    fetchAuctions();
  }, []);

  const createAuction = async (data: any) => {
    const provider = getProvider();
    console.log("auction", data, provider);

    let tx = new Transaction();
    let signers: Signer[] = [];

    const auctionId = Buffer.alloc(10);
    auctionId.writeUIntLE(Date.now(), 0, 6);

    let nowBn = new BN(Date.now() / 1000);
    // let auctionIdArray = Array.from(auctionId);
    let [auctionPk] = await PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [
        Buffer.from("auction"),
        Buffer.from(auctionId),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId
    );
    let [quoteVault] = await PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [
        Buffer.from("quote_vault"),
        Buffer.from(auctionId),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId
    );
    let [baseVault] = await PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [
        Buffer.from("base_vault"),
        Buffer.from(auctionId),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId
    );
    let eventQueueKeypair = new Keypair();
    let eventQueue = eventQueueKeypair.publicKey;
    let bidsKeypair = new Keypair();
    let bids = bidsKeypair.publicKey;
    let asksKeypair = new Keypair();
    let asks = asksKeypair.publicKey;
    let localAuctionKey = nacl.box.keyPair();
    setLocalAuctionKeys(localAuctionKeys.concat([localAuctionKey]));

    const auction: Auction = {
      ...data,
      auctioneer: provider.wallet.publicKey,
      auction: auctionPk,
      eventQueue,
      eventQueueKeypair,
      bids,
      bidsKeypair,
      asks,
      asksKeypair,
      quoteMint: new PublicKey(data.quoteMint),
      baseMint: new PublicKey(data.baseMint),
      quoteVault,
      baseVault,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      // Args
      auctionId,
      startOrderPhase: nowBn,
      endOrderPhase: nowBn.add(new BN(data.orderPhaseLength)),
      endDecryptionPhase: nowBn.add(
        new BN(data.orderPhaseLength + data.decryptionPhaseLength)
      ),
      minBaseOrderSize: new BN(data.minBaseOrderSize),
      tickSize: toFp32(data.tickSize),
      naclPubkey: localAuctionKey.publicKey,
    };

    console.log("auction", auction.auctioneer.toBase58());

    let eventQueueParams = await getCreateAccountParams(
      program,
      provider,
      provider.wallet as any,
      eventQueue,
      data.eventQueueBytes
    );
    tx.add(SystemProgram.createAccount(eventQueueParams));
    let bidsParams = await getCreateAccountParams(
      program,
      provider,
      provider.wallet as any,
      bids,
      data.bidsBytes
    );
    tx.add(SystemProgram.createAccount(bidsParams));
    let asksParams = await getCreateAccountParams(
      program,
      provider,
      provider.wallet as any,
      auction.asks,
      data.asksBytes
    );
    tx.add(SystemProgram.createAccount(asksParams));
    tx.add(initAuction({ args: { ...auction } }, { ...auction }));
    await provider.send(
      tx,
      [auction.eventQueueKeypair, auction.bidsKeypair, auction.asksKeypair],
      { skipPreflight: true }
    );

    let thisAuction = await program.account.auction.fetch(auction.auction);

    fetchAuctions();
    console.log(thisAuction);
  };

  return (
    <>
      <div className="flex space-x-2">
        <h1 className="p-1">Auctions</h1>
        <div className="border p-1">
          {loadingAuctions ? (
            "xxxxx"
          ) : (
            <button onClick={fetchAuctions}>fetch</button>
          )}
        </div>
        <div className="border p-1">
          <button onClick={() => setOpenCreateAuctionModal(true)}>
            create
          </button>
        </div>
      </div>
      <table className="table-auto">
        <thead>
          <tr>
            <th>PK</th>
            <th>Start</th>
            <th>End</th>
            <th>Settlement</th>
            <th>ClearingPrice</th>
            <th>TotalMatched</th>
            <th>RemainingBids</th>
            <th>RemainingAsks</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {auctions.map((a) => (
            <AuctionItem
              key={a.publicKey}
              pk={a.publicKey}
              auction={new GenAuction(a.account)}
              localAuctionKeys={localAuctionKeys}
            />
          ))}
        </tbody>
      </table>
      {openCreateAuctionModal && (
        <Modal
          onClose={() => {
            setOpenCreateAuctionModal(false);
          }}
          isOpen={openCreateAuctionModal}
        >
          <div className="">
            <h2 className="text-xl">Create Auction</h2>
            <form onSubmit={handleSubmit(createAuction)}>
              <div>
                <label className="space-x-2">
                  <span>Base Mint:</span>
                  <input className="border" {...register("baseMint")} />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Quote Mint:</span>
                  <input className="border" {...register("quoteMint")} />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Encrypt Asks</span>
                  <input type="checkbox" {...register("areAsksEncrypted")} />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Encrypt Bids</span>
                  <input type="checkbox" {...register("areBidsEncrypted")} />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Min Base Order Size:</span>
                  <input className="border" {...register("minBaseOrderSize")} />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Tick Size:</span>
                  <input className="border" {...register("tickSize")} />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Order Phase Duration (s):</span>
                  <input className="border" {...register("orderPhaseLength")} />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Decryption Phase Duration (s):</span>
                  <input
                    className="border"
                    {...register("decryptionPhaseLength")}
                  />
                </label>
              </div>

              <div>
                <label className="space-x-2">
                  <span>Event Queue Bytes:</span>
                  <input className="border" {...register("eventQueueBytes")} />
                </label>
              </div>
              <div>
                <label className="space-x-2">
                  <span>Bids Bytes:</span>
                  <input className="border" {...register("bidsBytes")} />
                </label>
              </div>
              <div>
                <label className="space-x-2">
                  <span>Asks Bytes:</span>
                  <input className="border" {...register("asksBytes")} />
                </label>
              </div>
              <div>
                <label className="space-x-2">
                  <span>Max Orders (per User):</span>
                  <input className="border" {...register("maxOrders")} />
                </label>
              </div>

              <input className="border p-1" type="submit" />
            </form>
          </div>
        </Modal>
      )}
    </>
  );
};

export default AuctionsList;
