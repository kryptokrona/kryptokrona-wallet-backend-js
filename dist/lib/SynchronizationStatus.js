"use strict";
// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynchronizationStatus = void 0;
const Constants_1 = require("./Constants");
class SynchronizationStatus {
    static fromJSON(json) {
        const synchronizationStatus = Object.create(SynchronizationStatus.prototype);
        return Object.assign(synchronizationStatus, {
            blockHashCheckpoints: json.blockHashCheckpoints,
            lastKnownBlockHashes: json.lastKnownBlockHashes,
            lastKnownBlockHeight: json.lastKnownBlockHeight,
        });
    }
    constructor(lastKnownBlockHeight = 0, blockHashCheckpoints = [], lastKnownBlockHashes = [], lastSavedCheckpointAt = 0) {
        this.blockHashCheckpoints = [];
        this.lastKnownBlockHashes = [];
        this.lastKnownBlockHeight = 0;
        this.lastSavedCheckpointAt = 0;
        if (lastKnownBlockHeight <= 0) {
            lastKnownBlockHeight = 0;
        }
        this.lastKnownBlockHeight = lastKnownBlockHeight;
        this.blockHashCheckpoints = blockHashCheckpoints;
        this.lastKnownBlockHashes = lastKnownBlockHashes;
        this.lastSavedCheckpointAt = lastSavedCheckpointAt;
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
        this.lastKnownBlockHeight = blockHeight;
        /* Hash already exists */
        if (this.lastKnownBlockHashes.length > 0 && this.lastKnownBlockHashes[0] === blockHash) {
            return;
        }
        /* If we're at a checkpoint height, add the hash to the infrequent
           checkpoints (at the beginning of the queue) */
        if (this.lastSavedCheckpointAt + Constants_1.BLOCK_HASH_CHECKPOINTS_INTERVAL < blockHeight) {
            this.lastSavedCheckpointAt = blockHeight;
            this.blockHashCheckpoints.unshift(blockHash);
        }
        this.lastKnownBlockHashes.unshift(blockHash);
        /* If we're exceeding capacity, remove the last (oldest) hash */
        if (this.lastKnownBlockHashes.length > Constants_1.LAST_KNOWN_BLOCK_HASHES_SIZE) {
            this.lastKnownBlockHashes.pop();
        }
    }
    getBlockCheckpoints() {
        return this.blockHashCheckpoints;
    }
    getRecentBlockHashes() {
        return this.lastKnownBlockHashes;
    }
}
exports.SynchronizationStatus = SynchronizationStatus;
