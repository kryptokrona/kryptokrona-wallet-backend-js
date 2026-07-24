/// <reference types="node" />
import { EventEmitter } from 'events';
import { Config } from './Config';
import { Daemon } from './Daemon';
import { SubWallets } from './SubWallets';
import { SynchronizationStatus } from './SynchronizationStatus';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { Block, TransactionData, TransactionInput } from './Types';
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
    constructor(daemon: Daemon, subWallets: SubWallets, startTimestamp: number, startHeight: number, privateViewKey: string, config: Config, synchronizationStatus?: SynchronizationStatus);
    getScanHeights(): [number, number];
    /**
     * Initialize things we can't initialize from the JSON
     */
    initAfterLoad(subWallets: SubWallets, daemon: Daemon, config: Config): void;
    /**
     * Convert from class to stringable type
     */
    toJSON(): WalletSynchronizerJSON;
    processBlock(block: Block, ourInputs: [string, TransactionInput][]): TransactionData;
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
    processBlockOutputs(block: Block, privateViewKey: string, spendKeys: [string, string][], isViewWallet: boolean, processCoinbaseTransactions: boolean): Promise<[string, TransactionInput][]>;
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
    checkIncomingPoolTransaction(thisTx: any, thisHash: any, spendKeys: any): Promise<boolean>;
    checkPoolTransactions(): Promise<void>;
}
