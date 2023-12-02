// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';
const sizeof = require('object-sizeof');

import { EventEmitter } from 'events';

import { Config } from './Config';
import { Daemon } from './Daemon';
import { SubWallets } from './SubWallets';
import { prettyPrintBytes } from './Utilities';
import { LAST_KNOWN_BLOCK_HASHES_SIZE } from './Constants';
import { SynchronizationStatus } from './SynchronizationStatus';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { LogCategory, logger, LogLevel } from './Logger';
import { underivePublicKey, generateKeyDerivation } from './CryptoWrapper';

import {
    Block, RawCoinbaseTransaction, RawTransaction, Transaction,
    TransactionData, TransactionInput, TopBlock, UnconfirmedInput,
} from './Types';

/**
 * Decrypts blocks for our transactions and inputs
 * @noInheritDoc
 */
export class WalletSynchronizer extends EventEmitter {

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
    private daemon: Daemon;

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

    /**
     * Whether we are already downloading a chunk of blocks
     */
    private fetchingBlocks: boolean = false;

    /**
     * Stored blocks for later processing
     */
    private storedBlocks: Block[] = [];

    /**
     * Transactions that have disappeared from the pool and not appeared in a
     * block, and the amount of times they have failed this check.
     */
    private cancelledTransactionsFailCount: Map<string, number> = new Map();

    /**
     * Function to run on block download completion to ensure reset() works
     * correctly without blocks being stored after wiping them.
     */
    private finishedFunc: (() => void) | undefined = undefined;

    /**
     * Last time we fetched blocks from the daemon. If this goes over the
     * configured limit, we'll emit deadnode.
     */
    private lastDownloadedBlocks: Date = new Date();

    private config: Config = new Config();

    constructor(
        daemon: Daemon,
        subWallets: SubWallets,
        startTimestamp: number,
        startHeight: number,
        privateViewKey: string,
        config: Config,
        synchronizationStatus: SynchronizationStatus = new SynchronizationStatus()) {

        super();

        this.daemon = daemon;
        this.startTimestamp = startTimestamp;
        this.startHeight = startHeight;
        this.privateViewKey = privateViewKey;
        this.subWallets = subWallets;
        this.config = config;
        this.synchronizationStatus = synchronizationStatus;
    }

    public getScanHeights(): [number, number] {
        return [this.startHeight, this.startTimestamp];
    }

