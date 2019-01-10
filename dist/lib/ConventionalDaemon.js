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
const TurtleCoind = require('turtlecoin-rpc').TurtleCoind;
class ConventionalDaemon {
    constructor(daemonHost, daemonPort) {
        this.feeAddress = '';
        this.feeAmount = 0;
        this.localDaemonBlockCount = 0;
        this.networkBlockCount = 0;
        this.peerCount = 0;
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
    getNetworkBlockCount() {
        return this.networkBlockCount;
    }
    getLocalDaemonBlockCount() {
        return this.localDaemonBlockCount;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            /* Note - if one promise throws, the other will be cancelled */
            yield Promise.all([this.getDaemonInfo(), this.getFeeInfo()]);
        });
    }
    getDaemonInfo() {
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
    nodeFee() {
        return [this.feeAddress, this.feeAmount];
    }
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
    getFeeInfo() {
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
