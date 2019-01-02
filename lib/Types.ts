// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import { 
    TransactionJSON, transfersToVector, TransactionInputJSON,
    UnconfirmedInputJSON 
} from './JsonSerialization';

export class Block {
    constructor(
        coinbaseTransaction: RawCoinbaseTransaction,
        transactions: RawTransaction[],
        blockHeight: number,
        blockHash: string,
        blockTimestamp: number) {

        this.coinbaseTransaction = coinbaseTransaction;
        this.transactions = transactions;
        this.blockHeight = blockHeight;
        this.blockHash = blockHash;
        this.blockTimestamp = blockTimestamp;
    }

    /* The coinbase transaction contained in this block */
    readonly coinbaseTransaction: RawCoinbaseTransaction;

    /* The standard transactions contain in this block (may be empty) */
    readonly transactions: RawTransaction[];

    /* The height of this block in the block chain */
    readonly blockHeight: number;

    /* The hash of the block */
    readonly blockHash: string;

    /* The timestamp of this block */
    readonly blockTimestamp: number;
}

export class RawCoinbaseTransaction {
    constructor(
        keyOutputs: KeyOutput[],
        hash: string,
        transactionPublicKey: string,
        unlockTime: number) {

        this.keyOutputs = keyOutputs;
        this.hash = hash;
        this.transactionPublicKey = transactionPublicKey;
        this.unlockTime = unlockTime;
    }

    /* The outputs of this transaction */
    readonly keyOutputs: KeyOutput[];

    /* The hash of this transaction */
    readonly hash: string;

    /* The public key of this transaction */
    readonly transactionPublicKey: string;

    /* When this transaction is unlocked for spending - can be interpreted as
       both a block height and a unix timestamp */
    readonly unlockTime: number;
}

export class RawTransaction extends RawCoinbaseTransaction {
    constructor(
        keyOutputs: KeyOutput[],
        hash: string,
        transactionPublicKey: string,
        unlockTime: number,
        paymentID: string,
        keyInputs: KeyInput[]) {

        super(keyOutputs, hash, transactionPublicKey, unlockTime);

        this.paymentID = paymentID;
        this.keyInputs = keyInputs;
    }

    /* The payment ID this transaction has. May be empty string. */
    readonly paymentID: string;

    /* The inputs this transaction has */
    readonly keyInputs: KeyInput[];
}

export class Transaction {
    constructor(
        transfers: Map<string, number>,
        hash: string,
        fee: number,
        blockHeight: number,
        timestamp: number,
        paymentID: string,
        unlockTime: number,
        isCoinbaseTransaction: boolean) {

        this.transfers = transfers;
        this.hash = hash;
        this.fee = fee;
        this.blockHeight = blockHeight;
        this.timestamp = timestamp;
        this.paymentID = paymentID;
        this.unlockTime = unlockTime;
        this.isCoinbaseTransaction = isCoinbaseTransaction;
    }

    static fromJSON(json: TransactionJSON): Transaction {
        let transaction = Object.create(Transaction.prototype);

        return Object.assign(transaction, json, {
            transfers: new Map<string, number>(
                json.transfers.map(x => [x.publicKey, x.amount] as [string, number])
            ),

            hash: json.hash,

            fee: json.fee,

            blockHeight: json.blockHeight,

            timestamp: json.timestamp,

            paymentID: json.paymentID,

            unlockTime: json.unlockTime,

            isCoinbaseTransactions: json.isCoinbaseTransaction
        });
    }

    toJSON() : TransactionJSON {
        return {
            transfers: transfersToVector(this.transfers),

            hash: this.hash,

            fee: this.fee,

            blockHeight: this.blockHeight,

            timestamp: this.timestamp,

            paymentID: this.paymentID,

            unlockTime: this.unlockTime,

            isCoinbaseTransaction: this.isCoinbaseTransaction
        }
    }

    /* A mapping of subwallets to amounts received in this transfer */
    transfers: Map<string, number>;

    /* The hash of this transaction */
    readonly hash: string;

    /* The mining fee paid on this transaction */
    readonly fee: number;

    /* The block height this transaction is contained in */
    readonly blockHeight: number;

    /* The timestamp of the block this transaction is contained in */
    readonly timestamp: number;

    /* The payment ID this transaction has. May be empty string. */
    readonly paymentID: string;

    /* When this transaction is unlocked for spending - can be interpreted as
       both a block height and a unix timestamp */
    readonly unlockTime: number;

    /* Was this tranasction a miner reward / coinbase transaction */
    readonly isCoinbaseTransaction: boolean;
}

