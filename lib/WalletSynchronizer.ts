// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { IDaemon } from './IDaemon';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { SubWallets } from './SubWallets';
import { SynchronizationStatus } from './SynchronizationStatus';

import {
    Block, RawCoinbaseTransaction, RawTransaction, TransactionData,
} from './Types';

import * as _ from 'lodash';

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

    public async getBlocks(subWallets: SubWallets): Promise<Block[]> {
        const localDaemonBlockCount: number = this.daemon.getLocalDaemonBlockCount();

        const walletBlockCount: number = this.synchronizationStatus.getHeight();

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
        const blockCheckpoints: string[] = this.synchronizationStatus.getBlockHashCheckpoints();

        let blocks: Block[] = [];

        try {
            blocks = await this.daemon.getWalletSyncData(
                blockCheckpoints, this.startHeight, this.startTimestamp,
            );
        } catch (err) {
            return [];
        }

        if (blocks.length === 0) {
            return [];
        }

        /* Timestamp is transient and can change - block height is constant. */
        if (this.startTimestamp !== 0) {
            this.startTimestamp = 0;
            this.startHeight = blocks[0].blockHeight;

            subWallets.convertSyncTimestampToHeight(this.startTimestamp, this.startHeight);
        }

        /* If checkpoints are empty, this is the first sync request. */
        if (_.isEmpty(blockCheckpoints)) {
            const actualHeight: number = blocks[0].blockHeight;

            /* Only check if a timestamp isn't given */
            if (this.startTimestamp === 0) {
                /* The height we expect to get back from the daemon */
                if (actualHeight !== this.startHeight) {
                    throw new Error(
                        'Received unexpected block height from daemon. ' +
                        'Expected ' + this.startHeight + ', got ' + actualHeight + '\n',
                    );
                }
            }
        }

        return blocks;
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
        this.synchronizationStatus.storeBlockHash(blockHeight, blockHash);
    }
}
