import { TransactionInputJSON, TransactionJSON, UnconfirmedInputJSON } from './JsonSerialization';
/**
 * @hidden
 */
export declare class Block {
    static fromJSON(json: any): Block;
    readonly coinbaseTransaction: RawCoinbaseTransaction;
    readonly transactions: RawTransaction[];
    readonly blockHeight: number;
    readonly blockHash: string;
    readonly blockTimestamp: number;
    constructor(coinbaseTransaction: RawCoinbaseTransaction, transactions: RawTransaction[], blockHeight: number, blockHash: string, blockTimestamp: number);
}
/**
 * @hidden
 */
export declare class RawCoinbaseTransaction {
    static fromJSON(json: any): RawCoinbaseTransaction;
    readonly keyOutputs: KeyOutput[];
    readonly hash: string;
    readonly transactionPublicKey: string;
    readonly unlockTime: number;
    constructor(keyOutputs: KeyOutput[], hash: string, transactionPublicKey: string, unlockTime: number);
}
/**
 * @hidden
 */
export declare class RawTransaction extends RawCoinbaseTransaction {
    static fromJSON(json: any): RawTransaction;
    readonly paymentID: string;
    readonly keyInputs: KeyInput[];
    constructor(keyOutputs: KeyOutput[], hash: string, transactionPublicKey: string, unlockTime: number, paymentID: string, keyInputs: KeyInput[]);
}
/**
 *
 */
export declare class Transaction {
    static fromJSON(json: TransactionJSON): Transaction;
    transfers: Map<string, number>;
    readonly hash: string;
    readonly fee: number;
    readonly blockHeight: number;
    readonly timestamp: number;
    readonly paymentID: string;
    readonly unlockTime: number;
    readonly isCoinbaseTransaction: boolean;
    constructor(transfers: Map<string, number>, hash: string, fee: number, blockHeight: number, timestamp: number, paymentID: string, unlockTime: number, isCoinbaseTransaction: boolean);
    totalAmount(): number;
    isFusionTransaction(): boolean;
    toJSON(): TransactionJSON;
}
/**
 * @hidden
 */
export declare class TransactionInput {
    static fromJSON(json: TransactionInputJSON): TransactionInput;
    readonly keyImage: string;
    readonly amount: number;
    readonly blockHeight: number;
    readonly transactionPublicKey: string;
    readonly transactionIndex: number;
    globalOutputIndex: number | undefined;
    readonly key: string;
    spendHeight: number;
    readonly unlockTime: number;
    readonly parentTransactionHash: string;
    constructor(keyImage: string, amount: number, blockHeight: number, transactionPublicKey: string, transactionIndex: number, globalOutputIndex: number | undefined, key: string, spendHeight: number, unlockTime: number, parentTransactionHash: string);
    toJSON(): TransactionInputJSON;
}
/**
 * @hidden
 */
export declare class UnconfirmedInput {
    static fromJSON(json: UnconfirmedInputJSON): UnconfirmedInput;
    readonly amount: number;
    readonly key: string;
    readonly parentTransactionHash: string;
    constructor(amount: number, key: string, parentTransactionHash: string);
    toJSON(): UnconfirmedInputJSON;
}
/**
 * @hidden
 */
export declare class KeyOutput {
    static fromJSON(json: any): KeyOutput;
    readonly key: string;
    readonly amount: number;
    readonly globalIndex?: number;
    constructor(key: string, amount: number);
}
/**
 * @hidden
 */
export declare class KeyInput {
    static fromJSON(json: any): KeyInput;
    readonly amount: number;
    readonly keyImage: string;
    readonly outputIndexes: number[];
    constructor(amount: number, keyImage: string, outputIndexes: number[]);
}
/**
 * @hidden
 */
export declare class TransactionData {
    transactionsToAdd: Transaction[];
    inputsToAdd: Array<[string, TransactionInput]>;
    keyImagesToMarkSpent: Array<[string, string]>;
}
/**
 * @hidden
 */
export declare class TxInputAndOwner {
    readonly input: TransactionInput;
    readonly privateSpendKey: string;
    readonly publicSpendKey: string;
    constructor(input: TransactionInput, privateSpendKey: string, publicSpendKey: string);
}
