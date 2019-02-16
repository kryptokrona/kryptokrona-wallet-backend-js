import { IDaemon } from './IDaemon';
import { SubWallets } from './SubWallets';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { Block, TransactionData, TransactionInput } from './Types';
/**
 * Decrypts blocks for our transactions and inputs
 */
export declare class WalletSynchronizer {
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
    constructor(daemon: IDaemon, subWallets: SubWallets, startTimestamp: number, startHeight: number, privateViewKey: string);
    /**
     * Initialize things we can't initialize from the JSON
     */
    initAfterLoad(subWallets: SubWallets, daemon: IDaemon): void;
    /**
     * Convert from class to stringable type
     */
    toJSON(): WalletSynchronizerJSON;
    /**
     * Download the next set of blocks from the daemon
     */
    getBlocks(sleep: boolean): Promise<Block[]>;
    processBlock(block: Block, ourInputs: Array<[string, TransactionInput]>): TransactionData;
    /**
     * Process transaction outputs of the given block. No external dependencies,
     * lets us easily swap out with a C++ replacement for SPEEEED
     *
     * @param keys Array of spend keys in the format [publicKey, privateKey]
     */
    processBlockOutputs(block: Block, privateViewKey: string, spendKeys: Array<[string, string]>, isViewWallet: boolean, processCoinbaseTransactions: boolean): Array<[string, TransactionInput]>;
    /**
     * Get the height of the sync process
     */
    getHeight(): number;
    /**
     * Takes in hashes that we have previously sent. Returns transactions which
     * are no longer in the pool, and not in a block, and therefore have
     * returned to our wallet
     */
    findCancelledTransactions(transactionHashes: string[]): Promise<string[]>;
    storeBlockHash(blockHeight: number, blockHash: string): void;
    /**
     * Process the outputs of a transaction, and create inputs that are ours
     */
    private processTransactionOutputs;
    private processCoinbaseTransaction;
    private processTransaction;
}
