"use strict";
// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletSynchronizer = void 0;
const _ = require("lodash");
const sizeof = require('object-sizeof');
const events_1 = require("events");
const Config_1 = require("./Config");
const Utilities_1 = require("./Utilities");
const Constants_1 = require("./Constants");
const SynchronizationStatus_1 = require("./SynchronizationStatus");
const Logger_1 = require("./Logger");
const CryptoWrapper_1 = require("./CryptoWrapper");
const Types_1 = require("./Types");
/**
 * Decrypts blocks for our transactions and inputs
 * @noInheritDoc
 */
class WalletSynchronizer extends events_1.EventEmitter {
    static fromJSON(json) {
        const walletSynchronizer = Object.create(WalletSynchronizer.prototype);
        return Object.assign(walletSynchronizer, {
            privateViewKey: json.privateViewKey,
            startHeight: json.startHeight,
            startTimestamp: json.startTimestamp,
            synchronizationStatus: SynchronizationStatus_1.SynchronizationStatus.fromJSON(json.transactionSynchronizerStatus),
        });
    }
    constructor(daemon, subWallets, startTimestamp, startHeight, privateViewKey, config, synchronizationStatus = new SynchronizationStatus_1.SynchronizationStatus()) {
        super();
        /**
         * Stores the progress of our synchronization
         */
        this.synchronizationStatus = new SynchronizationStatus_1.SynchronizationStatus();
        /**
         * Whether we are already downloading a chunk of blocks
         */
        this.fetchingBlocks = false;
        /**
         * Stored blocks for later processing
         */
        this.storedBlocks = [];
        /**
         * Transactions that have disappeared from the pool and not appeared in a
         * block, and the amount of times they have failed this check.
         */
        this.cancelledTransactionsFailCount = new Map();
        /**
         * Function to run on block download completion to ensure reset() works
         * correctly without blocks being stored after wiping them.
         */
        this.finishedFunc = undefined;
        /**
         * Last time we fetched blocks from the daemon. If this goes over the
         * configured limit, we'll emit deadnode.
         */
        this.lastDownloadedBlocks = new Date();
        this.config = new Config_1.Config();
        this.daemon = daemon;
        this.startTimestamp = startTimestamp;
        this.startHeight = startHeight;
        this.privateViewKey = privateViewKey;
        this.subWallets = subWallets;
        this.config = config;
        this.synchronizationStatus = synchronizationStatus;
    }
    getScanHeights() {
        return [this.startHeight, this.startTimestamp];
    }
    /**
     * Initialize things we can't initialize from the JSON
     */
    initAfterLoad(subWallets, daemon, config) {
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
    toJSON() {
        return {
            privateViewKey: this.privateViewKey,
            startHeight: this.startHeight,
            startTimestamp: this.startTimestamp,
            transactionSynchronizerStatus: this.synchronizationStatus.toJSON(),
        };
    }
    processBlock(block, ourInputs) {
        const txData = new Types_1.TransactionData();
        if (this.config.scanCoinbaseTransactions) {
            const tx = this.processCoinbaseTransaction(block, ourInputs);
            if (tx !== undefined) {
                txData.transactionsToAdd.push(tx);
            }
        }
        for (const rawTX of block.transactions) {
            const [tx, keyImagesToMarkSpent] = this.processTransaction(block, ourInputs, rawTX);
            if (tx !== undefined) {
                txData.transactionsToAdd.push(tx);
                txData.keyImagesToMarkSpent = txData.keyImagesToMarkSpent.concat(keyImagesToMarkSpent);
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
    processBlockOutputs(block, privateViewKey, spendKeys, isViewWallet, processCoinbaseTransactions) {
        return __awaiter(this, void 0, void 0, function* () {
            let inputs = [];
            /* Process the coinbase tx if we're not skipping them for speed */
            if (processCoinbaseTransactions && block.coinbaseTransaction) {
                inputs = inputs.concat(yield this.processTransactionOutputs(block.coinbaseTransaction, block.blockHeight));
            }
            /* Process the normal txs */
            for (const tx of block.transactions) {
                inputs = inputs.concat(yield this.processTransactionOutputs(tx, block.blockHeight));
            }
            return inputs;
        });
    }
    /**
     * Get the height of the sync process
     */
    getHeight() {
        return this.synchronizationStatus.getHeight();
    }
    reset(scanHeight, scanTimestamp) {
        return new Promise((resolve) => {
            const f = () => {
                this.startHeight = scanHeight;
                this.startTimestamp = scanTimestamp;
                /* Discard sync status */
                this.synchronizationStatus = new SynchronizationStatus_1.SynchronizationStatus(scanHeight - 1);
                this.storedBlocks = [];
            };
            if (this.fetchingBlocks) {
                this.finishedFunc = () => {
                    f();
                    resolve();
                    this.finishedFunc = undefined;
                };
            }
            else {
                f();
                resolve();
            }
        });
    }
    rewind(scanHeight) {
        return new Promise((resolve) => {
            const f = () => {
                this.startHeight = scanHeight;
                this.startTimestamp = 0;
                /* Discard sync status */
                this.synchronizationStatus = new SynchronizationStatus_1.SynchronizationStatus(scanHeight - 1);
                this.storedBlocks = [];
            };
            if (this.fetchingBlocks) {
                this.finishedFunc = () => {
                    f();
                    resolve();
                    this.finishedFunc = undefined;
                };
            }
            else {
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
    findCancelledTransactions(transactionHashes) {
        return __awaiter(this, void 0, void 0, function* () {
            /* This is the common case - don't waste time making a useless request
               to the daemon */
            if (_.isEmpty(transactionHashes)) {
                return [];
            }
            Logger_1.logger.log('Checking locked transactions', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            const cancelled = yield this.daemon.getCancelledTransactions(transactionHashes);
            const toRemove = [];
            for (const [hash, failCount] of this.cancelledTransactionsFailCount) {
                /* Hash still not found, increment fail count */
                if (cancelled.includes(hash)) {
                    /* Failed too many times, cancel transaction, return funds to wallet */
                    if (failCount === 3) {
                        toRemove.push(hash);
                        this.cancelledTransactionsFailCount.delete(hash);
                        Logger_1.logger.log(`Unconfirmed transaction ${hash} is still not known by daemon after ${failCount} queries. ` +
                            'Assuming transaction got dropped from mempool, returning funds and removing unconfirmed transaction.', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                    }
                    else {
                        Logger_1.logger.log(`Unconfirmed transaction ${hash} is not known by daemon, query ${failCount + 1}.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                        this.cancelledTransactionsFailCount.set(hash, failCount + 1);
                    }
                    /* Hash has since been found, remove from fail count array */
                }
                else {
                    Logger_1.logger.log(`Unconfirmed transaction ${hash} is known by daemon, removing from possibly cancelled transactions array.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                    this.cancelledTransactionsFailCount.delete(hash);
                }
            }
            for (const hash of cancelled) {
                /* Transaction with no history, first fail, add to map. */
                if (!this.cancelledTransactionsFailCount.has(hash)) {
                    Logger_1.logger.log(`Unconfirmed transaction ${hash} is not known by daemon, query 1.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                    this.cancelledTransactionsFailCount.set(hash, 1);
                }
            }
            return toRemove;
        });
    }
    /**
     * Retrieve blockCount blocks from the internal store. Does not remove
     * them.
     */
    fetchBlocks(blockCount) {
        return __awaiter(this, void 0, void 0, function* () {
            let shouldSleep = false;
            /* Fetch more blocks if we haven't got any downloaded yet */
            if (this.storedBlocks.length === 0) {
                if (!this.fetchingBlocks) {
                    Logger_1.logger.log('No blocks stored, attempting to fetch more.', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                }
                const [successOrBusy, shouldSleepTmp] = yield this.downloadBlocks();
                shouldSleep = shouldSleepTmp;
                /* Not in the middle of fetching blocks. */
                if (!successOrBusy) {
                    /* Seconds since we last got a block */
                    const diff = (new Date().getTime() - this.lastDownloadedBlocks.getTime()) / 1000;
                    if (diff > this.config.maxLastFetchedBlockInterval) {
                        this.emit('deadnode');
                    }
                }
                else {
                    this.lastDownloadedBlocks = new Date();
                }
            }
            return [_.take(this.storedBlocks, blockCount), shouldSleep];
        });
    }
    dropBlock(blockHeight, blockHash) {
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
                }
                else {
                    this.lastDownloadedBlocks = new Date();
                }
            });
        }
    }
    getBlockCheckpoints() {
        return this.synchronizationStatus.getBlockCheckpoints();
    }
    getRecentBlockHashes() {
        return this.synchronizationStatus.getRecentBlockHashes();
    }
    getStoredBlockCheckpoints() {
        const hashes = [];
        for (const block of this.storedBlocks) {
            /* Add to start of array - we want hashes in descending block height order */
            hashes.unshift(block.blockHash);
        }
        return _.take(hashes, Constants_1.LAST_KNOWN_BLOCK_HASHES_SIZE);
    }
    /**
     * Only retrieve more blocks if we're not getting close to the memory limit
     */
    shouldFetchMoreBlocks() {
        /* Don't fetch more if we're already doing so */
        if (this.fetchingBlocks) {
            return false;
        }
        const ramUsage = sizeof(this.storedBlocks);
        if (ramUsage < this.config.blockStoreMemoryLimit) {
            Logger_1.logger.log(`Approximate ram usage of stored blocks: ${(0, Utilities_1.prettyPrintBytes)(ramUsage)}, fetching more.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            return true;
        }
        return false;
    }
    getWalletSyncDataHashes() {
        const unprocessedBlockHashes = this.getStoredBlockCheckpoints();
        const recentProcessedBlockHashes = this.synchronizationStatus.getRecentBlockHashes();
        const blockHashCheckpoints = this.synchronizationStatus.getBlockCheckpoints();
        const combined = unprocessedBlockHashes.concat(recentProcessedBlockHashes);
        /* Take the 50 most recent block hashes, along with the infrequent
           checkpoints, to handle deep forks. */
        return _.take(combined, Constants_1.LAST_KNOWN_BLOCK_HASHES_SIZE)
            .concat(blockHashCheckpoints);
    }
    /* Returns [successOrBusy, shouldSleep] */
    downloadBlocks() {
        return __awaiter(this, void 0, void 0, function* () {
            /* Middle of fetching blocks, wait for previous request to complete.
             * Don't need to sleep. */
            if (this.fetchingBlocks) {
                return [true, false];
            }
            this.fetchingBlocks = true;
            const walletBlockCount = this.getHeight();
            const networkHeight = this.daemon.getNetworkBlockCount();
            if (walletBlockCount === networkHeight) {
                this.fetchingBlocks = false;
                return [true, true];
            }
            /* Get the checkpoints of the blocks we've got stored, so we can fetch
               later ones. Also use the checkpoints of the previously processed
               ones, in case we don't have any blocks yet. */
            const blockCheckpoints = this.getWalletSyncDataHashes();
            let blocks = [];
            let topBlock;
            try {
                [blocks, topBlock] = yield this.daemon.getWalletSyncData(blockCheckpoints.slice(0, 10), this.startHeight, this.startTimestamp);
            }
            catch (err) {
                Logger_1.logger.log('Failed to get blocks from daemon: ' + err.toString(), Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
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
                Logger_1.logger.log('Zero blocks received from daemon, fully synced', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                if (this.finishedFunc) {
                    this.finishedFunc();
                }
                this.fetchingBlocks = false;
                return [true, true];
            }
            if (blocks.length === 0) {
                Logger_1.logger.log('Zero blocks received from daemon, possibly fully synced', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
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
                this.subWallets.convertSyncTimestampToHeight(this.startTimestamp, this.startHeight);
            }
            /* Add the new blocks to the store */
            this.storedBlocks = this.storedBlocks.concat(blocks);
            if (this.finishedFunc) {
                this.finishedFunc();
            }
            this.fetchingBlocks = false;
            return [true, false];
        });
    }
    /**
     * Process the outputs of a transaction, and create inputs that are ours
     */
    processTransactionOutputs(rawTX, blockHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            const inputs = [];
            const derivation = yield (0, CryptoWrapper_1.generateKeyDerivation)(rawTX.transactionPublicKey, this.privateViewKey, this.config);
            const spendKeys = this.subWallets.getPublicSpendKeys();
            for (const [outputIndex, output] of rawTX.keyOutputs.entries()) {
                /* Derive the spend key from the transaction, using the previous
                   derivation */
                const derivedSpendKey = yield (0, CryptoWrapper_1.underivePublicKey)(derivation, outputIndex, output.key, this.config);
                /* See if the derived spend key matches any of our spend keys */
                if (!_.includes(spendKeys, derivedSpendKey)) {
                    continue;
                }
                /* The public spend key of the subwallet that owns this input */
                const ownerSpendKey = derivedSpendKey;
                /* Not spent yet! */
                const spendHeight = 0;
                const [keyImage, privateEphemeral] = yield this.subWallets.getTxInputKeyImage(ownerSpendKey, derivation, outputIndex);
                const txInput = new Types_1.TransactionInput(keyImage, output.amount, blockHeight, rawTX.transactionPublicKey, outputIndex, output.globalIndex, output.key, spendHeight, rawTX.unlockTime, rawTX.hash, privateEphemeral);
                inputs.push([ownerSpendKey, txInput]);
            }
            return inputs;
        });
    }
    processCoinbaseTransaction(block, ourInputs) {
        /* Should be guaranteed to be defined here */
        const rawTX = block.coinbaseTransaction;
        const transfers = new Map();
        const relevantInputs = _.filter(ourInputs, ([, input]) => {
            return input.parentTransactionHash === rawTX.hash;
        });
        for (const [publicSpendKey, input] of relevantInputs) {
            transfers.set(publicSpendKey, input.amount + (transfers.get(publicSpendKey) || 0));
        }
        if (!_.isEmpty(transfers)) {
            /* Coinbase transaction have no fee */
            const fee = 0;
            const isCoinbaseTransaction = true;
            /* Coinbase transactions can't have payment ID's */
            const paymentID = '';
            return new Types_1.Transaction(transfers, rawTX.hash, fee, block.blockHeight, block.blockTimestamp, paymentID, rawTX.unlockTime, isCoinbaseTransaction);
        }
        return undefined;
    }
    processTransaction(block, ourInputs, rawTX) {
        const transfers = new Map();
        const relevantInputs = _.filter(ourInputs, ([, input]) => {
            return input.parentTransactionHash === rawTX.hash;
        });
        for (const [publicSpendKey, input] of relevantInputs) {
            transfers.set(publicSpendKey, input.amount + (transfers.get(publicSpendKey) || 0));
        }
        const spentKeyImages = [];
        for (const input of rawTX.keyInputs) {
            const [found, publicSpendKey] = this.subWallets.getKeyImageOwner(input.keyImage);
            if (found) {
                transfers.set(publicSpendKey, -input.amount + (transfers.get(publicSpendKey) || 0));
                spentKeyImages.push([publicSpendKey, input.keyImage]);
            }
        }
        if (!_.isEmpty(transfers)) {
            const fee = _.sumBy(rawTX.keyInputs, 'amount') -
                _.sumBy(rawTX.keyOutputs, 'amount');
            const isCoinbaseTransaction = false;
            return [new Types_1.Transaction(transfers, rawTX.hash, fee, block.blockHeight, block.blockTimestamp, rawTX.paymentID, rawTX.unlockTime, isCoinbaseTransaction), spentKeyImages];
        }
        return [undefined, []];
    }
    checkIncomingPoolTransaction(thisTx, thisHash, spendKeys) {
        return __awaiter(this, void 0, void 0, function* () {
            let txPubKey;
            const incomingOutputs = [];
            const thisExtra = thisTx.extra;
            try {
                txPubKey = thisExtra.substring(2, 66);
            }
            catch (e) {
                Logger_1.logger.log(`Some parse error in thisExtra, checkIncomingPoolTransaction`, Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
            }
            const derivation = yield (0, CryptoWrapper_1.generateKeyDerivation)(txPubKey, this.privateViewKey, this.config);
            let outputIndex = 0;
            for (const output of thisTx.vout) {
                /* Derive the spend key from the transaction, using the previous
                derivation */
                const derivedSpendKey = yield (0, CryptoWrapper_1.underivePublicKey)(derivation, outputIndex, output.target.data.key, this.config);
                /* See if the derived spend key matches any of our spend keys */
                outputIndex++;
                if (!_.includes(spendKeys, derivedSpendKey)) {
                    continue;
                }
                /* The public spend key of the subwallet that owns this input */
                const ownerSpendKey = derivedSpendKey;
                const [keyImage] = yield this.subWallets.getTxInputKeyImage(ownerSpendKey, derivation, outputIndex);
                const amount = output.amount;
                const key = output.target.data.key;
                /* Save the locked transaction keyimage, hash and spendkey to array */
                incomingOutputs.push({ ownerSpendKey, keyImage, thisHash, amount, key });
            }
            if (incomingOutputs.length === 0)
                return false;
            let amount = 0;
            /* Mark the outputs as locked */
            for (const output of incomingOutputs) {
                this.subWallets.markInputAsLocked(output.ownerSpendKey, output.keyImage, output.thisHash);
                const unconfirmed = new Types_1.UnconfirmedInput(output.amount, output.key, output.thisHash, true);
                amount += output.amount;
                this.subWallets.storeUnconfirmedIncomingInput(unconfirmed, output.ownerSpendKey);
            }
            this.emit('unconfirmedtx', amount, thisHash);
            return true;
        });
    }
    checkPoolTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            let txArray = yield this.daemon.getPoolChanges(this.subWallets.knownTransactions);
            if (!txArray)
                return;
            const spendKeys = this.subWallets.getPublicSpendKeys();
            Logger_1.logger.log(`Checking all txs in pool ${JSON.stringify(txArray.addedTxs)}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            for (const tx of txArray.addedTxs) {
                const thisHash = tx.transactionPrefixInfotxHash;
                if (thisHash.length !== 64)
                    continue;
                if (this.subWallets.knownTransactions.some(a => a === thisHash)) {
                    continue;
                }
                if (tx.transactionPrefixInfo.extra.length > 200) {
                    this.subWallets.knownTransactions.push(thisHash);
                    continue;
                }
                const thisTx = tx.transactionPrefixInfo;
                if (typeof thisTx !== 'object')
                    continue;
                this.subWallets.knownTransactions.push(thisHash);
                yield this.checkIncomingPoolTransaction(thisTx, thisHash, spendKeys);
            }
            const filtered = this.subWallets.knownTransactions.filter((n) => !txArray.deletedTxsIds.includes(n));
            this.subWallets.knownTransactions = filtered;
        });
    }
}
exports.WalletSynchronizer = WalletSynchronizer;
