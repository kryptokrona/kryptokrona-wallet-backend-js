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
const CnUtils_1 = require("./CnUtils");
const SynchronizationStatus_1 = require("./SynchronizationStatus");
const Logger_1 = require("./Logger");
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
    /**
     * Download the next set of blocks from the daemon
     */
    getBlocks() {
        return __awaiter(this, void 0, void 0, function* () {
            const localDaemonBlockCount = this.daemon.getLocalDaemonBlockCount();
            const walletBlockCount = this.synchronizationStatus.getHeight();
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
            const blockCheckpoints = this.synchronizationStatus.getBlockHashCheckpoints();
            let blocks = [];
            try {
                blocks = yield this.daemon.getWalletSyncData(blockCheckpoints, this.startHeight, this.startTimestamp);
            }
            catch (err) {
                Logger_1.logger.log('Failed to get blocks from daemon', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                return [];
            }
            if (blocks.length === 0) {
                Logger_1.logger.log('Zero blocks received from daemon, possibly fully synced', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                return [];
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
                        throw new Error('Received unexpected block height from daemon. ' +
                            'Expected ' + this.startHeight + ', got ' + actualHeight + '\n');
                    }
                }
            }
            return blocks;
        });
    }
    /**
     * Process the transaction inputs of a transaction, and pick out transfers
     * and transactions that are ours
     */
    processTransactionInputs(keyInputs, transfers, blockHeight, txData) {
        let sumOfInputs = 0;
        for (const input of keyInputs) {
            sumOfInputs += input.amount;
            const [found, publicSpendKey] = this.subWallets.getKeyImageOwner(input.keyImage);
            if (found) {
                transfers.set(publicSpendKey, -input.amount + (transfers.get(publicSpendKey) || 0));
                txData.keyImagesToMarkSpent.push([publicSpendKey, input.keyImage]);
            }
        }
        return [sumOfInputs, transfers, txData];
    }
    /**
     * Process the outputs of a transaction, and pick out transfers and
     * transactions that are ours, along with creating new inputs
     */
    processTransactionOutputs(rawTX, transfers, blockHeight, txData) {
        return __awaiter(this, void 0, void 0, function* () {
            const derivation = CnUtils_1.CryptoUtils.generateKeyDerivation(rawTX.transactionPublicKey, this.privateViewKey);
            let sumOfOutputs = 0;
            const spendKeys = this.subWallets.getPublicSpendKeys();
            for (const [outputIndex, output] of rawTX.keyOutputs.entries()) {
                sumOfOutputs += output.amount;
                /* Derive the spend key from the transaction, using the previous
                   derivation */
                const derivedSpendKey = CnUtils_1.CryptoUtils.underivePublicKey(derivation, outputIndex, output.key);
                /* See if the derived spend key matches any of our spend keys */
                if (!_.includes(spendKeys, derivedSpendKey)) {
                    continue;
                }
                /* The public spend key of the subwallet that owns this input */
                const ownerSpendKey = derivedSpendKey;
                transfers.set(ownerSpendKey, output.amount + (transfers.get(ownerSpendKey) || 0));
                /* Not spent yet! */
                const spendHeight = 0;
                const keyImage = this.subWallets.getTxInputKeyImage(ownerSpendKey, derivation, outputIndex);
                const txInput = new Types_1.TransactionInput(keyImage, output.amount, blockHeight, rawTX.transactionPublicKey, outputIndex, output.globalIndex, output.key, spendHeight, rawTX.unlockTime, rawTX.hash);
                txData.inputsToAdd.push([ownerSpendKey, txInput]);
            }
            return [sumOfOutputs, transfers, txData];
        });
    }
    processTransaction(rawTX, blockTimestamp, blockHeight, txData) {
        return __awaiter(this, void 0, void 0, function* () {
            let transfers = new Map();
            let sumOfInputs;
            let sumOfOutputs;
            /* Finds the sum of inputs, adds the amounts that belong to us to the
               transfers map */
            [sumOfInputs, transfers, txData] = this.processTransactionInputs(rawTX.keyInputs, transfers, blockHeight, txData);
            /* Finds the sum of outputs, adds the amounts that belong to us to the
               transfers map, and stores any key images that belong to us */
            [sumOfOutputs, transfers, txData] = yield this.processTransactionOutputs(rawTX, transfers, blockHeight, txData);
            if (!_.isEmpty(transfers)) {
                const fee = sumOfInputs - sumOfOutputs;
                const isCoinbaseTransaction = false;
                const tx = new Types_1.Transaction(transfers, rawTX.hash, fee, blockTimestamp, blockHeight, rawTX.paymentID, rawTX.unlockTime, isCoinbaseTransaction);
                txData.transactionsToAdd.push(tx);
            }
            return txData;
        });
    }
    processCoinbaseTransaction(rawTX, blockTimestamp, blockHeight, txData) {
        return __awaiter(this, void 0, void 0, function* () {
            let transfers = new Map();
            [/*ignore*/ , transfers, txData] = yield this.processTransactionOutputs(rawTX, transfers, blockHeight, txData);
            if (!_.isEmpty(transfers)) {
                /* Coinbase transaction have no fee */
                const fee = 0;
                const isCoinbaseTransaction = true;
                /* Coibnase transactions can't have payment ID's */
                const paymentID = '';
                const tx = new Types_1.Transaction(transfers, rawTX.hash, fee, blockTimestamp, blockHeight, paymentID, rawTX.unlockTime, isCoinbaseTransaction);
                txData.transactionsToAdd.push(tx);
            }
            return txData;
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
    storeBlockHash(blockHeight, blockHash) {
        this.synchronizationStatus.storeBlockHash(blockHeight, blockHash);
    }
}
exports.WalletSynchronizer = WalletSynchronizer;
