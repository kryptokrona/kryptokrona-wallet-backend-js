// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { IDaemon } from './IDaemon';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { SynchronizationStatus } from './SynchronizationStatus';
import {
    Block, RawCoinbaseTransaction, RawTransaction, TransactionData,
} from './Types';

export class WalletSynchronizer {

    public static fromJSON(json: WalletSynchronizerJSON): WalletSynchronizer {
        const walletSynchronizer = Object.create(WalletSynchronizer.prototype);

        return Object.assign(walletSynchronizer, json, {
            privateViewKey: json.privateViewKey,
            startHeight: json.startHeight,
            startTimestamp: json.startTimestamp,
            synchronizationStatus: SynchronizationStatus.fromJSON(json.transactionSynchronizerStatus),
        });
    }

    private daemon: IDaemon;

    private startTimestamp: number;

    private startHeight: number;

    private readonly privateViewKey: string;

    private synchronizationStatus: SynchronizationStatus = new SynchronizationStatus();

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

    public toJSON(): WalletSynchronizerJSON {
        return {
            privateViewKey: this.privateViewKey,
            startHeight: this.startHeight,
            startTimestamp: this.startTimestamp,
            transactionSynchronizerStatus: this.synchronizationStatus.toJSON(),
        };
    }

    public async getBlocks(): Promise<Block[]> {
        /* TODO */
        return [];
    }

    public processTransaction(
        transaction: RawTransaction,
        txData: TransactionData): TransactionData {

        /* TODO */
        return txData;
    }

    public processCoinbaseTransaction(
        transaction: RawCoinbaseTransaction,
        txData: TransactionData): TransactionData {

        /* TODO */
        return txData;
    }

    public getHeight(): number {
        return this.synchronizationStatus.getHeight();
    }

    public checkLockedTransactions(transactionHashes: string[]): string[] {
        /* TODO */
        return [];
    }

    public storeBlockHash(blockHeight: number, blockHash: string): void {
        /* TODO */
    }
}