export class TransactionInput {
    constructor(
        keyImage: string,
        amount: number,
        blockHeight: number,
        transactionPublicKey: string,
        transactionIndex: number,
        globalOutputIndex: number,
        key: string,
        spendHeight: number,
        unlockTime: number,
        parentTransactionHash: string) {

        this.keyImage = keyImage;
        this.amount = amount;
        this.blockHeight = blockHeight;
        this.transactionPublicKey = transactionPublicKey;
        this.transactionIndex = transactionIndex;
        this.globalOutputIndex = globalOutputIndex;
        this.key = key;
        this.spendHeight = spendHeight;
        this.unlockTime = unlockTime;
        this.parentTransactionHash = parentTransactionHash;
    }

    static fromJSON(json: TransactionInputJSON): TransactionInput {
        let transactionInput = Object.create(TransactionInput.prototype);

        return Object.assign(transactionInput, json, {
            keyImage: json.keyImage,

            amount: json.amount,

            blockHeight: json.blockHeight,

            transactionPublicKey: json.transactionPublicKey,

            transactionIndex: json.transactionIndex,

            globalOutputIndex: json.globalOutputIndex,

            key: json.key,

            spendHeight: json.spendHeight,

            unlockTime: json.unlockTime,

            parentTransactionHash: json.parentTransactionHash
        });
    }

    toJSON() : TransactionInputJSON {
        return {
            keyImage: this.keyImage,

            amount: this.amount,

            blockHeight: this.blockHeight,

            transactionPublicKey: this.transactionPublicKey,

            transactionIndex: this.transactionIndex,

            globalOutputIndex: this.globalOutputIndex,

            key: this.key,

            spendHeight: this.spendHeight,

            unlockTime: this.unlockTime,

            parentTransactionHash: this.parentTransactionHash
        }
    }


    /* The key image of this input */
    readonly keyImage: string;

    /* The value of this input */
    readonly amount: number;

    /* The height this transaction was included in. Needed for removing forked
       transactions. */
    readonly blockHeight: number;

    /* The public key of this transaction */
    readonly transactionPublicKey: string;

    /* The index of this input in the transaction */
    readonly transactionIndex: number;

    /* The index of this output in the global 'DB' */
    readonly globalOutputIndex: number;

    /* The transaction key we took from the key outputs. NOT the same as the
       transaction public key. Confusing, I know. */
    readonly key: string;

    /* The height this transaction was spent at. Zero if unspent. */
    spendHeight: number;

    /* When this transaction is unlocked for spending - can be interpreted as
       both a block height and a unix timestamp */
    readonly unlockTime: number;

    /* The transaction hash of the transaction that contains this input */
    readonly parentTransactionHash: string;
}

/* A structure just used to display locked balance, due to change from
   sent transactions. We just need the amount and a unique identifier
   (hash+key), since we can't spend it, we don't need all the other stuff */
export class UnconfirmedInput {
    constructor(
        amount: number,
        key: string,
        parentTransactionHash: string) {

        this.amount = amount;
        this.key = key;
        this.parentTransactionHash = parentTransactionHash;
    }

    static fromJSON(json: UnconfirmedInputJSON): UnconfirmedInput {
        let unconfirmedInput = Object.create(UnconfirmedInput.prototype);

        return Object.assign(unconfirmedInput, json, {
            amount: json.amount,

            key: json.key,

            parentTransactionHash: json.parentTransactionHash
        });
    }

    toJSON() : UnconfirmedInputJSON {
        return {
            amount: this.amount,

            key: this.key,

            parentTransactionHash: this.parentTransactionHash
        }
    }

    /* The amount of the number */
    readonly amount: number;

    /* The transaction key we took from the key outputs. */
    readonly key: string;

    /* The transaction hash of the transaction that contains this input */
    readonly parentTransactionHash: string;
}

export class KeyOutput {
    constructor(
        key: string,
        amount: number) {

        this.key = key;
        this.amount = amount;
    }

    /* The output key */
    readonly key: string;

    /* The output amount */
    readonly amount: number;

    /* The index of the amount in the DB. The blockchain cache api returns
       this, but the regular daemon does not. */
    readonly globalIndex?: number;
}

export class KeyInput {
    constructor(
        amount: number,
        keyImage: string,
        outputIndexes: number[]) {

        this.amount = amount;
        this.keyImage = keyImage;
        this.outputIndexes = outputIndexes;
    }

    /* The amount of this input */
    readonly amount: number;

    /* The key image of this input */
    readonly keyImage: string;

    /* The output indexes of the fake and real outputs this input was created
       from, in the global 'DB' */
    readonly outputIndexes: number[];
}