    /**
     * Initialize things we can't initialize from the JSON
     */
    public initAfterLoad(subWallets: SubWallets, daemon: Daemon, config: Config): void {
        this.subWallets = subWallets;
        this.daemon = daemon;
        this.storedBlocks = [];
        this.config = config;
        this.cancelledTransactionsFailCount = new Map();
        this.lastDownloadedBlocks = new Date();
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

    public processBlock(
        block: Block,
        ourInputs: [string, TransactionInput][]) {

        const txData: TransactionData = new TransactionData();

        if (this.config.scanCoinbaseTransactions) {
            const tx: Transaction | undefined = this.processCoinbaseTransaction(
                block, ourInputs,
            );

            if (tx !== undefined) {
                txData.transactionsToAdd.push(tx);
            }
        }

        for (const rawTX of block.transactions) {
            const [tx, keyImagesToMarkSpent] = this.processTransaction(
                block, ourInputs, rawTX,
            );

            if (tx !== undefined) {
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
     * @param block
     * @param privateViewKey
     * @param spendKeys Array of spend keys in the format [publicKey, privateKey]
     * @param isViewWallet
     * @param processCoinbaseTransactions
     */
    public async processBlockOutputs(
        block: Block,
        privateViewKey: string,
        spendKeys: [string, string][],
        isViewWallet: boolean,
        processCoinbaseTransactions: boolean): Promise<[string, TransactionInput][]> {

        let inputs: [string, TransactionInput][] = [];

        /* Process the coinbase tx if we're not skipping them for speed */
        if (processCoinbaseTransactions && block.coinbaseTransaction) {
            inputs = inputs.concat(await this.processTransactionOutputs(
                block.coinbaseTransaction, block.blockHeight,
            ));
        }

        /* Process the normal txs */
        for (const tx of block.transactions) {
            inputs = inputs.concat(await this.processTransactionOutputs(
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

    public reset(scanHeight: number, scanTimestamp: number): Promise<void> {
        return new Promise((resolve) => {
            const f = () => {
                this.startHeight = scanHeight;
                this.startTimestamp = scanTimestamp;
                /* Discard sync status */
                this.synchronizationStatus = new SynchronizationStatus(scanHeight - 1);
                this.storedBlocks = [];
            };

            if (this.fetchingBlocks) {
                this.finishedFunc = () => {
                    f();
                    resolve();
                    this.finishedFunc = undefined;
                };
            } else {
                f();
                resolve();
            }
        });
    }

    public rewind(scanHeight: number): Promise<void> {
        return new Promise((resolve) => {
            const f = () => {
                this.startHeight = scanHeight;
                this.startTimestamp = 0;
                /* Discard sync status */
                this.synchronizationStatus = new SynchronizationStatus(scanHeight - 1);
                this.storedBlocks = [];
            };

            if (this.fetchingBlocks) {
                this.finishedFunc = () => {
                    f();
                    resolve();
                    this.finishedFunc = undefined;
                };
            } else {
                f();
                resolve();
            }
        });
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

        logger.log(
            'Checking locked transactions',
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        const cancelled: string[] = await this.daemon.getCancelledTransactions(transactionHashes);

        const toRemove: string[] = [];

        for (const [hash, failCount] of this.cancelledTransactionsFailCount) {
            /* Hash still not found, increment fail count */
            if (cancelled.includes(hash)) {
                /* Failed too many times, cancel transaction, return funds to wallet */
                if (failCount === 3) {
                    toRemove.push(hash);
                    this.cancelledTransactionsFailCount.delete(hash);

                    logger.log(
                        `Unconfirmed transaction ${hash} is still not known by daemon after ${failCount} queries. ` +
                        'Assuming transaction got dropped from mempool, returning funds and removing unconfirmed transaction.',
                        LogLevel.DEBUG,
                        LogCategory.TRANSACTIONS,
                    );

                } else {
                    logger.log(
                        `Unconfirmed transaction ${hash} is not known by daemon, query ${failCount + 1}.`,
                        LogLevel.DEBUG,
                        LogCategory.TRANSACTIONS,
                    );

                    this.cancelledTransactionsFailCount.set(hash, failCount + 1);
                }
            /* Hash has since been found, remove from fail count array */
            } else {
                logger.log(
                    `Unconfirmed transaction ${hash} is known by daemon, removing from possibly cancelled transactions array.`,
                    LogLevel.DEBUG,
                    LogCategory.TRANSACTIONS,
                );

                this.cancelledTransactionsFailCount.delete(hash);
            }
        }

        for (const hash of cancelled) {
            /* Transaction with no history, first fail, add to map. */
            if (!this.cancelledTransactionsFailCount.has(hash)) {
                logger.log(
                    `Unconfirmed transaction ${hash} is not known by daemon, query 1.`,
                    LogLevel.DEBUG,
                    LogCategory.TRANSACTIONS,
                );

                this.cancelledTransactionsFailCount.set(hash, 1);
            }
        }

        return toRemove;
    }

    /**
     * Retrieve blockCount blocks from the internal store. Does not remove
     * them.
     */
    public async fetchBlocks(blockCount: number): Promise<[Block[], boolean]> {
        let shouldSleep = false;

        /* Fetch more blocks if we haven't got any downloaded yet */
        if (this.storedBlocks.length === 0) {
            if (!this.fetchingBlocks) {
                logger.log(
                    'No blocks stored, attempting to fetch more.',
                    LogLevel.DEBUG,
                    LogCategory.SYNC,
                );
            }

            const [successOrBusy, shouldSleepTmp] = await this.downloadBlocks();

            shouldSleep = shouldSleepTmp;

            /* Not in the middle of fetching blocks. */
            if (!successOrBusy) {
                /* Seconds since we last got a block */
                const diff = (new Date().getTime() - this.lastDownloadedBlocks.getTime()) / 1000;

                if (diff > this.config.maxLastFetchedBlockInterval) {
                    this.emit('deadnode');
                }
            } else {
                this.lastDownloadedBlocks = new Date();
            }
        }

        return [_.take(this.storedBlocks, blockCount), shouldSleep];
    }

    public dropBlock(blockHeight: number, blockHash: string): void {
        /* it's possible for this function to get ran twice.
           Need to make sure we don't remove more than the block we just
           processed. */
        if (this.storedBlocks.length >= 1 &&
            this.storedBlocks[0].blockHeight === blockHeight &&
            this.storedBlocks[0].blockHash === blockHash) {

            this.storedBlocks = _.drop(this.storedBlocks);

            this.synchronizationStatus.storeBlockHash(blockHeight, blockHash);
        }

        /* sizeof() gets a tad expensive... */
        if (blockHeight % 10 === 0 && this.shouldFetchMoreBlocks()) {
            /* Note - not awaiting here */
            this.downloadBlocks().then(([successOrBusy]) => {
                if (!successOrBusy) {
                    /* Seconds since we last got a block */
                    const diff = (new Date().getTime() - this.lastDownloadedBlocks.getTime()) / 1000;

                    if (diff > this.config.maxLastFetchedBlockInterval) {
                        this.emit('deadnode');
                    }
                } else {
                    this.lastDownloadedBlocks = new Date();
                }
            });
        }
    }

    public getBlockCheckpoints(): string[] {
        return this.synchronizationStatus.getBlockCheckpoints();
    }

    public getRecentBlockHashes(): string[] {
        return this.synchronizationStatus.getRecentBlockHashes();
    }

    private getStoredBlockCheckpoints(): string[] {
        const hashes = [];

        for (const block of this.storedBlocks) {
            /* Add to start of array - we want hashes in descending block height order */
            hashes.unshift(block.blockHash);
        }

        return _.take(hashes, LAST_KNOWN_BLOCK_HASHES_SIZE);
    }

    /**
     * Only retrieve more blocks if we're not getting close to the memory limit
     */
    private shouldFetchMoreBlocks(): boolean {
        /* Don't fetch more if we're already doing so */
        if (this.fetchingBlocks) {
            return false;
        }

        const ramUsage = sizeof(this.storedBlocks);

        if (ramUsage < this.config.blockStoreMemoryLimit) {
            logger.log(
                `Approximate ram usage of stored blocks: ${prettyPrintBytes(ramUsage)}, fetching more.`,
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            return true;
        }

        return false;
    }

    private getWalletSyncDataHashes(): string[] {
        const unprocessedBlockHashes: string[] = this.getStoredBlockCheckpoints();

        const recentProcessedBlockHashes: string[] = this.synchronizationStatus.getRecentBlockHashes();

        const blockHashCheckpoints: string[] = this.synchronizationStatus.getBlockCheckpoints();

        const combined = unprocessedBlockHashes.concat(recentProcessedBlockHashes);

        /* Take the 50 most recent block hashes, along with the infrequent
           checkpoints, to handle deep forks. */
        return _.take(combined, LAST_KNOWN_BLOCK_HASHES_SIZE)
                .concat(blockHashCheckpoints);
    }

    /* Returns [successOrBusy, shouldSleep] */
    private async downloadBlocks(): Promise<[boolean, boolean]> {
        /* Middle of fetching blocks, wait for previous request to complete.
         * Don't need to sleep. */
        if (this.fetchingBlocks) {
            return [true, false];
        }

        this.fetchingBlocks = true;

        const localDaemonBlockCount: number = this.daemon.getLocalDaemonBlockCount();
        const walletBlockCount: number = this.getHeight();

        if (localDaemonBlockCount < walletBlockCount) {
            this.fetchingBlocks = false;
            return [true, true];
        }

        /* Get the checkpoints of the blocks we've got stored, so we can fetch
           later ones. Also use the checkpoints of the previously processed
           ones, in case we don't have any blocks yet. */
        const blockCheckpoints: string[] = this.getWalletSyncDataHashes();

        let blocks: Block[] = [];
        let topBlock: TopBlock | boolean;

        try {
            [blocks, topBlock] = await this.daemon.getWalletSyncData(
                blockCheckpoints, this.startHeight, this.startTimestamp,
            );
        } catch (err) {
            logger.log(
                'Failed to get blocks from daemon: ' + err.toString(),
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            if (this.finishedFunc) {
                this.finishedFunc();
            }

            this.fetchingBlocks = false;

            return [false, true];
        }

        if (typeof topBlock === 'object' && blocks.length === 0) {
            if (this.finishedFunc) {
                this.finishedFunc();
            }

            /* Synced, store the top block so sync status displays correctly if
               we are not scanning coinbase tx only blocks.
               Only store top block if we have finished processing stored
               blocks */
            if (this.storedBlocks.length === 0) {
                this.emit('heightchange', topBlock.height);
                this.synchronizationStatus.storeBlockHash(topBlock.height, topBlock.hash);
            }

            logger.log(
                'Zero blocks received from daemon, fully synced',
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            if (this.finishedFunc) {
                this.finishedFunc();
            }

            this.fetchingBlocks = false;

            return [true, true];
        }

        if (blocks.length === 0) {
            logger.log(
                'Zero blocks received from daemon, possibly fully synced',
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            if (this.finishedFunc) {
                this.finishedFunc();
            }

            this.fetchingBlocks = false;

            return [false, false];
        }

        /* Timestamp is transient and can change - block height is constant. */
        if (this.startTimestamp !== 0) {
            this.startTimestamp = 0;
            this.startHeight = blocks[0].blockHeight;

            this.subWallets.convertSyncTimestampToHeight(
                this.startTimestamp, this.startHeight,
            );
        }

        /* Add the new blocks to the store */
        this.storedBlocks = this.storedBlocks.concat(blocks);

        if (this.finishedFunc) {
            this.finishedFunc();
        }

        this.fetchingBlocks = false;

        return [true, false];
    }

    /**
     * Process the outputs of a transaction, and create inputs that are ours
     */
    private async processTransactionOutputs(
        rawTX: RawCoinbaseTransaction,
        blockHeight: number): Promise<[string, TransactionInput][]> {

        const inputs: [string, TransactionInput][] = [];

        const derivation: string = await generateKeyDerivation(
            rawTX.transactionPublicKey, this.privateViewKey, this.config,
        );

        const spendKeys: string[] = this.subWallets.getPublicSpendKeys();

        for (const [outputIndex, output] of rawTX.keyOutputs.entries()) {
            /* Derive the spend key from the transaction, using the previous
               derivation */
            const derivedSpendKey = await underivePublicKey(
                derivation, outputIndex, output.key, this.config,
            );

            /* See if the derived spend key matches any of our spend keys */
            if (!_.includes(spendKeys, derivedSpendKey)) {
                continue;
            }

            /* The public spend key of the subwallet that owns this input */
            const ownerSpendKey = derivedSpendKey;

            /* Not spent yet! */
            const spendHeight: number = 0;

            const [keyImage, privateEphemeral] = await this.subWallets.getTxInputKeyImage(
                ownerSpendKey, derivation, outputIndex,
            );

            const txInput: TransactionInput = new TransactionInput(
                keyImage, output.amount, blockHeight,
                rawTX.transactionPublicKey, outputIndex, output.globalIndex,
                output.key, spendHeight, rawTX.unlockTime, rawTX.hash,
                privateEphemeral,
            );

            inputs.push([ownerSpendKey, txInput]);
        }

        return inputs;
    }

    private processCoinbaseTransaction(
        block: Block,
        ourInputs: [string, TransactionInput][]): Transaction | undefined {

        /* Should be guaranteed to be defined here */
        const rawTX: RawCoinbaseTransaction = block.coinbaseTransaction as RawCoinbaseTransaction;

        const transfers: Map<string, number> = new Map();

        const relevantInputs: [string, TransactionInput][]
            = _.filter(ourInputs, ([, input]) => {
            return input.parentTransactionHash === rawTX.hash;
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
                transfers, rawTX.hash, fee, block.blockHeight, block.blockTimestamp,
                paymentID, rawTX.unlockTime, isCoinbaseTransaction,
            );
        }

        return undefined;
    }

    private processTransaction(
        block: Block,
        ourInputs: [string, TransactionInput][],
        rawTX: RawTransaction): [Transaction | undefined, [string, string][]] {

        const transfers: Map<string, number> = new Map();

        const relevantInputs: [string, TransactionInput][]
            = _.filter(ourInputs, ([, input]) => {
            return input.parentTransactionHash === rawTX.hash;
        });

        for (const [publicSpendKey, input] of relevantInputs) {
            transfers.set(
                publicSpendKey,
                input.amount + (transfers.get(publicSpendKey) || 0),
            );
        }

        const spentKeyImages: [string, string][] = [];

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
                transfers, rawTX.hash, fee, block.blockHeight,
                block.blockTimestamp, rawTX.paymentID, rawTX.unlockTime,
                isCoinbaseTransaction,
            ), spentKeyImages];
        }

        return [undefined, []];
    }

    public checkOutgoingPoolTransaction(thisTx, thisHash) {
        
        const spentKeyImages = []
        let message = false
        if (thisTx.extra.length > 200) message = true

        for (const inpt of thisTx.vin) {

            const key_image = inpt.value.k_image

            if (key_image.length !== 64) {
                continue
            }

            const inAmount = inpt.value.amount

            const [found, publicSpendKey] = this.subWallets.getKeyImageOwner(
                key_image,
            );

            if (!found) continue

            spentKeyImages.push({publicSpendKey, key_image, thisHash, inAmount});
        
        }

        if (spentKeyImages.length === 0) return false

        /* Mark the unconfirmed inputs as locked */
        for (const input of spentKeyImages) {
            this.subWallets.markInputAsLocked(input.publicSpendKey, input.key_image, input.thisHash);
            const unconfirmed = new UnconfirmedInput(
                input.inAmount, input.key_image, input.thisHash, false                );
            
            if (!message) continue
            /* If it is a message, we know the inputs will be returning to us, thus we store it as locked balance */
            this.subWallets.storeUnconfirmedIncomingInput(unconfirmed, input.publicSpendKey);
        }

        return true
    }

    public async checkIncomingPoolTransaction(thisTx, thisHash, spendKeys) {
        let txPubKey: string
        const incomingOutputs = []
        const thisExtra: string = thisTx.extra
        try {
            txPubKey = thisExtra.substring(2,66)
        } catch (e) {
            logger.log(`Some parse error in thisExtra, checkIncomingPoolTransaction`, LogLevel.INFO, LogCategory.SYNC)
        }

        const derivation = await generateKeyDerivation(txPubKey, this.privateViewKey, this.config);
        let outputIndex = 0
        for (const output of thisTx.vout) {
            /* Derive the spend key from the transaction, using the previous
            derivation */
            const derivedSpendKey = await underivePublicKey(derivation, outputIndex, output.target.data.key, this.config);
            /* See if the derived spend key matches any of our spend keys */
            outputIndex++
            
            if (!_.includes(spendKeys, derivedSpendKey)) {
                continue;
            }

            /* The public spend key of the subwallet that owns this input */
            const ownerSpendKey = derivedSpendKey;
            const [keyImage] = await this.subWallets.getTxInputKeyImage(ownerSpendKey, derivation, outputIndex);
            const amount = output.amount
            const key = output.target.data.key
            /* Save the locked transaction keyimage, hash and spendkey to array */
            incomingOutputs.push({ownerSpendKey, keyImage, thisHash, amount, key});
            
        }
    
        if (incomingOutputs.length === 0) return false

        let amount: number = 0
        /* Mark the outputs as locked */
        for (const output of incomingOutputs) {
            this.subWallets.markInputAsLocked(output.ownerSpendKey, output.keyImage, output.thisHash);
            
            const unconfirmed = new UnconfirmedInput(
                output.amount, output.key, output.thisHash, true
            );
            amount += output.amount
            this.subWallets.storeUnconfirmedIncomingInput(unconfirmed, output.ownerSpendKey);
        }
        this.emit('unconfirmedtx', amount, thisHash)
        return true
    }

    
    public async checkPoolTransactions() {

        const txArray = await this.daemon.getPoolChanges(this.subWallets.knownTransactions);
        if (!txArray) return
        
        const spendKeys = this.subWallets.getPublicSpendKeys();
     
        logger.log(`Checking all txs in pool ${JSON.stringify(txArray.addedTxs)}`, LogLevel.DEBUG, LogCategory.SYNC)

        for (const tx of txArray.addedTxs) {
            
            const thisHash: string = tx.transactionPrefixInfotxHash

            if (thisHash.length !== 64) continue

            if (this.subWallets.knownTransactions.some(a => a === thisHash)) {
                continue
            }
            
            const thisTx = tx.transactionPrefixInfo
            
            if (typeof thisTx !== 'object') continue

            this.subWallets.knownTransactions.push(thisHash)

            this.checkOutgoingPoolTransaction(thisTx, thisHash)
            await this.checkIncomingPoolTransaction(thisTx, thisHash, spendKeys)
        }

        const filtered = this.subWallets.knownTransactions.filter((n) => !txArray.deletedTxsIds.includes(n));
        this.subWallets.knownTransactions = filtered;
    }
    
}

