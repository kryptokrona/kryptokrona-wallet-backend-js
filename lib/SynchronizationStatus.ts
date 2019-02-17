// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import {
    BLOCK_HASH_CHECKPOINTS_INTERVAL, LAST_KNOWN_BLOCK_HASHES_SIZE,
} from './Constants';

import { SynchronizationStatusJSON } from './JsonSerialization';

export class SynchronizationStatus {
    public static fromJSON(json: SynchronizationStatusJSON): SynchronizationStatus {
        const synchronizationStatus = Object.create(SynchronizationStatus.prototype);

        return Object.assign(synchronizationStatus, {
            blockHashCheckpoints: json.blockHashCheckpoints,
            lastKnownBlockHashes: json.lastKnownBlockHashes,
            lastKnownBlockHeight: json.lastKnownBlockHeight,
        });
    }

    private blockHashCheckpoints: string[] = [];

    private lastKnownBlockHashes: string[] = [];

    private lastKnownBlockHeight: number = 0;

    public toJSON(): SynchronizationStatusJSON {
        return {
            blockHashCheckpoints: this.blockHashCheckpoints,
            lastKnownBlockHashes: this.lastKnownBlockHashes,
            lastKnownBlockHeight: this.lastKnownBlockHeight,
        };
    }

    public getHeight(): number {
        return this.lastKnownBlockHeight;
    }

    public storeBlockHash(blockHeight: number, blockHash: string): void {
        /* If it's not a fork and not the very first block */
        if (blockHeight > this.lastKnownBlockHeight && this.lastKnownBlockHeight !== 0) {
            /* Height should be one more than previous height */
            if (blockHeight !== this.lastKnownBlockHeight + 1) {
                throw new Error(
                    'Blocks were missed in syncing process! Expected: ' +
                    (this.lastKnownBlockHeight + 1) +
                    ', Received: ' + blockHeight + '.\nPossibly malicious daemon.',
                );
            }
        }

        this.lastKnownBlockHeight = blockHeight;

        /* If we're at a checkpoint height, add the hash to the infrequent
           checkpoints (at the beginning of the queue) */
        if (blockHeight % BLOCK_HASH_CHECKPOINTS_INTERVAL === 0) {
            this.blockHashCheckpoints.unshift(blockHash);
        }

        this.lastKnownBlockHashes.unshift(blockHash);

        /* If we're exceeding capacity, remove the last (oldest) hash */
        if (this.lastKnownBlockHashes.length > LAST_KNOWN_BLOCK_HASHES_SIZE) {
            this.lastKnownBlockHashes.pop();
        }
    }

    public getProcessedBlockHashCheckpoints(): string[] {
        return this.lastKnownBlockHashes.concat(this.blockHashCheckpoints);
    }
}
