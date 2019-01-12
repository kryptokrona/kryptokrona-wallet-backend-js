// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';
import { GLOBAL_INDEXES_OBSCURITY } from './Constants';
import { IDaemon } from './IDaemon';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { LogCategory, logger, LogLevel } from './Logger';
import { SubWallets } from './SubWallets';
import { SynchronizationStatus } from './SynchronizationStatus';

import {
    Block, KeyInput, RawCoinbaseTransaction, RawTransaction, Transaction,
    TransactionData, TransactionInput,
} from './Types';

import { getLowerBound, getUpperBound } from './Utilities';

import * as _ from 'lodash';

export class WalletSynchronizer {

    public static fromJSON(json: WalletSynchronizerJSON): WalletSynchronizer {
        const walletSynchronizer = Object.create(WalletSynchronizer.prototype);

        return Object.assign(walletSynchronizer, json, {
            privateViewKey: json.privateViewKey,
            startHeight: json.startHeight,
            startTimestamp: json.startTimestamp,
            synchronizationStatus: SynchronizationStatus.fromJSON(json.transactionSynchronizerStatus),
        });
    }

    private daemon: IDaemon;

    private startTimestamp: number;

    private startHeight: number;

    private readonly privateViewKey: string;

    private synchronizationStatus: SynchronizationStatus = new SynchronizationStatus();

    private subWallets: SubWallets;

    constructor(
        daemon: IDaemon,
        subWallets: SubWallets,
        startTimestamp: number,
        startHeight: number,
        privateViewKey: string) {

        this.daemon = daemon;
        this.startTimestamp = startTimestamp;
        this.startHeight = startHeight;
        this.privateViewKey = privateViewKey;
        this.subWallets = subWallets;
    }

    public initAfterLoad(subWallets: SubWallets, daemon: IDaemon): void {
        this.subWallets = subWallets;
        this.daemon = daemon;
    }

    public toJSON(): WalletSynchronizerJSON {
        return {
            privateViewKey: this.privateViewKey,
            startHeight: this.startHeight,
            startTimestamp: this.startTimestamp,
            transactionSynchronizerStatus: this.synchronizationStatus.toJSON(),
        };
    }

