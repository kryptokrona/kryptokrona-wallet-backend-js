"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const Constants_1 = require("./Constants");
class SynchronizationStatus {
    constructor() {
        this.blockHashCheckpoints = [];
        this.lastKnownBlockHashes = [];
        this.lastKnownBlockHeight = 0;
    }
    static fromJSON(json) {
        const synchronizationStatus = Object.create(SynchronizationStatus.prototype);
        return Object.assign(synchronizationStatus, {
            blockHashCheckpoints: json.blockHashCheckpoints,
            lastKnownBlockHashes: json.lastKnownBlockHashes,
            lastKnownBlockHeight: json.lastKnownBlockHeight,
        });
    }
    toJSON() {
        return {
            blockHashCheckpoints: this.blockHashCheckpoints,
            lastKnownBlockHashes: this.lastKnownBlockHashes,
            lastKnownBlockHeight: this.lastKnownBlockHeight,
        };
    }
    getHeight() {
        return this.lastKnownBlockHeight;
    }
    storeBlockHash(blockHeight, blockHash) {
        /* If it's not a fork and not the very first block */
        if (blockHeight > this.lastKnownBlockHeight && this.lastKnownBlockHeight !== 0) {
            /* Height should be one more than previous height */
            if (blockHeight !== this.lastKnownBlockHeight + 1) {
                throw new Error('Blocks were missed in syncing process! Expected: ' +
                    (this.lastKnownBlockHeight + 1) +
                    ', Received: ' + blockHeight + '.\nPossibly malicious daemon.');
            }
        }
        this.lastKnownBlockHeight = blockHeight;
        /* If we're at a checkpoint height, add the hash to the infrequent
           checkpoints (at the beginning of the queue) */
        if (blockHeight % Constants_1.BLOCK_HASH_CHECKPOINTS_INTERVAL === 0) {
            this.blockHashCheckpoints.unshift(blockHash);
        }
        this.lastKnownBlockHashes.unshift(blockHash);
        /* If we're exceeding capacity, remove the last (oldest) hash */
        if (this.lastKnownBlockHashes.length > Constants_1.LAST_KNOWN_BLOCK_HASHES_SIZE) {
            this.lastKnownBlockHashes.pop();
        }
    }
    getProcessedBlockHashCheckpoints() {
        return this.lastKnownBlockHashes.concat(this.blockHashCheckpoints);
    }
}
exports.SynchronizationStatus = SynchronizationStatus;
