// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { Block } from './Types';

export interface IDaemon {
    /* Gets blocks from the daemon */
    getWalletSyncData(
        blockHashCheckpoints: string[],
        startHeight: number,
        startTimestamp: number): Promise<Block[]>;

    /* Gets the node fee address and amount. Will be ['', 0] if none/invalid */
    nodeFee(): [string, number];

    /* Initializes the daemon if necessary, with node fee and internal data */
    init(): Promise<void>;

    /* Updates internal daemon info */
    getDaemonInfo(): Promise<void>;

    /* Returns the height that the network has. Possibly 0 if can't connect
       to daemon */
    getNetworkBlockCount(): number;

    /* Returns the height that the local daemon has. */
    getLocalDaemonBlockCount(): number;

    /* Get global indexes for the transactions in the range [startHeight, endHeight] */
    getGlobalIndexesForRange(
        startHeight: number,
        endHeight: number): Promise<Map<string, number[]>>;
}
