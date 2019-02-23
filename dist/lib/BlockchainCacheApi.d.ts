import { Block } from './Types';
import { IDaemon } from './IDaemon';
/**
 * Implements the daemon interface, talking to a standard TurtleCoind.
 */
export declare class BlockchainCacheApi implements IDaemon {
    /**
     * The base URL for our API. Shouldn't have a trailing '/'.
     */
    private cacheBaseURL;
    /**
     * Whether we should use https for our requests
     */
    private ssl;
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
     * @param cacheBaseURL  The base URL for our API. Shouldn't have a trailing '/'
     * @param ssl           Should we use https? Defaults to true.
     *
     * Example usage:
     * ```
     * const daemon = new BlockchainCacheApi('blockapi.turtlepay.io', true);
     * ```
     */
    constructor(cacheBaseURL: string, ssl?: boolean);
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
    getWalletSyncData(blockHashCheckpoints: string[], startHeight: number, startTimestamp: number, blockCount: number): Promise<Block[]>;
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
    /**
     * Makes a get request to the given endpoint
     */
    private makeGetRequest;
    /**
     * Makes a post request to the given endpoint with the given body
     */
    private makePostRequest;
}
