import { IDaemon } from './IDaemon';
import { WalletSynchronizerJSON } from './JsonSerialization';
import { SubWallets } from './SubWallets';
import { Block, KeyInput, RawCoinbaseTransaction, RawTransaction, TransactionData } from './Types';
export declare class WalletSynchronizer {
    static fromJSON(json: WalletSynchronizerJSON): WalletSynchronizer;
    private daemon;
    private startTimestamp;
    private startHeight;
    private readonly privateViewKey;
    private synchronizationStatus;
    private subWallets;
    constructor(daemon: IDaemon, subWallets: SubWallets, startTimestamp: number, startHeight: number, privateViewKey: string);
    initAfterLoad(subWallets: SubWallets, daemon: IDaemon): void;
    toJSON(): WalletSynchronizerJSON;
    getBlocks(): Promise<Block[]>;
    getGlobalIndexes(blockHeight: number, hash: string): Promise<number[]>;
    processTransactionInputs(keyInputs: KeyInput[], transfers: Map<string, number>, blockHeight: number, txData: TransactionData): [number, Map<string, number>, TransactionData];
    processTransactionOutputs(rawTX: RawCoinbaseTransaction, transfers: Map<string, number>, blockHeight: number, txData: TransactionData): Promise<[number, Map<string, number>, TransactionData]>;
    processTransaction(rawTX: RawTransaction, blockTimestamp: number, blockHeight: number, txData: TransactionData): Promise<TransactionData>;
    processCoinbaseTransaction(rawTX: RawCoinbaseTransaction, blockTimestamp: number, blockHeight: number, txData: TransactionData): Promise<TransactionData>;
    getHeight(): number;
    checkLockedTransactions(transactionHashes: string[]): string[];
    storeBlockHash(blockHeight: number, blockHash: string): void;
}
