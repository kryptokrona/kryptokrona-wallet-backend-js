// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import {
    BLOCK_HASH_CHECKPOINTS_INTERVAL, LAST_KNOWN_BLOCK_HASHES_SIZE,
} from './Constants';

import { SynchronizationStatusJSON } from './JsonSerialization';

import { LogCategory, LogLevel, logger } from './Logger';

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

    private lastSavedCheckpointAt: number = 0;

    constructor(
        lastKnownBlockHeight: number = 0,
        blockHashCheckpoints: string[] = [],
        lastKnownBlockHashes: string[] = [],
        lastSavedCheckpointAt: number = 0) {

        if (lastKnownBlockHeight <= 0) {
            lastKnownBlockHeight = 0;
        }

        this.lastKnownBlockHeight = lastKnownBlockHeight;
        this.blockHashCheckpoints = blockHashCheckpoints;
        this.lastKnownBlockHashes = lastKnownBlockHashes;
        this.lastSavedCheckpointAt = lastSavedCheckpointAt;
    }

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
        this.lastKnownBlockHeight = blockHeight;

        /* Hash already exists */
        if (this.lastKnownBlockHashes.length > 0 && this.lastKnownBlockHashes[0] === blockHash) {
            return;
        }

        /* If we're at a checkpoint height, add the hash to the infrequent
           checkpoints (at the beginning of the queue) */
        if (this.lastSavedCheckpointAt + BLOCK_HASH_CHECKPOINTS_INTERVAL < blockHeight) {
            this.lastSavedCheckpointAt = blockHeight;
            this.blockHashCheckpoints.unshift(blockHash);
        }

        this.lastKnownBlockHashes.unshift(blockHash);

        /* If we're exceeding capacity, remove the last (oldest) hash */
        if (this.lastKnownBlockHashes.length > LAST_KNOWN_BLOCK_HASHES_SIZE) {
            this.lastKnownBlockHashes.pop();
        }
    }

    public getBlockCheckpoints(): string[] {
        return this.blockHashCheckpoints;
    }

    public getRecentBlockHashes(): string[] {
        return this.lastKnownBlockHashes;
    }
}
