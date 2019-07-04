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
const node_fetch_1 = require("node-fetch");
let AbortController;
/* This require doesn't work in react native. dunno why. */
if (!(typeof navigator !== 'undefined'
    && typeof navigator.product === 'string'
    && navigator.product.toLowerCase() === 'reactnative')) {
    AbortController = require('abort-controller');
}
const Types_1 = require("./Types");
const Config_1 = require("./Config");
const ValidateParameters_1 = require("./ValidateParameters");
const Logger_1 = require("./Logger");
const WalletError_1 = require("./WalletError");
/**
 * @deprecated This Class will be removed in v4.0.0. Please update your code
 * to instead use the [[Daemon]] class. This supports both ConventionalDaemon's,
 * BlockchainCacheApi's, and http/https, all automatically.
 */
class BlockchainCacheApi {
    /**
     * @param cacheBaseURL  The base URL for our API. Shouldn't have a trailing '/'
     * @param ssl           Should we use https? Defaults to true.
     *
     * Example usage:
     * ```
     * const daemon = new BlockchainCacheApi('blockapi.turtlepay.io', true);
     * ```
     */
    constructor(cacheBaseURL, ssl = true) {
        /**
         * The base URL for our API. Shouldn't have a trailing '/'.
         */
        this.cacheBaseURL = '';
        /**
         * Whether we should use https for our requests
         */
        this.ssl = true;
        /**
         * The address node fees will go to
         */
        this.feeAddress = '';
        /**
         * The amount of the node fee in atomic units
         */
        this.feeAmount = 0;
        /**
         * The amount of blocks the daemon we're connected to has
         */
        this.localDaemonBlockCount = 0;
        /**
         * The amount of blocks the network has
         */
        this.networkBlockCount = 0;
        /**
         * The amount of peers we have, incoming+outgoing
         */
        this.peerCount = 0;
        /**
         * The hashrate of the last known local block
         */
        this.lastKnownHashrate = 0;
        this.config = new Config_1.Config();
        console.warn('This Class will be removed in v4.0.0. Please update your code ' +
            'to instead use the Daemon class. This supports both ' +
            'ConventionalDaemon\'s, BlockchainCacheApi\'s, and http/https, ' +
            'all automatically.');
        this.cacheBaseURL = cacheBaseURL;
        this.ssl = ssl;
    }
    updateConfig(config) {
        this.config = Config_1.MergeConfig(config);
    }
    /**
     * Get the amount of blocks the network has
     */
    getNetworkBlockCount() {
        return this.networkBlockCount;
    }
    /**
     * Get the amount of blocks the daemon we're connected to has
     */
    getLocalDaemonBlockCount() {
        return this.localDaemonBlockCount;
    }
    /**
     * Initialize the daemon and the fee info
     */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            /* Note - if one promise throws, the other will be cancelled */
            yield Promise.all([this.updateDaemonInfo(), this.updateFeeInfo()]);
        });
    }
    /**
     * Update the daemon info
     */
    updateDaemonInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            let info;
            try {
                info = yield this.makeGetRequest('/info');
            }
            catch (err) {
                Logger_1.logger.log('Failed to update daemon info: ' + err.toString(), Logger_1.LogLevel.INFO, [Logger_1.LogCategory.DAEMON]);
                return;
            }
            this.localDaemonBlockCount = info.height;
            this.networkBlockCount = info.network_height;
            /* Height returned is one more than the current height - but we
               don't want to overflow is the height returned is zero */
            if (this.networkBlockCount !== 0) {
                this.networkBlockCount--;
            }
            this.peerCount = info.incoming_connections_count + info.outgoing_connections_count;
            this.lastKnownHashrate = info.difficulty / this.config.blockTargetTime;
        });
    }
    /**
     * Get the node fee and address
     */
    nodeFee() {
        return [this.feeAddress, this.feeAmount];
    }
    /**
     * @param blockHashCheckpoints  Hashes of the last known blocks. Later
     *                              blocks (higher block height) should be
     *                              ordered at the front of the array.
     *
     * @param startHeight           Height to start taking blocks from
     * @param startTimestamp        Block timestamp to start taking blocks from
     *
     * Gets blocks from the daemon. Blocks are returned starting from the last
     * known block hash (if higher than the startHeight/startTimestamp)
     */
    getWalletSyncData(blockHashCheckpoints, startHeight, startTimestamp, blockCount) {
        return __awaiter(this, void 0, void 0, function* () {
            let data;
            try {
                data = yield this.makePostRequest('/getwalletsyncdata', {
                    blockCount,
                    blockHashCheckpoints,
                    skipCoinbaseTransactions: !this.config.scanCoinbaseTransactions,
                    startHeight,
                    startTimestamp,
                });
            }
            catch (err) {
                const maxSizeErr = err.msg === 'max-size'
                    || (err.type && err.type === 'max-size');
                if (maxSizeErr && blockCount > 1) {
                    Logger_1.logger.log('getWalletSyncData failed, body exceeded max size of ' +
                        `${this.config.maxResponseBodySize}, decreasing block count to ` +
                        `${Math.floor(blockCount / 2)} and retrying`, Logger_1.LogLevel.WARNING, [Logger_1.LogCategory.DAEMON, Logger_1.LogCategory.SYNC]);
                    /* Body is too large, decrease the amount of blocks we're requesting
                       and retry */
                    return this.getWalletSyncData(blockHashCheckpoints, startHeight, startTimestamp, Math.floor(blockCount / 2));
                }
                Logger_1.logger.log('Failed to get wallet sync data: ' + err.toString(), Logger_1.LogLevel.INFO, [Logger_1.LogCategory.DAEMON]);
                return [[], undefined];
            }
            if (data.synced && data.topBlock && data.topBlock.height && data.topBlock.hash) {
                return [data.items.map(Types_1.Block.fromJSON), data.topBlock];
            }
            return [data.items.map(Types_1.Block.fromJSON), undefined];
        });
    }
    /**
     * @returns Returns a mapping of transaction hashes to global indexes
     *
     * Get global indexes for the transactions in the range
     * [startHeight, endHeight]
     */
    getGlobalIndexesForRange(startHeight, endHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('This call is not supported on the cache api. The cache API ' +
                'returns global indexes directly from /getWalletSyncData');
        });
    }
    getCancelledTransactions(transactionHashes) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.makePostRequest('/get_transactions_status', {
                    transactionHashes,
                });
                return data.transactionsUnknown || [];
            }
            catch (err) {
                Logger_1.logger.log('Failed to get transactions status: ' + err.toString(), Logger_1.LogLevel.ERROR, Logger_1.LogCategory.DAEMON);
                return [];
            }
        });
    }
    /**
     * Gets random outputs for the given amounts. requestedOuts per. Usually mixin+1.
     *
     * @returns Returns an array of amounts to global indexes and keys. There
     *          should be requestedOuts indexes if the daemon fully fulfilled
     *          our request.
     */
    getRandomOutputsByAmount(amounts, requestedOuts) {
        return __awaiter(this, void 0, void 0, function* () {
            let data;
            try {
                data = yield this.makePostRequest('/randomOutputs', {
                    amounts: amounts,
                    mixin: requestedOuts,
                });
            }
            catch (err) {
                Logger_1.logger.log('Failed to get random outs: ' + err.toString(), Logger_1.LogLevel.ERROR, [Logger_1.LogCategory.TRANSACTIONS, Logger_1.LogCategory.DAEMON]);
                return [];
            }
            const outputs = [];
            for (const output of data) {
                const indexes = [];
                for (const outs of output.outs) {
                    indexes.push([outs.global_amount_index, outs.out_key]);
                }
                /* Sort by output index to make it hard to determine real one */
                outputs.push([output.amount, _.sortBy(indexes, ([index, key]) => index)]);
            }
            return outputs;
        });
    }
    sendTransaction(rawTransaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.makePostRequest('/sendrawtransaction', {
                tx_as_hex: rawTransaction,
            });
            return result.status === 'OK';
        });
    }
    getConnectionInfo() {
        return {
            host: this.cacheBaseURL,
            port: this.ssl ? 443 : 80,
            daemonType: Types_1.DaemonType.BlockchainCacheApi,
            daemonTypeDetermined: true,
            ssl: this.ssl,
            sslDetermined: true,
        };
    }
    /**
     * Update the fee address and amount
     */
    updateFeeInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            let feeInfo;
            try {
                feeInfo = yield this.makeGetRequest('/fee');
            }
            catch (err) {
                Logger_1.logger.log('Failed to update fee info: ' + err.toString(), Logger_1.LogLevel.INFO, [Logger_1.LogCategory.DAEMON]);
                return;
            }
            if (feeInfo.address === '') {
                return;
            }
            const integratedAddressesAllowed = false;
            const err = ValidateParameters_1.validateAddresses(new Array(feeInfo.address), integratedAddressesAllowed, this.config).errorCode;
            if (err !== WalletError_1.WalletErrorCode.SUCCESS) {
                Logger_1.logger.log('Failed to validate address from daemon fee info: ' + err.toString(), Logger_1.LogLevel.WARNING, [Logger_1.LogCategory.DAEMON]);
                return;
            }
            if (feeInfo.amount > 0) {
                this.feeAddress = feeInfo.address;
                this.feeAmount = feeInfo.amount;
            }
        });
    }
    /**
     * Makes a get request to the given endpoint
     */
    makeGetRequest(endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = (this.ssl ? 'https://' : 'http://') + this.cacheBaseURL + endpoint;
            let controller;
            try {
                controller = new AbortController();
            }
            catch (err) {
                /* In some environments, the controller doesn't get imported/work correctly. */
            }
            const timeout = setTimeout(() => {
                if (controller !== undefined) {
                    controller.abort();
                }
            }, this.config.requestTimeout);
            const res = yield node_fetch_1.default(url, Object.assign({ timeout: this.config.requestTimeout }, (controller !== undefined && { signal: controller.signal })));
            if (!res.ok) {
                throw new Error('Request failed.');
            }
            clearTimeout(timeout);
            return res.json();
        });
    }
    /**
     * Makes a post request to the given endpoint with the given body
     */
    makePostRequest(endpoint, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = (this.ssl ? 'https://' : 'http://') + this.cacheBaseURL + endpoint;
            let controller;
            try {
                controller = new AbortController();
            }
            catch (err) {
                /* In some environments, the controller doesn't get imported/work correctly. */
            }
            const timeout = setTimeout(() => {
                if (controller !== undefined) {
                    controller.abort();
                }
            }, this.config.requestTimeout);
            const res = yield node_fetch_1.default(url, Object.assign({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, method: 'post' }, (controller !== undefined && { signal: controller.signal }), { size: this.config.maxBodyResponseSize, timeout: this.config.requestTimeout }));
            if (!res.ok) {
                throw new Error('Request failed.');
            }
            /* https://github.com/bitinn/node-fetch/issues/584 */
            if (res.body === undefined) {
                return res.json();
            }
            let data = '';
            let length = 0;
            res.body.on('data', (chunk) => {
                length += chunk.length;
                if (length > this.config.maxBodyResponseSize) {
                    if (controller !== undefined) {
                        controller.abort();
                    }
                    throw new Error('max-size');
                }
                data += chunk;
            });
            const result = yield new Promise((resolve, reject) => {
                res.body.on('end', () => {
                    return resolve(JSON.parse(data));
                });
                res.body.on('error', (err) => {
                    return reject(err);
                });
            });
            clearTimeout(timeout);
            return result;
        });
    }
}
exports.BlockchainCacheApi = BlockchainCacheApi;
