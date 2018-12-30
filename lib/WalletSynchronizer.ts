// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import { WalletSynchronizerJSON } from './JsonSerialization';
import { IDaemon } from './IDaemon';
import { SynchronizationStatus } from './SynchronizationStatus';

export class WalletSynchronizer {
    constructor(
        daemon: IDaemon,
        startTimestamp: number,
        startHeight: number,
        privateViewKey: string) {

        this.daemon = daemon;
        this.startTimestamp = startTimestamp;
        this.startHeight = startHeight;
        this.privateViewKey = privateViewKey;
    }

    static fromJSON(json: WalletSynchronizerJSON): WalletSynchronizer {
        let walletSynchronizer = Object.create(WalletSynchronizer.prototype);

        return Object.assign(walletSynchronizer, json, {
            startTimestamp: json.startTimestamp,
            startHeight: json.startHeight,
            privateViewKey: json.privateViewKey,
            transactionSynchronizerStatus: SynchronizationStatus.fromJSON(json.transactionSynchronizerStatus),
            blockchainSynchronizer: SynchronizationStatus.fromJSON(json.transactionSynchronizerStatus)
        });
    }

    toJSON(): WalletSynchronizerJSON {
        return {
            startTimestamp: this.startTimestamp,
            startHeight: this.startHeight,
            privateViewKey: this.privateViewKey,
            transactionSynchronizerStatus: this.transactionSynchronizerStatus.toJSON()
        };
    }

    private daemon: IDaemon;

    private startTimestamp: number;

    private startHeight: number;

    private readonly privateViewKey: string;

    private transactionSynchronizerStatus: SynchronizationStatus = new SynchronizationStatus();

    private blockchainSynchronizer: SynchronizationStatus = new SynchronizationStatus();
}
