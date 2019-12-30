// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { Config, IConfig } from './Config';
import { Block, TopBlock, DaemonConnection } from './Types';

/**
 * Provides an interface to a daemon or similar, such as a blockchain cache
 */
export interface IDaemon {

    /**
     * This is emitted whenever the interface fails to contact the underlying daemon.
     * This event will only be emitted on the first disconnection. It will not
     * be emitted again, until the daemon connects, and then disconnects again.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('disconnect', (error) => {
     *     console.log('Possibly lost connection to daemon: ' + error.toString());
     * });
     * ```
     *
     * @event
     */
    on(event: 'disconnect', callback: (error: Error) => void): this;

    /**
     * This is emitted whenever the interface previously failed to contact the
     * underlying daemon, and has now reconnected.
     * This event will only be emitted on the first connection. It will not
     * be emitted again, until the daemon disconnects, and then reconnects again.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('connect', () => {
     *     console.log('Regained connection to daemon!');
     * });
     * ```
     *
     * @event
     */
    on(event: 'connect', callback: () => void): this;

    /**
     * This is emitted whenever either the localDaemonBlockCount or the networkDaemonBlockCount
     * changes.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('heightchange', (localDaemonBlockCount, networkDaemonBlockCount) => {
     *     console.log(localDaemonBlockCount, networkDaemonBlockCount);
     * });
     *
     * @event
     */
    on(event: 'heightchange',
       callback: (localDaemonBlockCount: number, networkDaemonBlockCount: number) => void,
    ): this;

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
     *
     * Returns TopBlock data if daemon is synced, and daemon supports this
     * feature.
     */
    getWalletSyncData(
        blockHashCheckpoints: string[],
        startHeight: number,
        startTimestamp: number): Promise<[Block[], TopBlock | boolean]>;

    /**
     * Gets the node fee address and amount. Will be `['', 0]` if none/invalid
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
    getGlobalIndexesForRange(
        startHeight: number,
        endHeight: number): Promise<Map<string, number[]>>;

    /**
     * Get any transactions which we have sent, but are no longer present in
     * the pool or a block. (They have returned to our wallet)
     */
    getCancelledTransactions(transactionHashes: string[]): Promise<string[]>;

    /**
     * Gets random outputs for the given amounts. requestedOuts per. Usually mixin+1.
     *
     * @returns Returns an array of amounts to global indexes and keys. There
     *          should be requestedOuts indexes if the daemon fully fulfilled
     *          our request.
     */
    getRandomOutputsByAmount(
        amounts: number[],
        requestedOuts: number): Promise<Array<[number, Array<[number, string]>]>>;

    /**
     * Sends a raw serialized transaction to the daemon. Returns true/false
     * based on daemon status.
     *
     * Will throw on timeout.
     *
     * @returns Whether the transaction was accepted and an optional extra
     *          error message.
     */
    sendTransaction(rawTransaction: string): Promise<[boolean, string | undefined]>;

    /**
     * Updates the internal config with the passed in config.
     */
    updateConfig(config: IConfig): void;

    /**
     * Returns information on the daemon connection such as host and port
     */
    getConnectionInfo(): DaemonConnection;

    /**
     * Returns host:port
     */
    getConnectionString(): string;
}
