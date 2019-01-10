import { IDaemon } from './IDaemon';
import { Block } from './Types';
export declare class ConventionalDaemon implements IDaemon {
    private readonly daemonHost;
    private readonly daemonPort;
    private readonly daemon;
    private feeAddress;
    private feeAmount;
    private localDaemonBlockCount;
    private networkBlockCount;
    private peerCount;
    private lastKnownHashrate;
    constructor(daemonHost: string, daemonPort: number);
    getNetworkBlockCount(): number;
    getLocalDaemonBlockCount(): number;
    init(): Promise<void>;
    getDaemonInfo(): Promise<void>;
    nodeFee(): [string, number];
    getWalletSyncData(blockHashCheckpoints: string[], startHeight: number, startTimestamp: number): Promise<Block[]>;
    getGlobalIndexesForRange(startHeight: number, endHeight: number): Promise<Map<string, number[]>>;
    private getFeeInfo;
}
