import { Block } from './Types';
/**
 * Provides an interface to a daemon or similar, such as a blockchain cache
 */
export interface IDaemon {
    /**
     * @param blockHashCheckpoints  Hashes of the last known blocks. Later
     *                              blocks (higher block height) should be
     *                              ordered at the front of the array.
     *
     * @param startHeight           Height to start taking blocks from
     * @param startTimestamp        Block timestamp to start taking blocks from
     *
     * Gets blocks from the daemon. Blocks are returned starting from the last
     * known block hash (if higher than the startHeight/startTimestamp)
     */
    getWalletSyncData(blockHashCheckpoints: string[], startHeight: number, startTimestamp: number): Promise<Block[]>;
    /**
     * Gets the node fee address and amount. Will be ['', 0] if none/invalid
     */
    nodeFee(): [string, number];
    /**
     * Initializes the daemon if necessary, with node fee and internal data
     */
    init(): Promise<void>;
    /**
     * Updates internal daemon info
     */
    updateDaemonInfo(): Promise<void>;
    /**
     * Returns the height that the network has. Possibly 0 if can't connect
     * to daemon
     */
    getNetworkBlockCount(): number;
    /**
     * Returns the height that the local daemon has.
     */
    getLocalDaemonBlockCount(): number;
    /**
     * @returns Returns a mapping of transaction hashes to global indexes
     *
     * Get global indexes for the transactions in the range
     * [startHeight, endHeight]
     */
    getGlobalIndexesForRange(startHeight: number, endHeight: number): Promise<Map<string, number[]>>;
}
