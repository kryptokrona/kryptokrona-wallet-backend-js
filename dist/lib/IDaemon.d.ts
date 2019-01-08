import { Block } from './Types';
export interface IDaemon {
    getWalletSyncData(blockHashCheckpoints: string[], startHeight: number, startTimestamp: number): Promise<Block[]>;
    nodeFee(): [string, number];
    init(): void;
    getDaemonInfo(): void;
    getNetworkBlockCount(): number;
    getLocalDaemonBlockCount(): number;
}
