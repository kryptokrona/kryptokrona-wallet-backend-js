// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

import Config from './Config';

import { IDaemon } from './IDaemon';
import { SubWallets } from './SubWallets';
import { CryptoUtils } from './CnUtils';
import { SynchronizationStatus } from './SynchronizationStatus';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { LogCategory, logger, LogLevel } from './Logger';

import {
    Block, KeyInput, RawCoinbaseTransaction, RawTransaction, Transaction,
    TransactionData, TransactionInput,
} from './Types';

/**
 * Decrypts blocks for our transactions and inputs
 */
export class WalletSynchronizer {

    public static fromJSON(json: WalletSynchronizerJSON): WalletSynchronizer {
        const walletSynchronizer = Object.create(WalletSynchronizer.prototype);

        return Object.assign(walletSynchronizer, {
            privateViewKey: json.privateViewKey,
            startHeight: json.startHeight,
            startTimestamp: json.startTimestamp,
            synchronizationStatus: SynchronizationStatus.fromJSON(json.transactionSynchronizerStatus),
        });
    }

    /**
     * The daemon instance to retrieve blocks from
     */
    private daemon: IDaemon;

    /**
     * The timestamp to start taking blocks from
     */
    private startTimestamp: number;

    /**
     * The height to start taking blocks from
     */
    private startHeight: number;

    /**
     * The shared private view key of this wallet
     */
    private readonly privateViewKey: string;

    /**
     * Stores the progress of our synchronization
     */
    private synchronizationStatus: SynchronizationStatus = new SynchronizationStatus();

    /**
     * Used to find spend keys, inspect key images, etc
     */
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

    /**
     * Initialize things we can't initialize from the JSON
     */
    public initAfterLoad(subWallets: SubWallets, daemon: IDaemon): void {
        this.subWallets = subWallets;
        this.daemon = daemon;
    }

    /**
     * Convert from class to stringable type
     */
    public toJSON(): WalletSynchronizerJSON {
        return {
            privateViewKey: this.privateViewKey,
            startHeight: this.startHeight,
            startTimestamp: this.startTimestamp,
            transactionSynchronizerStatus: this.synchronizationStatus.toJSON(),
        };
    }

    /**
     * Download the next set of blocks from the daemon
     */
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

    public processBlock(
        block: Block,
        ourInputs: Array<[string, TransactionInput]>) {

        const txData: TransactionData = new TransactionData();

        if (Config.scanCoinbaseTransactions) {
            const tx: Transaction | undefined = this.processCoinbaseTransaction(
                block, ourInputs,
            );

            if (tx) {
                txData.transactionsToAdd.push(tx);
            }
        }

        for (const rawTX of block.transactions) {
            const [tx, keyImagesToMarkSpent] = this.processTransaction(
                block, ourInputs, rawTX,
            );

            if (tx) {
                txData.transactionsToAdd.push(tx);
                txData.keyImagesToMarkSpent = txData.keyImagesToMarkSpent.concat(
                    keyImagesToMarkSpent,
                );
            }
        }

        txData.inputsToAdd = ourInputs;

        return txData;
    }

    /**
     * Process transaction outputs of the given block. No external dependencies,
     * lets us easily swap out with a C++ replacement for SPEEEED
     *
     * @param keys Array of spend keys in the format [publicKey, privateKey]
     */
    public processBlockOutputs(
        block: Block,
        privateViewKey: string,
        spendKeys: Array<[string, string]>,
        isViewWallet: boolean,
        processCoinbaseTransactions: boolean): Array<[string, TransactionInput]> {

        let inputs: Array<[string, TransactionInput]> = [];

        /* Process the coinbase tx if we're not skipping them for speed */
        if (processCoinbaseTransactions) {
            inputs = inputs.concat(this.processTransactionOutputs(
                block.coinbaseTransaction, block.blockHeight,
            ));
        }

        /* Process the normal txs */
        for (const tx of block.transactions) {
            inputs = inputs.concat(this.processTransactionOutputs(
                tx, block.blockHeight,
            ));
        }

        return inputs;
    }

    /**
     * Get the height of the sync process
     */
    public getHeight(): number {
        return this.synchronizationStatus.getHeight();
    }

    /**
     * Takes in hashes that we have previously sent. Returns transactions which
     * are no longer in the pool, and not in a block, and therefore have
     * returned to our wallet
     */
    public async findCancelledTransactions(transactionHashes: string[]): Promise<string[]> {
        /* This is the common case - don't waste time making a useless request
           to the daemon */
        if (_.isEmpty(transactionHashes)) {
            return [];
        }

        return this.daemon.getCancelledTransactions(transactionHashes);
    }

