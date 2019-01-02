// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import { IDaemon } from './IDaemon';
import { Block } from './Types';
import { WalletError, WalletErrorCode } from './WalletError';
import { validateAddresses } from './ValidateParameters';

import config from './Config';

const TurtleCoind = require('turtlecoin-rpc').TurtleCoind;

export class ConventionalDaemon implements IDaemon {
    constructor(daemonHost: string, daemonPort: number) {
        this.daemonHost = daemonHost;
        this.daemonPort = daemonPort;

        this.daemon = new TurtleCoind({
            host: daemonHost,
            port: daemonPort,
            timeout: config.requestTimeout,
            ssl: false
        });
    }

    private readonly daemonHost: string;

    private readonly daemonPort: number;

    private readonly daemon: any;

    private feeAddress: string = '';

    private feeAmount: number = 0;

    private shouldStop: boolean = false;

    private localDaemonBlockCount = 0;

    private networkBlockCount = 0;

    private peerCount = 0;

    private lastKnownHashrate = 0;

    private backgroundRefresh() {
        while (!this.shouldStop) {
            this.getDaemonInfo();
        }
    }

    private async getDaemonInfo() {
        let info;

        try {
            info = await this.daemon.info();
        } catch (err) {
            return;
        }

        this.localDaemonBlockCount = info.height;
        this.networkBlockCount = info.network_height;

        /* Height returned is one more than the current height - but we
           don't want to overflow is the height returned is zero */
        if (this.networkBlockCount != 0)
        {
            this.networkBlockCount--;
        }

        this.peerCount = info.incoming_connections_count + info.outgoing_connections.count;

        this.lastKnownHashrate = info.difficulty / config.blockTargetTime;
    }

    private async getFeeInfo() {
        let feeInfo;

        try {
            feeInfo = await this.daemon.fee();
        } catch (err) {
            return;
        }

        if (feeInfo.status != 'OK') {
            return;
        }

        const integratedAddressesAllowed: boolean = false;

        const err: WalletErrorCode = validateAddresses(
            new Array(feeInfo.address), integratedAddressesAllowed
        ).errorCode;

        if (err !== WalletErrorCode.SUCCESS) {
            return;
        }

        if (feeInfo.amount > 0) {
            this.feeAddress = feeInfo.address;
            this.feeAmount = feeInfo.amount;
        }
    }

    nodeFee(): [string, number] {
        return [this.feeAddress, this.feeAmount];
    }

    async getWalletSyncData(
        blockHashCheckpoints: string[],
        startHeight: number,
        startTimestamp: number): Promise<Block[]> {

        return this.daemon.getWalletSyncData({
            startHeight: startHeight,
            startTimestamp: startTimestamp,
            blockHashCheckpoints: blockHashCheckpoints
        });
    }
}
