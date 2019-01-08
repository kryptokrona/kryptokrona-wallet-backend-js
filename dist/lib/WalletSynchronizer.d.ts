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
    constructor(daemon: IDaemon, startTimestamp: number, startHeight: number, privateViewKey: string);
    initAfterLoad(subWallets: SubWallets): void;
    toJSON(): WalletSynchronizerJSON;
    getBlocks(): Promise<Block[]>;
    getGlobalIndexes(blockHeight: number, hash: string): number[];
    processTransactionInputs(keyInputs: KeyInput[], transfers: Map<string, number>, blockHeight: number, txData: TransactionData): [number, Map<string, number>, TransactionData];
    processTransactionOutputs(rawTX: RawCoinbaseTransaction, transfers: Map<string, number>, blockHeight: number, txData: TransactionData): [number, Map<string, number>, TransactionData];
    processTransaction(rawTX: RawTransaction, blockTimestamp: number, blockHeight: number, txData: TransactionData): TransactionData;
    processCoinbaseTransaction(rawTX: RawCoinbaseTransaction, blockTimestamp: number, blockHeight: number, txData: TransactionData): TransactionData;
    getHeight(): number;
    checkLockedTransactions(transactionHashes: string[]): string[];
    storeBlockHash(blockHeight: number, blockHash: string): void;
}
