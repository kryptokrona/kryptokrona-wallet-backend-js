// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils} from './CnUtils';
import { SubWalletsJSON, txPrivateKeysToVector } from './JsonSerialization';
import { SubWallet } from './SubWallet';
import { Config } from './Config';

import {
    Transaction, TransactionInput, TxInputAndOwner, UnconfirmedInput,
} from './Types';

import {
    FUSION_TX_MIN_INPUT_COUNT, MAX_FUSION_TX_SIZE,
} from './Constants';

import { addressToKeys, getCurrentTimestampAdjusted } from './Utilities';
import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';

import * as _ from 'lodash';

/**
 * Stores each subwallet, along with transactions and public spend keys
 */
export class SubWallets {

    /**
     * Loads SubWallets from json
     */
    public static fromJSON(json: SubWalletsJSON): SubWallets {
        const subWallets = Object.create(SubWallets.prototype);

        const newSubWallets: SubWallets = Object.assign(subWallets, {
            publicSpendKeys: json.publicSpendKeys,

            subWallets: new Map<string, SubWallet>(
                json.subWallet.map((x) => [x.publicSpendKey, SubWallet.fromJSON(x)] as [string, SubWallet]),
            ),

            transactions: json.transactions.map((x) => Transaction.fromJSON(x)),

            lockedTransactions: json.lockedTransactions.map((x) => Transaction.fromJSON(x)),

            privateViewKey: json.privateViewKey,

            isViewWallet: json.isViewWallet,

            transactionPrivateKeys: new Map<string, string>(
                json.txPrivateKeys.map((x) => [x.transactionHash, x.txPrivateKey] as [string, string]),
            ),

            keyImageOwners: new Map(),
        });

        newSubWallets.initKeyImageMap();

        return newSubWallets;
    }

    /**
     * Whether the wallet is a view only wallet (cannot send transactions,
     * only can view)
     */
    public readonly isViewWallet: boolean;

    /**
     * The public spend keys this wallet contains. Used for verifying if a
     * transaction is ours.
     */
    private publicSpendKeys: string[] = [];

    /**
     * Mapping of public spend key to subwallet
     */
    private subWallets: Map<string, SubWallet> = new Map();

    /**
     * Our transactions
     */
    private transactions: Transaction[] = [];

    /**
     * Transactions we sent, but haven't been confirmed yet
     */
    private lockedTransactions: Transaction[] = [];

    /**
     * The shared private view key
     */
    private readonly privateViewKey: string;

    /**
     * A mapping of transaction hashes, to transaction private keys
     */
    private transactionPrivateKeys: Map<string, string> = new Map();

    /**
     * A mapping of key images to the subwallet public spend key that owns them
     */
    private keyImageOwners: Map<string, string> = new Map();

    private config: Config = new Config();

    /**
     * @param privateSpendKey Private spend key is optional if it's a view wallet
     */
    constructor(
        config: Config,
        address: string,
        scanHeight: number,
        newWallet: boolean,
        privateViewKey: string,
        privateSpendKey?: string) {

        this.config = config;

        this.isViewWallet = privateSpendKey === undefined;
        this.privateViewKey = privateViewKey;

        let timestamp = 0;

        if (newWallet) {
            timestamp = getCurrentTimestampAdjusted(this.config.blockTargetTime);
        }

        const publicKeys = CryptoUtils(config).decodeAddress(address);

        this.publicSpendKeys.push(publicKeys.publicSpendKey);

        const subWallet = new SubWallet(
            config, address, scanHeight, timestamp, publicKeys.publicSpendKey,
            privateSpendKey,
        );

        this.subWallets.set(publicKeys.publicSpendKey, subWallet);
    }

    public initKeyImageMap() {
        for (const [publicKey, subWallet] of this.subWallets) {
            for (const keyImage of subWallet.getKeyImages()) {
                this.keyImageOwners.set(keyImage, publicKey);
            }
        }
    }

