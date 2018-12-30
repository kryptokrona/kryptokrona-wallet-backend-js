// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import { SynchronizationStatusJSON } from './JsonSerialization';

export class SynchronizationStatus {
    static fromJSON(json: SynchronizationStatusJSON): SynchronizationStatus {
        let synchronizationStatus = Object.create(SynchronizationStatus.prototype);

        return Object.assign(synchronizationStatus, json, {
            blockHashCheckpoints: json.blockHashCheckpoints,
            lastKnownBlockHashes: json.lastKnownBlockHashes,
            lastKnownBlockHeight: json.lastKnownBlockHeight
        });
    }

    toJSON(): SynchronizationStatusJSON {
        return {
            blockHashCheckpoints: this.blockHashCheckpoints,
            lastKnownBlockHashes: this.lastKnownBlockHashes,
            lastKnownBlockHeight: this.lastKnownBlockHeight
        }
    }

    private blockHashCheckpoints: string[] = new Array();

    private lastKnownBlockHashes: string[] = new Array();

    private lastKnownBlockHeight: number = 0;
}
