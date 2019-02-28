"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const sizeof = require('object-sizeof');
const Config_1 = require("./Config");
const Utilities_1 = require("./Utilities");
const SynchronizationStatus_1 = require("./SynchronizationStatus");
const Logger_1 = require("./Logger");
const CryptoWrapper_1 = require("./CryptoWrapper");
const Types_1 = require("./Types");
/**
 * Decrypts blocks for our transactions and inputs
 */
class WalletSynchronizer {
    constructor(daemon, subWallets, startTimestamp, startHeight, privateViewKey) {
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
        this.daemon = daemon;
        this.startTimestamp = startTimestamp;
        this.startHeight = startHeight;
        this.privateViewKey = privateViewKey;
        this.subWallets = subWallets;
    }
    static fromJSON(json) {
        const walletSynchronizer = Object.create(WalletSynchronizer.prototype);
        return Object.assign(walletSynchronizer, {
            privateViewKey: json.privateViewKey,
            startHeight: json.startHeight,
            startTimestamp: json.startTimestamp,
            synchronizationStatus: SynchronizationStatus_1.SynchronizationStatus.fromJSON(json.transactionSynchronizerStatus),
        });
    }
    /**
     * Initialize things we can't initialize from the JSON
     */
    initAfterLoad(subWallets, daemon) {
        this.subWallets = subWallets;
        this.daemon = daemon;
        this.storedBlocks = [];
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
        if (Config_1.Config.scanCoinbaseTransactions) {
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
     * @param keys Array of spend keys in the format [publicKey, privateKey]
     */
    processBlockOutputs(block, privateViewKey, spendKeys, isViewWallet, processCoinbaseTransactions) {
        return __awaiter(this, void 0, void 0, function* () {
            let inputs = [];
            /* Process the coinbase tx if we're not skipping them for speed */
            if (processCoinbaseTransactions) {
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
            return this.daemon.getCancelledTransactions(transactionHashes);
        });
    }
    /**
     * Retrieve blockCount blocks from the internal store. Does not remove
     * them.
     */
    fetchBlocks(blockCount) {
        return __awaiter(this, void 0, void 0, function* () {
            /* Fetch more blocks if we haven't got any downloaded yet */
            if (this.storedBlocks.length === 0) {
                Logger_1.logger.log('No blocks stored, fetching more.', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                yield this.downloadBlocks();
            }
            return _.take(this.storedBlocks, blockCount);
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
        }
        this.synchronizationStatus.storeBlockHash(blockHeight, blockHash);
        /* sizeof() gets a tad expensive... */
        if (blockHeight % 10 === 0 && this.shouldFetchMoreBlocks()) {
            /* Note - not awaiting here */
            this.downloadBlocks();
        }
    }
    getStoredBlockCheckpoints() {
        const hashes = [];
        for (const block of this.storedBlocks) {
            /* Add to start of array - we want hashes in descending block height order */
            hashes.unshift(block.blockHash);
        }
        return _.take(hashes, 100);
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
        if (ramUsage + Config_1.Config.maxBodyResponseSize < Config_1.Config.blockStoreMemoryLimit) {
            Logger_1.logger.log(`Approximate ram usage of stored blocks: ${Utilities_1.prettyPrintBytes(ramUsage)}, fetching more.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            return true;
        }
        return false;
    }
    downloadBlocks() {
        return __awaiter(this, void 0, void 0, function* () {
            /* Don't make more than one fetch request at once */
            if (this.fetchingBlocks) {
                return;
            }
            this.fetchingBlocks = true;
            const localDaemonBlockCount = this.daemon.getLocalDaemonBlockCount();
            const walletBlockCount = this.getHeight();
            if (localDaemonBlockCount < walletBlockCount) {
                this.fetchingBlocks = false;
                return;
            }
            /* Get the checkpoints of the blocks we've got stored, so we can fetch
               later ones. Also use the checkpoints of the previously processed
               ones, in case we don't have any blocks yet. */
            const blockCheckpoints = this.getStoredBlockCheckpoints()
                .concat(this.synchronizationStatus.getProcessedBlockHashCheckpoints());
            let blocks = [];
            try {
                blocks = yield this.daemon.getWalletSyncData(blockCheckpoints, this.startHeight, this.startTimestamp, Config_1.Config.blocksPerDaemonRequest);
            }
            catch (err) {
                Logger_1.logger.log('Failed to get blocks from daemon', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                this.fetchingBlocks = false;
                return;
            }
            if (blocks.length === 0) {
                Logger_1.logger.log('Zero blocks received from daemon, possibly fully synced', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                this.fetchingBlocks = false;
                return;
            }
            /* Timestamp is transient and can change - block height is constant. */
            if (this.startTimestamp !== 0) {
                this.startTimestamp = 0;
                this.startHeight = blocks[0].blockHeight;
                this.subWallets.convertSyncTimestampToHeight(this.startTimestamp, this.startHeight);
            }
            /* If checkpoints are empty, this is the first sync request. */
            if (_.isEmpty(blockCheckpoints)) {
                const actualHeight = blocks[0].blockHeight;
                /* Only check if a timestamp isn't given */
                if (this.startTimestamp === 0) {
                    /* The height we expect to get back from the daemon */
                    if (actualHeight !== this.startHeight) {
                        this.fetchingBlocks = false;
                        throw new Error('Received unexpected block height from daemon. ' +
                            'Expected ' + this.startHeight + ', got ' + actualHeight + '\n');
                    }
                }
            }
            /* Add the new blocks to the store */
            this.storedBlocks = this.storedBlocks.concat(blocks);
            this.fetchingBlocks = false;
        });
    }
    /**
     * Process the outputs of a transaction, and create inputs that are ours
     */
    processTransactionOutputs(rawTX, blockHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            const inputs = [];
            const derivation = yield CryptoWrapper_1.generateKeyDerivation(rawTX.transactionPublicKey, this.privateViewKey);
            const spendKeys = this.subWallets.getPublicSpendKeys();
            for (const [outputIndex, output] of rawTX.keyOutputs.entries()) {
                /* Derive the spend key from the transaction, using the previous
                   derivation */
                const derivedSpendKey = yield CryptoWrapper_1.underivePublicKey(derivation, outputIndex, output.key);
                /* See if the derived spend key matches any of our spend keys */
                if (!_.includes(spendKeys, derivedSpendKey)) {
                    continue;
                }
                /* The public spend key of the subwallet that owns this input */
                const ownerSpendKey = derivedSpendKey;
                /* Not spent yet! */
                const spendHeight = 0;
                const keyImage = yield this.subWallets.getTxInputKeyImage(ownerSpendKey, derivation, outputIndex);
                const txInput = new Types_1.TransactionInput(keyImage, output.amount, blockHeight, rawTX.transactionPublicKey, outputIndex, output.globalIndex, output.key, spendHeight, rawTX.unlockTime, rawTX.hash);
                inputs.push([ownerSpendKey, txInput]);
            }
            return inputs;
        });
    }
    processCoinbaseTransaction(block, ourInputs) {
        const rawTX = block.coinbaseTransaction;
        const transfers = new Map();
        const relevantInputs = _.filter(ourInputs, ([key, input]) => {
            return input.parentTransactionHash === block.coinbaseTransaction.hash;
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
        const relevantInputs = _.filter(ourInputs, ([key, input]) => {
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
}
exports.WalletSynchronizer = WalletSynchronizer;
