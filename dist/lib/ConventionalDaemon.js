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
const Types_1 = require("./Types");
const ValidateParameters_1 = require("./ValidateParameters");
const WalletError_1 = require("./WalletError");
const Config_1 = require("./Config");
/* REEEEE ADD TYPES */
const TurtleCoind = require('turtlecoin-rpc').TurtleCoind;
/**
 * Implements the daemon interface, talking to a standard TurtleCoind.
 */
class ConventionalDaemon {
    constructor(daemonHost, daemonPort) {
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
        this.daemonHost = daemonHost;
        this.daemonPort = daemonPort;
        this.daemon = new TurtleCoind({
            host: daemonHost,
            port: daemonPort,
            ssl: false,
            timeout: Config_1.default.requestTimeout,
        });
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
                info = yield this.daemon.info();
            }
            catch (err) {
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
            this.lastKnownHashrate = info.difficulty / Config_1.default.blockTargetTime;
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
    getWalletSyncData(blockHashCheckpoints, startHeight, startTimestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this.daemon.getWalletSyncData({
                blockHashCheckpoints,
                startHeight,
                startTimestamp,
            });
            return data.map(Types_1.Block.fromJSON);
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
            const data = yield this.daemon.getGlobalIndexesForRange({
                endHeight,
                startHeight,
            });
            const indexes = new Map();
            for (const index of data) {
                indexes.set(index.key, index.value);
            }
            return indexes;
        });
    }
    getCancelledTransactions(transactionHashes) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this.daemon.getTransactionsStatus({
                transactionHashes,
            });
            return data.transactionsUnknown || [];
        });
    }
    /**
     * Update the fee address and amount
     */
    updateFeeInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            let feeInfo;
            try {
                feeInfo = yield this.daemon.fee();
            }
            catch (err) {
                return;
            }
            if (feeInfo.status !== 'OK') {
                return;
            }
            const integratedAddressesAllowed = false;
            const err = ValidateParameters_1.validateAddresses(new Array(feeInfo.address), integratedAddressesAllowed).errorCode;
            if (err !== WalletError_1.WalletErrorCode.SUCCESS) {
                return;
            }
            if (feeInfo.amount > 0) {
                this.feeAddress = feeInfo.address;
                this.feeAmount = feeInfo.amount;
            }
        });
    }
}
exports.ConventionalDaemon = ConventionalDaemon;