    public storeBlockHash(blockHeight: number, blockHash: string): void {
        this.synchronizationStatus.storeBlockHash(blockHeight, blockHash);
    }

    /**
     * Process the outputs of a transaction, and create inputs that are ours
     */
    private processTransactionOutputs(
        rawTX: RawCoinbaseTransaction,
        blockHeight: number): Array<[string, TransactionInput]> {

        const inputs: Array<[string, TransactionInput]> = [];

        const derivation: string = CryptoUtils.generateKeyDerivation(
            rawTX.transactionPublicKey, this.privateViewKey,
        );

        const spendKeys: string[] = this.subWallets.getPublicSpendKeys();

        for (const [outputIndex, output] of rawTX.keyOutputs.entries()) {
            /* Derive the spend key from the transaction, using the previous
               derivation */
            const derivedSpendKey = CryptoUtils.underivePublicKey(
                derivation, outputIndex, output.key,
            );

            /* See if the derived spend key matches any of our spend keys */
            if (!_.includes(spendKeys, derivedSpendKey)) {
                continue;
            }

            /* The public spend key of the subwallet that owns this input */
            const ownerSpendKey = derivedSpendKey;

            /* Not spent yet! */
            const spendHeight: number = 0;

            const keyImage = this.subWallets.getTxInputKeyImage(
                ownerSpendKey, derivation, outputIndex,
            );

            const txInput: TransactionInput = new TransactionInput(
                keyImage, output.amount, blockHeight,
                rawTX.transactionPublicKey, outputIndex, output.globalIndex,
                output.key, spendHeight, rawTX.unlockTime, rawTX.hash,
            );

            inputs.push([ownerSpendKey, txInput]);
        }

        return inputs;
    }

    private processCoinbaseTransaction(
        block: Block,
        ourInputs: Array<[string, TransactionInput]>): Transaction | undefined {

        const rawTX: RawCoinbaseTransaction = block.coinbaseTransaction;

        const transfers: Map<string, number> = new Map();

        const relevantInputs: Array<[string, TransactionInput]>
            = _.filter(ourInputs, ([key, input]) => {
            return input.parentTransactionHash === block.coinbaseTransaction.hash;
        });

        for (const [publicSpendKey, input] of relevantInputs) {
            transfers.set(
                publicSpendKey,
                input.amount + (transfers.get(publicSpendKey) || 0),
            );
        }

        if (!_.isEmpty(transfers)) {
            /* Coinbase transaction have no fee */
            const fee: number = 0;

            const isCoinbaseTransaction: boolean = true;

            /* Coinbase transactions can't have payment ID's */
            const paymentID: string = '';

            return new Transaction(
                transfers, rawTX.hash, fee, block.blockTimestamp, block.blockHeight,
                paymentID, rawTX.unlockTime, isCoinbaseTransaction,
            );
        }

        return undefined;
    }

    private processTransaction(
        block: Block,
        ourInputs: Array<[string, TransactionInput]>,
        rawTX: RawTransaction): [Transaction | undefined, Array<[string, string]>] {

        const transfers: Map<string, number> = new Map();

        const relevantInputs: Array<[string, TransactionInput]>
            = _.filter(ourInputs, ([key, input]) => {
            return input.parentTransactionHash === rawTX.hash;
        });

        for (const [publicSpendKey, input] of relevantInputs) {
            transfers.set(
                publicSpendKey,
                input.amount + (transfers.get(publicSpendKey) || 0),
            );
        }

        const spentKeyImages: Array<[string, string]> = [];

        for (const input of rawTX.keyInputs) {
            const [found, publicSpendKey] = this.subWallets.getKeyImageOwner(
                input.keyImage,
            );

            if (found) {
                transfers.set(
                    publicSpendKey,
                    -input.amount + (transfers.get(publicSpendKey) || 0),
                );

                spentKeyImages.push([publicSpendKey, input.keyImage]);
            }
        }

        if (!_.isEmpty(transfers)) {
            const fee: number = _.sumBy(rawTX.keyInputs,  'amount') -
                                _.sumBy(rawTX.keyOutputs, 'amount');

            const isCoinbaseTransaction: boolean = false;

            return [new Transaction(
                transfers, rawTX.hash, fee, block.blockTimestamp,
                block.blockHeight, rawTX.paymentID, rawTX.unlockTime,
                isCoinbaseTransaction,
            ), spentKeyImages];
        }

        return [undefined, []];
    }
}
