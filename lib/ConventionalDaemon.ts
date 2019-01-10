// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { IDaemon } from './IDaemon';
import { Block } from './Types';
import { validateAddresses } from './ValidateParameters';
import { WalletError, WalletErrorCode } from './WalletError';

import config from './Config';

const TurtleCoind = require('turtlecoin-rpc').TurtleCoind;

export class ConventionalDaemon implements IDaemon {

    private readonly daemonHost: string;

    private readonly daemonPort: number;

    private readonly daemon: any;

    private feeAddress: string = '';

    private feeAmount: number = 0;

    private localDaemonBlockCount = 0;

    private networkBlockCount = 0;

    private peerCount = 0;

    private lastKnownHashrate = 0;

    constructor(daemonHost: string, daemonPort: number) {
        this.daemonHost = daemonHost;
        this.daemonPort = daemonPort;

        this.daemon = new TurtleCoind({
            host: daemonHost,
            port: daemonPort,
            ssl: false,
            timeout: config.requestTimeout,
        });
    }

    public getNetworkBlockCount(): number {
        return this.networkBlockCount;
    }

    public getLocalDaemonBlockCount(): number {
        return this.localDaemonBlockCount;
    }

    public async init(): Promise<void> {
        /* Note - if one promise throws, the other will be cancelled */
        await Promise.all([this.getDaemonInfo(), this.getFeeInfo()]);
    }

    public async getDaemonInfo(): Promise<void> {
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
        if (this.networkBlockCount !== 0) {
            this.networkBlockCount--;
        }

        this.peerCount = info.incoming_connections_count + info.outgoing_connections_count;

        this.lastKnownHashrate = info.difficulty / config.blockTargetTime;
    }

    public nodeFee(): [string, number] {
        return [this.feeAddress, this.feeAmount];
    }

    public async getWalletSyncData(
        blockHashCheckpoints: string[],
        startHeight: number,
        startTimestamp: number): Promise<Block[]> {

        const data = await this.daemon.getWalletSyncData({
            blockHashCheckpoints,
            startHeight,
            startTimestamp,
        });

        return data.map(Block.fromJSON);
    }

    public async getGlobalIndexesForRange(
        startHeight: number,
        endHeight: number): Promise<Map<string, number[]>> {

        const data = await this.daemon.getGlobalIndexesForRange({
            endHeight,
            startHeight,
        });

        const indexes: Map<string, number[]> = new Map();

        for (const index of data) {
            indexes.set(index.key, index.value);
        }

        return indexes;
    }

    private async getFeeInfo(): Promise<void> {
        let feeInfo;

        try {
            feeInfo = await this.daemon.fee();
        } catch (err) {
            return;
        }

        if (feeInfo.status !== 'OK') {
            return;
        }

        const integratedAddressesAllowed: boolean = false;

        const err: WalletErrorCode = validateAddresses(
            new Array(feeInfo.address), integratedAddressesAllowed,
        ).errorCode;

        if (err !== WalletErrorCode.SUCCESS) {
            return;
        }

        if (feeInfo.amount > 0) {
            this.feeAddress = feeInfo.address;
            this.feeAmount = feeInfo.amount;
        }
    }
}
