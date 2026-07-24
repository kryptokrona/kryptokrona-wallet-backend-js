/// <reference types="node" />
import { EventEmitter } from 'events';
import { Block as UtilsBlock, Transaction as UtilsTransaction } from 'kryptokrona-utils';
import { IConfig } from './Config';
import { Block, TopBlock, DaemonConnection } from './Types';
export declare interface Daemon {
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
     * @event This is emitted whenever the interface fails to contact the underlying daemon.
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
     * @event This is emitted whenever the interface previously failed to contact the underlying daemon, and has now reconnected.
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
     * ```
     *
     * @event This is emitted whenever either the localDaemonBlockCount or the networkDaemonBlockCount changes
     */
    on(event: 'heightchange', callback: (localDaemonBlockCount: number, networkDaemonBlockCount: number) => void): this;
    /**
     * This is emitted every time we download a block from the daemon. Will
     * only be emitted if the daemon is using /getrawblocks (All non blockchain
     * cache daemons should support this).
     *
     * This block object is an instance of the [Block turtlecoin-utils class](https://utils.turtlecoin.dev/classes/block.html).
     * See the Utils docs for further info on using this value.
     *
     * Note that a block emitted after a previous one could potentially have a lower
     * height, if a blockchain fork took place.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('rawblock', (block) => {
     *      console.log(`Downloaded new block ${block.hash}`);
     * });
     * ```
     *
     * @event This is emitted every time we download a block from the daemon
     */
    on(event: 'rawblock', callback: (block: UtilsBlock) => void): this;
    /**
     * This is emitted every time we download a transaction from the daemon. Will
     * only be emitted if the daemon is using /getrawblocks (All non blockchain
     * cache daemons should support this).
     *
     * This transaction object is an instance of the [Transaction turtlecoin-utils class](https://utils.turtlecoin.dev/classes/transaction.html).
     * See the Utils docs for further info on using this value.
     *
     * Note that a transaction emitted after a previous one could potentially have a lower
     * height in the chain, if a blockchain fork took place.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('rawtransaction', (block) => {
     *      console.log(`Downloaded new transaction ${transaction.hash}`);
     * });
     * ```
     *
     * @event This is emitted every time we download a transaction from the daemon
     */
    on(event: 'rawtransaction', callback: (transaction: UtilsTransaction) => void): this;
}
/**
 * @noInheritDoc
 */
export declare class Daemon extends EventEmitter {
    /**
     * Daemon/API host
     */
    private readonly host;
    /**
     * Daemon/API port
     */
    private readonly port;
    /**
     * Whether we should use https for our requests
     */
    private ssl;
    /**
     * Have we determined if we should be using ssl or not?
     */
    private sslDetermined;
    /**
     * Whether we're talking to a conventional daemon, or a blockchain cache API
     */
    private isCacheApi;
    /**
     * Have we determined if this is a cache API or not?
     */
    private isCacheApiDetermined;
    /**
     * The address node fees will go to
     */
    private feeAddress;
    /**
     * The amount of the node fee in atomic units
     */
    private feeAmount;
    /**
     * The amount of blocks the daemon we're connected to has
     */
    private localDaemonBlockCount;
    /**
     * The amount of blocks the network has
     */
    private networkBlockCount;
    /**
     * The amount of peers we have, incoming+outgoing
     */
    private peerCount;
    /**
     * The hashrate of the last known local block
     */
    private lastKnownHashrate;
    /**
     * The number of blocks to download per /getwalletsyncdata request
     */
    private blockCount;
    /**
     * Should we use /getrawblocks instead of /getwalletsyncdata
     */
    private useRawBlocks;
    private config;
    private httpAgent;
    private httpsAgent;
    /**
     * Last time the network height updated. If this goes over the configured
     * limit, we'll emit deadnode.
     */
    private lastUpdatedNetworkHeight;
    /**
     * Last time the daemon height updated. If this goes over the configured
     * limit, we'll emit deadnode.
     */
    private lastUpdatedLocalHeight;
    /**
     * Did our last contact with the daemon succeed. Set to true initially
     * so initial failure to connect will fire disconnect event.
     */
    private connected;
    /**
     * @param host The host to access the API on. Can be an IP, or a URL, for
     *             example, 1.1.1.1, or blockapi.turtlepay.io
     *
     * @param port The port to access the API on. Normally 11898 for a TurtleCoin
     *             daemon, 80 for a HTTP api, or 443 for a HTTPS api.
     *
     * @param isCacheApi You can optionally specify whether this API is a
     *                   blockchain cache API to save a couple of requests.
     *                   If you're not sure, do not specify this parameter -
     *                   we will work it out automatically.
     *
     * @param ssl        You can optionally specify whether this API supports
     *                   ssl/tls/https to save a couple of requests.
     *                   If you're not sure, do not specify this parameter -
     *                   we will work it out automatically.
     */
    constructor(host: string, port: number, isCacheApi?: boolean, ssl?: boolean);
    updateConfig(config: IConfig): void;
    /**
     * Get the amount of blocks the network has
     */
    getNetworkBlockCount(): number;
    /**
     * Get the amount of blocks the daemon we're connected to has
     */
    getLocalDaemonBlockCount(): number;
    /**
     * Initialize the daemon and the fee info
     */
    init(): Promise<void>;
    /**
     * Update the daemon info
     */
    updateDaemonInfo(): Promise<void>;
    /**
     * Get the node fee and address
     */
    nodeFee(): [string, number];
    getPoolChanges(knownTxs: any[]): Promise<any>;
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
    getWalletSyncData(blockHashCheckpoints: string[], startHeight: number, startTimestamp: number): Promise<[Block[], TopBlock | boolean]>;
    /**
     * @returns Returns a mapping of transaction hashes to global indexes
     *
     * Get global indexes for the transactions in the range
     * [startHeight, endHeight]
     */
    getGlobalIndexesForRange(startHeight: number, endHeight: number): Promise<Map<string, number[]>>;
    getCancelledTransactions(transactionHashes: string[]): Promise<string[]>;
    /**
     * Gets random outputs for the given amounts. requestedOuts per. Usually mixin+1.
     *
     * @returns Returns an array of amounts to global indexes and keys. There
     *          should be requestedOuts indexes if the daemon fully fulfilled
     *          our request.
     */
    getRandomOutputsByAmount(amounts: number[], requestedOuts: number): Promise<[number, [number, string][]][]>;
    sendTransaction(rawTransaction: string): Promise<[boolean, string | undefined]>;
    getConnectionInfo(): DaemonConnection;
    getConnectionString(): string;
    private rawBlocksToBlocks;
    /**
     * Update the fee address and amount
     */
    private updateFeeInfo;
    private makeGetRequest;
    private makePostRequest;
    /**
     * Makes a get request to the given endpoint
     */
    private makeRequest;
}