    public async getBlocks(): Promise<Block[]> {
        const localDaemonBlockCount: number = this.daemon.getLocalDaemonBlockCount();

        const walletBlockCount: number = this.synchronizationStatus.getHeight();

        /* Local daemon has less blocks than the wallet:

        With the get wallet sync data call, we give a height or a timestamp to
        start at, and an array of block hashes of the last known blocks we
        know about.

        If the daemon can find the hashes, it returns the next one it knows
        about, so if we give a start height of 200,000, and a hash of
        block 300,000, it will return block 300,001 and above.

        This works well, since if the chain forks at 300,000, it won't have the
        hash of 300,000, so it will return the next hash we gave it,
        in this case probably 299,999.

        On the wallet side, we'll detect a block lower than our last known
        block, and handle the fork.

        However, if we're syncing our wallet with an unsynced daemon,
        lets say our wallet is at height 600,000, and the daemon is at 300,000.
        If our start height was at 200,000, then since it won't have any block
        hashes around 600,000, it will start returning blocks from
        200,000 and up, discarding our current progress.

        Therefore, we should wait until the local daemon has more blocks than
        us to prevent discarding sync data. */
        if (localDaemonBlockCount < walletBlockCount) {
            return [];
        }

        /* The block hashes to try begin syncing from */
        const blockCheckpoints: string[] = this.synchronizationStatus.getBlockHashCheckpoints();

        let blocks: Block[] = [];

        try {
            blocks = await this.daemon.getWalletSyncData(
                blockCheckpoints, this.startHeight, this.startTimestamp,
            );
        } catch (err) {
            logger.log(
                'Failed to get blocks from daemon',
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            return [];
        }

        if (blocks.length === 0) {
            logger.log(
                'Zero blocks received from daemon, possibly fully synced',
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            return [];
        }

        /* Timestamp is transient and can change - block height is constant. */
        if (this.startTimestamp !== 0) {
            this.startTimestamp = 0;
            this.startHeight = blocks[0].blockHeight;

            this.subWallets.convertSyncTimestampToHeight(
                this.startTimestamp, this.startHeight,
            );
        }

        /* If checkpoints are empty, this is the first sync request. */
        if (_.isEmpty(blockCheckpoints)) {
            const actualHeight: number = blocks[0].blockHeight;

            /* Only check if a timestamp isn't given */
            if (this.startTimestamp === 0) {
                /* The height we expect to get back from the daemon */
                if (actualHeight !== this.startHeight) {
                    throw new Error(
                        'Received unexpected block height from daemon. ' +
                        'Expected ' + this.startHeight + ', got ' + actualHeight + '\n',
                    );
                }
            }
        }

        return blocks;
    }

    /* When we get the global indexes, we pass in a range of blocks, to obscure
       which transactions we are interested in - the ones that belong to us.
       To do this, we get the global indexes for all transactions in a range.

       For example, if we want the global indexes for a transaction in block
       17, we get all the indexes from block 10 to block 20. */
    public async getGlobalIndexes(blockHeight: number, hash: string): Promise<number[]> {
        const startHeight: number = getLowerBound(blockHeight, GLOBAL_INDEXES_OBSCURITY);
        const endHeight: number = getUpperBound(blockHeight, GLOBAL_INDEXES_OBSCURITY);

        const indexes: Map<string, number[]> = await this.daemon.getGlobalIndexesForRange(
            startHeight, endHeight,
        );

        /* If the indexes returned doesn't include our array, the daemon is
           faulty. If we can't connect to the daemon, it will throw instead,
           which we will catch further up */
        const ourIndexes: number[] | undefined = indexes.get(hash);

        if (!ourIndexes) {
            throw new Error('Could not get global indexes from daemon! ' +
                            'Possibly faulty/malicious daemon.');
        }

        return ourIndexes;
    }

    public processTransactionInputs(
        keyInputs: KeyInput[],
        transfers: Map<string, number>,
        blockHeight: number,
        txData: TransactionData): [number, Map<string, number>, TransactionData] {

        let sumOfInputs: number = 0;

        for (const input of keyInputs) {
            sumOfInputs += input.amount;

            const [found, publicSpendKey] = this.subWallets.getKeyImageOwner(
                input.keyImage,
            );

            if (found) {
                transfers.set(
                    publicSpendKey,
                    input.amount + (transfers.get(publicSpendKey) || 0),
                );

                txData.keyImagesToMarkSpent.push([publicSpendKey, input.keyImage]);
            }
        }

        return [sumOfInputs, transfers, txData];
    }

    public async processTransactionOutputs(
        rawTX: RawCoinbaseTransaction,
        transfers: Map<string, number>,
        blockHeight: number,
        txData: TransactionData): Promise<[number, Map<string, number>, TransactionData]> {

        const derivation: string = CryptoUtils.generateKeyDerivation(
            rawTX.transactionPublicKey, this.privateViewKey,
        );

        let sumOfOutputs: number = 0;

        let globalIndexes: number[] = [];

        const spendKeys: string[] = this.subWallets.getPublicSpendKeys();

        for (const [outputIndex, output] of rawTX.keyOutputs.entries()) {
            sumOfOutputs += output.amount;

            /* If we have a single subwallet, use derivePublicKey. It's faster
               than underivePublicKey */
            const singleSubWallet: boolean = spendKeys.length === 1;

            /* The public spend key of the subwallet that owns this input */
            let ownerSpendKey: string;

            if (singleSubWallet) {
                const derivedOutputKey = CryptoUtils.derivePublicKey(
                    derivation, outputIndex, spendKeys[0],
                );

                /* If the derived output key matches the actual output key, it's
                   our output */
                if (derivedOutputKey !== output.key) {
                    continue;
                }

                ownerSpendKey = spendKeys[0];
            } else {
                /* Derive the spend key from the transaction, using the previous
                   derivation */
                const derivedSpendKey = CryptoUtils.underivePublicKey(
                    derivation, outputIndex, output.key,
                );

                /* See if the derived spend key matches any of our spend keys */
                if (!_.includes(spendKeys, derivedSpendKey)) {
                    continue;
                }

                ownerSpendKey = derivedSpendKey;
            }

            /* Get the indexes, if we haven't already got them. (Don't need
               to get them if we're in a view wallet, since we can't spend.) */
            if (_.isEmpty(globalIndexes) && !this.subWallets.isViewWallet) {
                globalIndexes = await this.getGlobalIndexes(blockHeight, rawTX.hash);
            }

            transfers.set(
                ownerSpendKey,
                output.amount + (transfers.get(ownerSpendKey) || 0),
            );

            /* We're not gonna use it in a view wallet, so just set to zero */
            const globalOutputIndex: number
                = this.subWallets.isViewWallet ? globalIndexes[outputIndex] : 0;

            /* Not spent yet! */
            const spendHeight: number = 0;

            const keyImage = this.subWallets.getTxInputKeyImage(
                ownerSpendKey, derivation, outputIndex,
            );

            const txInput: TransactionInput = new TransactionInput(
                keyImage, output.amount, blockHeight,
                rawTX.transactionPublicKey, outputIndex, globalOutputIndex,
                output.key, spendHeight, rawTX.unlockTime, rawTX.hash,
            );

            txData.inputsToAdd.push([ownerSpendKey, txInput]);
        }

        return [sumOfOutputs, transfers, txData];
    }

    public async processTransaction(
        rawTX: RawTransaction,
        blockTimestamp: number,
        blockHeight: number,
        txData: TransactionData): Promise<TransactionData> {

        let transfers: Map<string, number> = new Map();

        let sumOfInputs: number;
        let sumOfOutputs: number;

        /* Finds the sum of inputs, adds the amounts that belong to us to the
           transfers map */
        [sumOfInputs, transfers, txData] = this.processTransactionInputs(
            rawTX.keyInputs, transfers, blockHeight, txData,
        );

        /* Finds the sum of outputs, adds the amounts that belong to us to the
           transfers map, and stores any key images that belong to us */
        [sumOfOutputs, transfers, txData] = await this.processTransactionOutputs(
            rawTX, transfers, blockHeight, txData,
        );

        if (!_.isEmpty(transfers)) {
            const fee: number = sumOfInputs - sumOfOutputs;

            const isCoinbaseTransaction: boolean = false;

            const tx: Transaction = new Transaction(
                transfers, rawTX.hash, fee, blockTimestamp, blockHeight,
                rawTX.paymentID, rawTX.unlockTime, isCoinbaseTransaction,
            );

            txData.transactionsToAdd.push(tx);
        }

        return txData;
    }

    public async processCoinbaseTransaction(
        rawTX: RawCoinbaseTransaction,
        blockTimestamp: number,
        blockHeight: number,
        txData: TransactionData): Promise<TransactionData> {

        let transfers: Map<string, number> = new Map();

        [/*ignore*/, transfers, txData] = await this.processTransactionOutputs(
            rawTX, transfers, blockHeight, txData,
        );

        if (!_.isEmpty(transfers)) {
            /* Coinbase transaction have no fee */
            const fee: number = 0;

            const isCoinbaseTransaction: boolean = true;

            /* Coibnase transactions can't have payment ID's */
            const paymentID: string = '';

            const tx: Transaction = new Transaction(
                transfers, rawTX.hash, fee, blockTimestamp, blockHeight,
                paymentID, rawTX.unlockTime, isCoinbaseTransaction,
            );

            txData.transactionsToAdd.push(tx);
        }

        return txData;
    }

    public getHeight(): number {
        return this.synchronizationStatus.getHeight();
    }

    public checkLockedTransactions(transactionHashes: string[]): string[] {
        /* TODO */
        return [];
    }

    public storeBlockHash(blockHeight: number, blockHash: string): void {
        this.synchronizationStatus.storeBlockHash(blockHeight, blockHash);
    }
}