    public pruneSpentInputs(pruneHeight: number) {
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.pruneSpentInputs(pruneHeight);
        }
    }

    public reset(scanHeight: number, scanTimestamp: number) {
        this.transactions = [];
        this.lockedTransactions = [];
        this.transactionPrivateKeys = new Map();
        this.keyImageOwners = new Map();

        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.reset(scanHeight, scanTimestamp);
        }
    }

    /**
     * Convert SubWallets to something we can JSON.stringify
     */
    public toJSON(): SubWalletsJSON {
        return {
            publicSpendKeys: this.publicSpendKeys,

            subWallet: [...this.subWallets.values()].map((x) => x.toJSON()),

            transactions: this.transactions.map((x) => x.toJSON()),

            lockedTransactions: this.lockedTransactions.map((x) => x.toJSON()),

            privateViewKey: this.privateViewKey,

            isViewWallet: this.isViewWallet,

            txPrivateKeys: txPrivateKeysToVector(this.transactionPrivateKeys),
        };
    }

    /**
     * Get the shared private view key
     */
    public getPrivateViewKey(): string {
        return this.privateViewKey;
    }

    /**
     * Get the private spend key for the given public spend key, if it exists
     */
    public getPrivateSpendKey(publicSpendKey: string): [WalletError, string] {
        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            return [new WalletError(WalletErrorCode.ADDRESS_NOT_IN_WALLET), ''];
        }

        return [SUCCESS, subWallet.getPrivateSpendKey()];
    }

    /**
     * Gets the 'primary' subwallet
     */
    public getPrimarySubWallet(): SubWallet {
        for (const [publicKey, subWallet] of this.subWallets) {
            if (subWallet.isPrimaryAddress()) {
                return subWallet;
            }
        }

        throw new Error('Wallet has no primary address!');
    }

    /**
     * Gets the primary address of the wallet
     */
    public getPrimaryAddress(): string {
        return this.getPrimarySubWallet().getAddress();
    }

    /**
     * Gets the private spend key of the primary subwallet
     */
    public getPrimaryPrivateSpendKey(): string {
        return this.getPrimarySubWallet().getPrivateSpendKey();
    }

    /**
     * Get the hashes of the locked transactions (ones we've sent but not
     * confirmed)
     */
    public getLockedTransactionHashes(): string[] {
        return this.lockedTransactions.map((x) => x.hash);
    }

    /**
     * Add this transaction to the container. If the transaction was previously
     * sent by us, remove it from the locked container
     */
    public addTransaction(transaction: Transaction): void {
        /* Remove this transaction from the locked data structure, if we had
           added it previously as an outgoing tx */
        _.remove(this.lockedTransactions, (tx) => {
            return tx.hash === transaction.hash;
        });

        if (this.transactions.some((tx) => tx.hash === transaction.hash)) {
            throw new Error(`Transaction ${transaction.hash} was added to the wallet twice!`);
        }

        this.transactions.push(transaction);
    }

    /**
     * Adds a transaction we sent to the locked transactions container
     */
    public addUnconfirmedTransaction(transaction: Transaction): void {
        if (this.lockedTransactions.some((tx) => tx.hash === transaction.hash)) {
            throw new Error(`Transaction ${transaction.hash} was added to the wallet twice!`);
        }

        this.lockedTransactions.push(transaction);
    }

    /**
     * @param publicSpendKey    The public spend key of the subwallet to add this
     *                          input to
     *
     * Store the transaction input in the corresponding subwallet
     */
    public storeTransactionInput(publicSpendKey: string, input: TransactionInput): void {
        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }

        if (!this.isViewWallet) {
            this.keyImageOwners.set(input.keyImage, publicSpendKey);
        }

        subWallet.storeTransactionInput(input, this.isViewWallet);
    }

    /**
     * @param publicSpendKey    The public spend key of the subwallet to mark
     *                          the corresponding input spent in
     * @param spendHeight       The height the input was spent at
     *
     * Marks an input as spent by us, no longer part of balance or available
     * for spending. Input is identified by keyImage (unique)
     */
    public markInputAsSpent(publicSpendKey: string, keyImage: string, spendHeight: number): void {
        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }

        subWallet.markInputAsSpent(keyImage, spendHeight);
    }

    public markInputAsLocked(publicSpendKey: string, keyImage: string): void {
        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }

        subWallet.markInputAsLocked(keyImage);
    }

    /**
     * Remove a transaction that we sent by didn't get included in a block and
     * returned to us. Removes the correspoding inputs, too.
     */
    public removeCancelledTransaction(transactionHash: string): void {
        /* Remove the tx if it was locked */
        _.remove(this.lockedTransactions, (tx) => {
            return tx.hash === transactionHash;
        });

        /* Remove the corresponding inputs */
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.removeCancelledTransaction(transactionHash);
        }
    }

    /**
     * Remove transactions which occured in a forked block. If they got added
     * in another block, we'll add them back again then.
     */
    public removeForkedTransactions(forkHeight: number): void {
        _.remove(this.transactions, (tx) => {
            return tx.blockHeight >= forkHeight;
        });

        let keyImagesToRemove: string[] = [];

        for (const [publicKey, subWallet] of this.subWallets) {
            keyImagesToRemove = keyImagesToRemove.concat(subWallet.removeForkedTransactions(forkHeight));
        }

        if (!this.isViewWallet) {
            for (const keyImage of keyImagesToRemove) {
                this.keyImageOwners.delete(keyImage);
            }
        }
    }

    /**
     * Convert a timestamp to a block height. Block heights are more dependable
     * than timestamps, which sometimes get treated a little funkily by the
     * daemon
     */
    public convertSyncTimestampToHeight(timestamp: number, height: number): void {
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.convertSyncTimestampToHeight(timestamp, height);
        }
    }

    /**
     * Get the owner (i.e., the public spend key of the subwallet) of this
     * keyImage
     *
     * @return Returns [true, publicSpendKey] if found, [false, ''] if not
     *         found
     */
    public getKeyImageOwner(keyImage: string): [boolean, string] {
        if (this.isViewWallet) {
            return [false, ''];
        }

        const owner: string | undefined = this.keyImageOwners.get(keyImage);

        if (owner) {
            return [true, owner];
        }

        return [false, ''];
    }

    /**
     * Gets all public spend keys in this container
     */
    public getPublicSpendKeys(): string[] {
        return this.publicSpendKeys;
    }

    /**
     * Get all [public, private] spend keys in a container
     */
    public getAllSpendKeys(): Array<[string, string]> {
        const keys: Array<[string, string]> = [];

        for (const [publicKey, subWallet] of this.subWallets) {
            keys.push([publicKey, subWallet.getPrivateSpendKey()]);
        }

        return keys;
    }

    /**
     * Generate the key image for an input
     */
    public getTxInputKeyImage(
        publicSpendKey: string,
        derivation: string,
        outputIndex: number): Promise<string> {

        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }

        if (this.isViewWallet) {
            return Promise.resolve('0'.repeat(64));
        }

        return subWallet.getTxInputKeyImage(derivation, outputIndex);
    }

    /**
     * Returns the summed balance of the given subwallet addresses. If none are given,
     * take from all.
     *
     * @return Returns [unlockedBalance, lockedBalance]
     */
    public getBalance(
        currentHeight: number,
        subWalletsToTakeFrom?: string[]): [number, number] {

        let publicSpendKeys: string[] = [];

        /* If no subwallets given, take from all */
        if (!subWalletsToTakeFrom) {
            publicSpendKeys = this.publicSpendKeys;
        } else {
            publicSpendKeys = subWalletsToTakeFrom.map((address) => {
                const [publicViewKey, publicSpendKey] = addressToKeys(address, this.config);

                return publicSpendKey;
            });
        }

        let unlockedBalance: number = 0;
        let lockedBalance: number = 0;

        for (const publicSpendKey of publicSpendKeys) {
            const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

            if (!subWallet) {
                throw new Error('Subwallet not found!');
            }

            const [unlocked, locked] = subWallet.getBalance(currentHeight);

            unlockedBalance += unlocked;
            lockedBalance += locked;
        }

        return [unlockedBalance, lockedBalance];
    }

    /**
     * Gets all addresses contained in this SubWallets container
     */
    public getAddresses(): string[] {
        const addresses: string[] = [];

        for (const [publicKey, subWallet] of this.subWallets) {
            addresses.push(subWallet.getAddress());
        }

        return addresses;
    }

    /**
     * Get input sufficient to spend the amount passed in, from the given
     * subwallets, along with the keys for that inputs owner.
     *
     * Throws if the subwallets don't exist, or not enough money is found.
     *
     * @returns Returns the inputs and their owners, and the sum of their money
     */
    public getTransactionInputsForAmount(
        amount: number,
        subWalletsToTakeFrom: string[],
        currentHeight: number): [TxInputAndOwner[], number] {

        let availableInputs: TxInputAndOwner[] = [];

        /* Loop through each subwallet that we can take from */
        for (const [publicViewKey, publicSpendKey] of subWalletsToTakeFrom.map((address) => addressToKeys(address, this.config))) {
            const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

            if (!subWallet) {
                throw new Error('Subwallet not found!');
            }

            /* Fetch the spendable inputs */
            availableInputs = availableInputs.concat(subWallet.getSpendableInputs(currentHeight));
        }

        /* Shuffle the inputs */
        availableInputs = _.shuffle(availableInputs);

        let foundMoney: number = 0;

        const inputsToUse: TxInputAndOwner[] = [];

        for (const input of availableInputs) {
            inputsToUse.push(input);

            foundMoney += input.input.amount;

            if (foundMoney >= amount) {
                return [_.sortBy(inputsToUse, (x) => x.input.amount), foundMoney];
            }
        }

        throw new Error(`Failed to find enough money! Needed: ${amount}, found: ${foundMoney}`);
    }

    public getFusionTransactionInputs(
        subWalletsToTakeFrom: string[],
        mixin: number,
        currentHeight: number): [TxInputAndOwner[], number] {

        let availableInputs: TxInputAndOwner[] = [];

        /* Loop through each subwallet we can take from */
        for (const [publicViewKey, publicSpendKey] of subWalletsToTakeFrom.map((address) => addressToKeys(address, this.config))) {
            const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

            if (!subWallet) {
                throw new Error('Subwallet not found!');
            }

            /* Fetch the spendable inputs */
            availableInputs = availableInputs.concat(subWallet.getSpendableInputs(currentHeight));
        }

        /* Shuffle the inputs */
        availableInputs = _.shuffle(availableInputs);

        /* Split the inputs into buckets based on what power of ten they are in
           (For example, [1, 2, 5, 7], [20, 50, 80, 80], [100, 600, 700]) */
        const buckets: Map<number, TxInputAndOwner[]>  = new Map();

        for (const walletAmount of availableInputs) {
            /* Find out how many digits the amount has, i.e. 1337 has 4 digits,
               420 has 3 digits */
            const numberOfDigits = Math.ceil(Math.log10(walletAmount.input.amount + 1));

            const tmp = buckets.get(numberOfDigits) || [];

            tmp.push(walletAmount);

            /* Insert the amount into the correct bucket */
            buckets.set(numberOfDigits, tmp);
        }

        let fullBuckets: TxInputAndOwner[][] = [];

        for (const [amount, bucket] of buckets) {
            /* Skip the buckets with not enough items */
            if (bucket.length >= FUSION_TX_MIN_INPUT_COUNT) {
                fullBuckets.push(bucket);
            }
        }

        /* Shuffle the full buckets */
        fullBuckets = _.shuffle(fullBuckets);

        let bucketsToTakeFrom: TxInputAndOwner[][] = [];

        /* We have full buckets, take the first full bucket */
        if (fullBuckets.length > 0) {
            bucketsToTakeFrom = [
                fullBuckets[0],
            ];
        /* Otherwise just use all buckets */
        } else {
            for (const [amount, bucket] of buckets) {
                bucketsToTakeFrom.push(bucket);
            }
        }

        const inputsToUse: TxInputAndOwner[] = [];

        /* See https://github.com/turtlecoin/turtlecoin/blob/153c08c3a046434522f7ac3ddd043037888b2bf5/src/CryptoNoteCore/Currency.cpp#L629 */
        /* With 3 mixin == 314 bytes. */
        const inputSize = 1 + (6 + 2) + 32 + 64 + 1 + 4 + mixin * (4 + 64);

        /* Probably about 100 inputs max. This ignores other size constraints,
           since it is a max, after all. */
        const maxInputsToTake = MAX_FUSION_TX_SIZE / inputSize;

        let foundMoney = 0;

        /* Loop through each bucket (Remember we're only looping through one if
           we've got a full bucket) */
        for (const bucket of bucketsToTakeFrom) {
            for (const walletAmount of bucket) {
                inputsToUse.push(walletAmount);

                foundMoney += walletAmount.input.amount;

                if (inputsToUse.length >= maxInputsToTake) {
                    return [ inputsToUse, foundMoney ];
                }
            }
        }

        return [ inputsToUse, foundMoney ];
    }

    /**
     * Store the private key for a given transaction
     */
    public storeTxPrivateKey(txPrivateKey: string, txHash: string): void {
        this.transactionPrivateKeys.set(txHash, txPrivateKey);
    }

    /**
     * Store an unconfirmed incoming amount, so we can correctly display locked
     * balances
     */
    public storeUnconfirmedIncomingInput(
        input: UnconfirmedInput,
        publicSpendKey: string) {

        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }

        subWallet.storeUnconfirmedIncomingInput(input);
    }

    /**
     * Get all transactions in a wallet container
     */
    public getTransactions(): Transaction[] {
        return this.transactions;
    }

    /**
     * Get the number of transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
     */
    public getNumTransactions(): number {
        return this.transactions.length;
    }

    /**
     * Get all unconfirmed transactions in a wallet container
     */
    public getUnconfirmedTransactions(): Transaction[] {
        return this.lockedTransactions;
    }

    /**
     * Get the number of unconfirmed transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
     */
    public getNumUnconfirmedTransactions(): number {
        return this.lockedTransactions.length;
    }

    public initAfterLoad(config: Config): void {
        this.config = config;
        this.subWallets.forEach((subWallet) => subWallet.initAfterLoad(config));
    }
}
