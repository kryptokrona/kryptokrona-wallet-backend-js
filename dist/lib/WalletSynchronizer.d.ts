import { EventEmitter } from 'events';
import { Config } from './Config';
import { Daemon } from './Daemon';
import { SubWallets } from './SubWallets';
import { SynchronizationStatus } from './SynchronizationStatus';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { Block, TransactionData, TransactionInput, ScanStats } from './Types';
/**
 * An output of a pool transaction that belongs to this wallet
 *
 * @hidden
 */
export interface PoolTransactionOutput {
    ownerSpendKey: string;
    keyImage: string;
    thisHash: string;
    amount: number;
    key: string;
    index: number;
}
/**
 * Decrypts blocks for our transactions and inputs
 * @noInheritDoc
 */
export declare class WalletSynchronizer extends EventEmitter {
    static fromJSON(json: WalletSynchronizerJSON): WalletSynchronizer;
    /**
     * The daemon instance to retrieve blocks from
     */
    private daemon;
    /**
     * The timestamp to start taking blocks from
     */
    private startTimestamp;
    /**
     * The height to start taking blocks from
     */
    private startHeight;
    /**
     * The shared private view key of this wallet
     */
    private readonly privateViewKey;
    /**
     * Stores the progress of our synchronization
     */
    private synchronizationStatus;
    /**
     * Used to find spend keys, inspect key images, etc
     */
    private subWallets;
    /**
     * Whether we are already downloading a chunk of blocks
     */
    private fetchingBlocks;
    /**
     * Stored blocks for later processing
     */
    private storedBlocks;
    /**
     * Transactions that have disappeared from the pool and not appeared in a
     * block, and the amount of times they have failed this check.
     */
    private cancelledTransactionsFailCount;
    /**
     * Function to run on block download completion to ensure reset() works
     * correctly without blocks being stored after wiping them.
     */
    private finishedFunc;
    /**
     * Last time we fetched blocks from the daemon. If this goes over the
     * configured limit, we'll emit deadnode.
     */
    private lastDownloadedBlocks;
    private config;
    /**
     * Counts of the output scan since the wallet was started or loaded (not
     * saved in the wallet file)
     */
    private scanStats;
    constructor(daemon: Daemon, subWallets: SubWallets, startTimestamp: number, startHeight: number, privateViewKey: string, config: Config, synchronizationStatus?: SynchronizationStatus);
    getScanHeights(): [number, number];
    /**
     * Initialize things we can't initialize from the JSON
     */
    initAfterLoad(subWallets: SubWallets, daemon: Daemon, config: Config): void;
    /**
     * Returns the counts of the output scan so far: outputs looked at, outputs
     * with a view tag, tagged outputs skipped by their view tag, and outputs
     * that needed the full ownership check. Only counts the built-in scan,
     * not a function set with `setBlockOutputProcessFunc`.
     */
    getScanStats(): ScanStats;
    /**
     * Resets the counts returned by [[getScanStats]]
     */
    resetScanStats(): void;
    /**
     * Convert from class to stringable type
     */
    toJSON(): WalletSynchronizerJSON;
    processBlock(block: Block, ourInputs: Array<[string, TransactionInput]>): TransactionData;
    /**
     * Process transaction outputs of the given block. No external dependencies,
     * lets us easily swap out with a C++ replacement for SPEEEED
     *
     * @param block
     * @param privateViewKey
     * @param spendKeys Array of spend keys in the format [publicKey, privateKey]
     * @param isViewWallet
     * @param processCoinbaseTransactions
     */
    processBlockOutputs(block: Block, privateViewKey: string, spendKeys: Array<[string, string]>, isViewWallet: boolean, processCoinbaseTransactions: boolean): Promise<Array<[string, TransactionInput]>>;
    /**
     * Get the height of the sync process
     */
    getHeight(): number;
    reset(scanHeight: number, scanTimestamp: number): Promise<void>;
    rewind(scanHeight: number): Promise<void>;
    /**
     * Takes in hashes that we have previously sent. Returns transactions which
     * are no longer in the pool, and not in a block, and therefore have
     * returned to our wallet
     */
    findCancelledTransactions(transactionHashes: string[]): Promise<string[]>;
    /**
     * Retrieve blockCount blocks from the internal store. Does not remove
     * them.
     */
    fetchBlocks(blockCount: number): Promise<[Block[], boolean]>;
    dropBlock(blockHeight: number, blockHash: string): void;
    getBlockCheckpoints(): string[];
    getRecentBlockHashes(): string[];
    /**
     * Finds the outputs of a pool transaction (`/get_pool_changes_lite`
     * `txPrefix` JSON) that belong to us. Tagged outputs (`target.type` "03",
     * `target.data.view_tag`) are checked against their view tag first.
     *
     * @hidden
     */
    getPoolTransactionOutputs(thisTx: any, thisHash: string, spendKeys: string[]): Promise<PoolTransactionOutput[]>;
    checkIncomingPoolTransaction(thisTx: any, thisHash: any, spendKeys: any): Promise<boolean>;
    checkPoolTransactions(): Promise<void>;
    private getStoredBlockCheckpoints;
    /**
     * Only retrieve more blocks if we're not getting close to the memory limit
     */
    private shouldFetchMoreBlocks;
    private getWalletSyncDataHashes;
    private downloadBlocks;
    /**
     * Process the outputs of a transaction, and create inputs that are ours
     */
    private processTransactionOutputs;
    private processCoinbaseTransaction;
    private processTransaction;
    private getMutableScanStats;
}
