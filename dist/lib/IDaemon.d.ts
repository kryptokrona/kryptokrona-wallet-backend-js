import { Block } from './Types';
export interface IDaemon {
    getWalletSyncData(blockHashCheckpoints: string[], startHeight: number, startTimestamp: number): Promise<Block[]>;
    nodeFee(): [string, number];
    init(): Promise<void>;
    getDaemonInfo(): Promise<void>;
    getNetworkBlockCount(): number;
    getLocalDaemonBlockCount(): number;
    getGlobalIndexesForRange(startHeight: number, endHeight: number): Promise<Map<string, number[]>>;
}
