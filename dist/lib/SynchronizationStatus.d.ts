import { SynchronizationStatusJSON } from './JsonSerialization';
export declare class SynchronizationStatus {
    static fromJSON(json: SynchronizationStatusJSON): SynchronizationStatus;
    private readonly blockHashCheckpoints;
    private readonly lastKnownBlockHashes;
    private lastKnownBlockHeight;
    private lastSavedCheckpointAt;
    constructor(lastKnownBlockHeight?: number, blockHashCheckpoints?: string[], lastKnownBlockHashes?: string[], lastSavedCheckpointAt?: number);
    toJSON(): SynchronizationStatusJSON;
    getHeight(): number;
    storeBlockHash(blockHeight: number, blockHash: string): void;
    getBlockCheckpoints(): string[];
    getRecentBlockHashes(): string[];
}
