import { IDaemon } from './IDaemon';
import { SubWallets } from './SubWallets';
import { WalletSynchronizerJSON } from './JsonSerialization';
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
