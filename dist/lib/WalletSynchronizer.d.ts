import { IDaemon } from './IDaemon';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { SubWallets } from './SubWallets';
import { Block, KeyInput, RawCoinbaseTransaction, RawTransaction, TransactionData } from './Types';
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
    getBlocks(): Promise<Block[]>;
    /**
     * Get the global indexes for a range of blocks
     *
     * When we get the global indexes, we pass in a range of blocks, to obscure
     * which transactions we are interested in - the ones that belong to us.
     * To do this, we get the global indexes for all transactions in a range.
     *
     * For example, if we want the global indexes for a transaction in block
     * 17, we get all the indexes from block 10 to block 20.
     */
    getGlobalIndexes(blockHeight: number, hash: string): Promise<number[]>;
    /**
     * Process the transaction inputs of a transaction, and pick out transfers
     * and transactions that are ours
     */
    processTransactionInputs(keyInputs: KeyInput[], transfers: Map<string, number>, blockHeight: number, txData: TransactionData): [number, Map<string, number>, TransactionData];
    /**
     * Process the outputs of a transaction, and pick out transfers and
     * transactions that are ours, along with creating new inputs
     */
    processTransactionOutputs(rawTX: RawCoinbaseTransaction, transfers: Map<string, number>, blockHeight: number, txData: TransactionData): Promise<[number, Map<string, number>, TransactionData]>;
    processTransaction(rawTX: RawTransaction, blockTimestamp: number, blockHeight: number, txData: TransactionData): Promise<TransactionData>;
    processCoinbaseTransaction(rawTX: RawCoinbaseTransaction, blockTimestamp: number, blockHeight: number, txData: TransactionData): Promise<TransactionData>;
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
}
