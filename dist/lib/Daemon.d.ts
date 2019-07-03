import { Block, TopBlock } from './Types';
import { IConfig } from './Config';
import { IDaemon } from './IDaemon';
export declare class Daemon implements IDaemon {
    /**
     * Daemon/API host
     */
    private host;
    /**
     * Daemon/API port
     */
    private port;
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
    private config;
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
    getWalletSyncData(blockHashCheckpoints: string[], startHeight: number, startTimestamp: number, blockCount: number): Promise<[Block[], TopBlock | undefined]>;
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
    getRandomOutputsByAmount(amounts: number[], requestedOuts: number): Promise<Array<[number, Array<[number, string]>]>>;
    sendTransaction(rawTransaction: string): Promise<boolean>;
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
