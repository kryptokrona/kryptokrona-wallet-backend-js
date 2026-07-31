import { Transaction as CreatedTransaction } from 'kryptokrona-utils';
import { WalletError } from './WalletError';
import { TransactionInputJSON, TransactionJSON, UnconfirmedInputJSON } from './JsonSerialization';
/**
 * @hidden
 */
export declare class Block {
    static fromJSON(json: any): Block;
    readonly coinbaseTransaction?: RawCoinbaseTransaction;
    readonly transactions: RawTransaction[];
    readonly blockHeight: number;
    readonly blockHash: string;
    readonly blockTimestamp: number;
    constructor(transactions: RawTransaction[], blockHeight: number, blockHash: string, blockTimestamp: number, coinbaseTransaction?: RawCoinbaseTransaction);
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
    parentTransactionHash: string;
    privateEphemeral?: string;
    constructor(keyImage: string, amount: number, blockHeight: number, transactionPublicKey: string, transactionIndex: number, globalOutputIndex: number | undefined, key: string, spendHeight: number, unlockTime: number, parentTransactionHash: string, privateEphemeral?: string);
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
    readonly locked: boolean;
    constructor(amount: number, key: string, parentTransactionHash: string, locked: boolean);
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
    inputsToAdd: [string, TransactionInput][];
    keyImagesToMarkSpent: [string, string][];
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
export declare class TopBlock {
    readonly hash: string;
    readonly height: number;
    constructor(hash: string, height: number);
}
export interface PreparedTransaction {
    fee: number;
    paymentID: string;
    inputs: TxInputAndOwner[];
    changeAddress: string;
    changeRequired: number;
    rawTransaction: CreatedTransaction;
}
/**
 * @hidden
 */
export interface PreparedTransactionInfo {
    success: boolean;
    error: WalletError;
    fee?: number;
    paymentID?: string;
    inputs?: TxInputAndOwner[];
    changeAddress?: string;
    changeRequired?: number;
    rawTransaction?: CreatedTransaction;
    transactionHash?: string;
    prettyTransaction?: Transaction;
    destinations?: Destinations;
    nodeFee?: number;
}
export interface Destination {
    address: string;
    amount: number;
}
export interface Destinations {
    /**
     * The address and amount of the node fee. Will not be present if no node
     * fee was charged.
     */
    nodeFee?: Destination;
    /**
     * The amount sent to ourselves as change.
     */
    change?: Destination;
    /**
     * The amounts we sent to each destination/destinations given in the
     * sendTransactionBasic/sendTransactionAdvanced call. Can be helpful
     * to determine how much was sent when using `sendAll`.
     */
    userDestinations: Destination[];
}
export interface SendTransactionResult {
    /**
     * Did the transaction creation / sending succeed?
     */
    success: boolean;
    /**
     * If the transaction did not succeed, this will hold the error. Will be
     * SUCCESS if the transaction succeeded.
     */
    error: WalletError;
    /**
     * If the transaction was sent, or it failed after the fee needed was
     * determined, this will hold the fee used or required for the transaction.
     */
    fee?: number;
    /**
     * Whether the transaction was relayed to the network. Will be `true` if
     * using sendTransactionBasic, or sendTransactionAdvanced with the `relayToNetwork`
     * parameter set to true or not given.
     * Will be undefined if transaction was not successful.
     */
    relayedToNetwork?: boolean;
    /**
     * The transaction hash of the resulting transaction. Will be set if success
     * is true.
     */
    transactionHash?: string;
    /**
     * The object that can be stored client side to then relayed with sendRawPreparedTransaction
     */
    preparedTransaction?: PreparedTransaction;
    /**
     * The amounts and addresses of node fee, change address, and user destinations.
     * Will be present if success is true.
     */
    destinations?: Destinations;
    /**
     * The node fee we were charged. Will be present if success is true. In
     * atomic units.
     */
    nodeFee?: number;
}
export declare enum DaemonType {
    ConventionalDaemon = 0,
    BlockchainCacheApi = 1
}
export interface DaemonConnection {
    host: string;
    port: number;
    daemonType: DaemonType;
    daemonTypeDetermined: boolean;
    ssl: boolean;
    sslDetermined: boolean;
}
