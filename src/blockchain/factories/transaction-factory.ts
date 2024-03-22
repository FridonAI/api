import {
  Transaction,
  TransactionInstruction,
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
  Signer,
  PublicKey,
  TransactionCtorFields_DEPRECATED,
  PublicKeyInitData,
  ComputeBudgetProgram,
  // LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getLatestBlockHash } from '../utils/connection';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { InjectQueue } from '@nestjs/bullmq';
import { TransactionListenerQueue } from '../transaction-listener/types';
import { Injectable } from '@nestjs/common';

export type TransactionComputeOpts = {
  computePrice?: number;
  computeLimit?: number;
};

export type TransactionData = {
  message: TransactionMessage;
  signers: (Keypair | Signer)[];
  addressLookupTable: AddressLookupTableAccount[];
};
export const SOURCE_TOKEN_OWNER_SECRET = [
  138, 8, 136, 219, 211, 225, 17, 190, 193, 198, 115, 209, 47, 16, 21, 238, 34,
  110, 106, 39, 232, 23, 249, 81, 34, 137, 171, 111, 22, 178, 3, 9, 81, 100,
  174, 205, 90, 48, 119, 243, 97, 126, 228, 142, 198, 143, 58, 25, 136, 31, 192,
  243, 201, 243, 111, 167, 139, 30, 110, 159, 24, 219, 21, 81,
];

@Injectable()
export class TransactionFactory {
  constructor(
    @InjectQueue('transaction-listener')
    private readonly transactionListenerQueue: TransactionListenerQueue,
  ) {}

  async sendTransaction(
    ix: TransactionInstruction,
    connection: Connection,
    keypairs: Keypair,
  ) {
    const tx = new Transaction();

    tx.add(ix);

    const blockHashResponse = await connection.getLatestBlockhash();

    tx.recentBlockhash = blockHashResponse.blockhash;
    tx.feePayer = keypairs.publicKey;

    tx.partialSign(keypairs);

    console.log(JSON.stringify(tx, null, ' '));

    const serializedTx = tx.serialize();

    const txId = await connection.sendRawTransaction(serializedTx, {
      skipPreflight: true,
    });

    return txId;
  }

  async addSignerToBuffer(buffer: Uint8Array) {
    const sourceTokenOwner = Keypair.fromSecretKey(
      new Uint8Array(SOURCE_TOKEN_OWNER_SECRET),
    );
    const wallet = new NodeWallet(sourceTokenOwner);

    const tx = VersionedTransaction.deserialize(buffer);
    const signedTx = await wallet.signTransaction(tx);

    return signedTx.serialize();
  }

  async sendSerializedTransaction(
    connection: Connection,
    serializedTransaction: Buffer | Uint8Array,
  ) {
    try {
      const txId = await connection.sendRawTransaction(serializedTransaction, {
        skipPreflight: false,
        preflightCommitment: 'processed',
      });

      await this.transactionListenerQueue.add(
        `TransactionListener[${txId}]`,
        {
          transactionId: txId,
          count: 0,
        },
        {
          delay: 3000,
        },
      );
      return txId;
    } catch (e: any) {
      console.error('Failed to send Serialized Transaction!', e);
      return { completed: false, error: e.message };
    }
  }

  async generateTransactionV0(
    instructions: TransactionInstruction[],
    feePayer: PublicKeyInitData,
    connection: Connection,
    signers?: Signer[],
    addressLookupTable?: AddressLookupTableAccount | undefined,
  ) {
    const priorityPrice = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 5000,
    });
    instructions.push(priorityPrice);

    const message = new TransactionMessage({
      instructions: instructions,
      recentBlockhash: (await getLatestBlockHash(connection)).blockhash,
      payerKey: new PublicKey(feePayer),
    }).compileToV0Message(
      addressLookupTable ? [addressLookupTable] : undefined,
    );

    const tx = new VersionedTransaction(message);

    if (signers) {
      tx.sign(signers);
    }

    return tx;
  }

  async generateBaseTransaction(
    {
      tx,
      ...fields
    }: TransactionCtorFields_DEPRECATED & { tx?: Transaction } = {},
    connection: Connection,
  ): Promise<Transaction> {
    if (!tx) tx = new Transaction(fields);

    const blockchashResponse = await getLatestBlockHash(connection);
    console.log('last valid block: ', blockchashResponse.lastValidBlockHeight);

    tx.recentBlockhash = blockchashResponse.blockhash;
    console.log('recent blockhash: ', tx.recentBlockhash);
    if (fields?.feePayer) {
      tx.feePayer = new PublicKey(fields?.feePayer);
    }

    return tx;
  }
}
