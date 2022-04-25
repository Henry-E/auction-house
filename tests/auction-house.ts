import * as anchor from "@project-serum/anchor";
import { Program, ProgramError } from "@project-serum/anchor";
import { createMint, createMintToCheckedInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AuctionHouse } from "../target/types/auction_house";

import * as gen_instructions from "../generated/instructions";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";

describe("auction-house", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  const wallet = provider.wallet as anchor.Wallet;
  anchor.setProvider(provider);

  const program = anchor.workspace.AuctionHouse as Program<AuctionHouse>;
  

  let baseMint, quoteMint;

  it("Init mints!", async () => {

    baseMint = await createMint(provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
      );
    quoteMint = await createMint(provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
      );

  });

  it("inits the auction", async() => {
    let tx = new anchor.web3.Transaction();
    let nowBn = new anchor.BN(Date.now() / 1000);
    let [auction] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("auction"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let [quoteVault] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("quote_vault"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let [baseVault] = await anchor.web3.PublicKey.findProgramAddress(
      // TODO toBuffer might not be LE (lower endian) by default
      [Buffer.from("base_vault"), nowBn.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )
    let eventQueueKeypair = new anchor.web3.Keypair();
    let bidsKeypair = new anchor.web3.Keypair();
    let asksKeypair = new anchor.web3.Keypair();
    tx.add(gen_instructions.initAuction(
      {
        args: {
          startOrderPhase: nowBn,
          endOrderPhase: nowBn.add(new anchor.BN(5)),
          endDecryptionPhase: nowBn.add(new anchor.BN(10)),
          areAsksEncrypted: false,
          areBidsEncrypted: true,
          minBaseOrderSize: new anchor.BN(0),
          tickSize: new anchor.BN(0),
        }
      },
      {
        auctioneer: wallet.publicKey,
        auction,
        eventQueue: eventQueueKeypair.publicKey,
        bids: bidsKeypair.publicKey,
        asks: asksKeypair.publicKey,
        quoteMint,
        baseMint,
        quoteVault,
        baseVault,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      }
    ))
  });
});
