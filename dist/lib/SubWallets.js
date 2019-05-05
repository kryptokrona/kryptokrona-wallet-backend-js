"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const CnUtils_1 = require("./CnUtils");
const JsonSerialization_1 = require("./JsonSerialization");
const SubWallet_1 = require("./SubWallet");
const Types_1 = require("./Types");
const Constants_1 = require("./Constants");
const Utilities_1 = require("./Utilities");
const WalletError_1 = require("./WalletError");
const _ = require("lodash");
/**
 * Stores each subwallet, along with transactions and public spend keys
 */
class SubWallets {
    /**
     * @param privateSpendKey Private spend key is optional if it's a view wallet
     */
    constructor(address, scanHeight, newWallet, privateViewKey, privateSpendKey) {
        /**
         * The public spend keys this wallet contains. Used for verifying if a
         * transaction is ours.
         */
        this.publicSpendKeys = [];
        /**
         * Mapping of public spend key to subwallet
         */
        this.subWallets = new Map();
        /**
         * Our transactions
         */
        this.transactions = [];
        /**
         * Transactions we sent, but haven't been confirmed yet
         */
        this.lockedTransactions = [];
        /**
         * A mapping of transaction hashes, to transaction private keys
         */
        this.transactionPrivateKeys = new Map();
        /**
         * A mapping of key images to the subwallet public spend key that owns them
         */
        this.keyImageOwners = new Map();
        this.isViewWallet = privateSpendKey === undefined;
        this.privateViewKey = privateViewKey;
        let timestamp = 0;
        if (newWallet) {
            timestamp = Utilities_1.getCurrentTimestampAdjusted();
        }
        const publicKeys = CnUtils_1.CryptoUtils().decodeAddress(address);
        this.publicSpendKeys.push(publicKeys.publicSpendKey);
        const subWallet = new SubWallet_1.SubWallet(address, scanHeight, timestamp, publicKeys.publicSpendKey, privateSpendKey);
        this.subWallets.set(publicKeys.publicSpendKey, subWallet);
    }
    /**
     * Loads SubWallets from json
     */
    static fromJSON(json) {
        const subWallets = Object.create(SubWallets.prototype);
        const newSubWallets = Object.assign(subWallets, {
            publicSpendKeys: json.publicSpendKeys,
            subWallets: new Map(json.subWallet.map((x) => [x.publicSpendKey, SubWallet_1.SubWallet.fromJSON(x)])),
            transactions: json.transactions.map((x) => Types_1.Transaction.fromJSON(x)),
            lockedTransactions: json.lockedTransactions.map((x) => Types_1.Transaction.fromJSON(x)),
            privateViewKey: json.privateViewKey,
            isViewWallet: json.isViewWallet,
            transactionPrivateKeys: new Map(json.txPrivateKeys.map((x) => [x.transactionHash, x.txPrivateKey])),
            keyImageOwners: new Map(),
        });
        newSubWallets.initKeyImageMap();
        return newSubWallets;
    }
    initKeyImageMap() {
        for (const [publicKey, subWallet] of this.subWallets) {
            for (const keyImage of subWallet.getKeyImages()) {
                this.keyImageOwners.set(keyImage, publicKey);
            }
        }
    }
    pruneSpentInputs(pruneHeight) {
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.pruneSpentInputs(pruneHeight);
        }
    }
    reset(scanHeight, scanTimestamp) {
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
    toJSON() {
        return {
            publicSpendKeys: this.publicSpendKeys,
            subWallet: [...this.subWallets.values()].map((x) => x.toJSON()),
            transactions: this.transactions.map((x) => x.toJSON()),
            lockedTransactions: this.lockedTransactions.map((x) => x.toJSON()),
            privateViewKey: this.privateViewKey,
            isViewWallet: this.isViewWallet,
            txPrivateKeys: JsonSerialization_1.txPrivateKeysToVector(this.transactionPrivateKeys),
        };
    }
    /**
     * Get the shared private view key
     */
    getPrivateViewKey() {
        return this.privateViewKey;
    }
    /**
     * Get the private spend key for the given public spend key, if it exists
     */
    getPrivateSpendKey(publicSpendKey) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            return [new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_IN_WALLET), ''];
        }
        return [WalletError_1.SUCCESS, subWallet.getPrivateSpendKey()];
    }
    /**
     * Gets the 'primary' subwallet
     */
    getPrimarySubWallet() {
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
    getPrimaryAddress() {
        return this.getPrimarySubWallet().getAddress();
    }
    /**
     * Gets the private spend key of the primary subwallet
     */
    getPrimaryPrivateSpendKey() {
        return this.getPrimarySubWallet().getPrivateSpendKey();
    }
    /**
     * Get the hashes of the locked transactions (ones we've sent but not
     * confirmed)
     */
    getLockedTransactionHashes() {
        return this.lockedTransactions.map((x) => x.hash);
    }
    /**
     * Add this transaction to the container. If the transaction was previously
     * sent by us, remove it from the locked container
     */
    addTransaction(transaction) {
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
    addUnconfirmedTransaction(transaction) {
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
    storeTransactionInput(publicSpendKey, input) {
        const subWallet = this.subWallets.get(publicSpendKey);
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
    markInputAsSpent(publicSpendKey, keyImage, spendHeight) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }
        subWallet.markInputAsSpent(keyImage, spendHeight);
    }
    markInputAsLocked(publicSpendKey, keyImage) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }
        subWallet.markInputAsLocked(keyImage);
    }
    /**
     * Remove a transaction that we sent by didn't get included in a block and
     * returned to us. Removes the correspoding inputs, too.
     */
    removeCancelledTransaction(transactionHash) {
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
    removeForkedTransactions(forkHeight) {
        _.remove(this.transactions, (tx) => {
            return tx.blockHeight >= forkHeight;
        });
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.removeForkedTransactions(forkHeight);
        }
    }
    /**
     * Convert a timestamp to a block height. Block heights are more dependable
     * than timestamps, which sometimes get treated a little funkily by the
     * daemon
     */
    convertSyncTimestampToHeight(timestamp, height) {
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
    getKeyImageOwner(keyImage) {
        if (this.isViewWallet) {
            return [false, ''];
        }
        const owner = this.keyImageOwners.get(keyImage);
        if (owner) {
            return [true, owner];
        }
        return [false, ''];
    }
    /**
     * Gets all public spend keys in this container
     */
    getPublicSpendKeys() {
        return this.publicSpendKeys;
    }
    /**
     * Get all [public, private] spend keys in a container
     */
    getAllSpendKeys() {
        const keys = [];
        for (const [publicKey, subWallet] of this.subWallets) {
            keys.push([publicKey, subWallet.getPrivateSpendKey()]);
        }
        return keys;
    }
    /**
     * Generate the key image for an input
     */
    getTxInputKeyImage(publicSpendKey, derivation, outputIndex) {
        const subWallet = this.subWallets.get(publicSpendKey);
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
    getBalance(currentHeight, subWalletsToTakeFrom) {
        let publicSpendKeys = [];
        /* If no subwallets given, take from all */
        if (!subWalletsToTakeFrom) {
            publicSpendKeys = this.publicSpendKeys;
        }
        else {
            publicSpendKeys = subWalletsToTakeFrom.map((address) => {
                const [publicViewKey, publicSpendKey] = Utilities_1.addressToKeys(address);
                return publicSpendKey;
            });
        }
        let unlockedBalance = 0;
        let lockedBalance = 0;
        for (const publicSpendKey of publicSpendKeys) {
            const subWallet = this.subWallets.get(publicSpendKey);
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
    getAddresses() {
        const addresses = [];
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
    getTransactionInputsForAmount(amount, subWalletsToTakeFrom, currentHeight) {
        let availableInputs = [];
        /* Loop through each subwallet that we can take from */
        for (const [publicViewKey, publicSpendKey] of subWalletsToTakeFrom.map(Utilities_1.addressToKeys)) {
            const subWallet = this.subWallets.get(publicSpendKey);
            if (!subWallet) {
                throw new Error('Subwallet not found!');
            }
            /* Fetch the spendable inputs */
            availableInputs = availableInputs.concat(subWallet.getSpendableInputs(currentHeight));
        }
        /* Shuffle the inputs */
        availableInputs = _.shuffle(availableInputs);
        let foundMoney = 0;
        const inputsToUse = [];
        for (const input of availableInputs) {
            inputsToUse.push(input);
            foundMoney += input.input.amount;
            if (foundMoney >= amount) {
                return [_.sortBy(inputsToUse, (x) => x.input.amount), foundMoney];
            }
        }
        throw new Error(`Failed to find enough money! Needed: ${amount}, found: ${foundMoney}`);
    }
    getFusionTransactionInputs(subWalletsToTakeFrom, mixin, currentHeight) {
        let availableInputs = [];
        /* Loop through each subwallet we can take from */
        for (const [publicViewKey, publicSpendKey] of subWalletsToTakeFrom.map(Utilities_1.addressToKeys)) {
            const subWallet = this.subWallets.get(publicSpendKey);
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
        const buckets = new Map();
        for (const walletAmount of availableInputs) {
            /* Find out how many digits the amount has, i.e. 1337 has 4 digits,
               420 has 3 digits */
            const numberOfDigits = Math.ceil(Math.log10(walletAmount.input.amount + 1));
            const tmp = buckets.get(numberOfDigits) || [];
            tmp.push(walletAmount);
            /* Insert the amount into the correct bucket */
            buckets.set(numberOfDigits, tmp);
        }
        let fullBuckets = [];
        for (const [amount, bucket] of buckets) {
            /* Skip the buckets with not enough items */
            if (bucket.length >= Constants_1.FUSION_TX_MIN_INPUT_COUNT) {
                fullBuckets.push(bucket);
            }
        }
        /* Shuffle the full buckets */
        fullBuckets = _.shuffle(fullBuckets);
        let bucketsToTakeFrom = [];
        /* We have full buckets, take the first full bucket */
        if (fullBuckets.length > 0) {
            bucketsToTakeFrom = [
                fullBuckets[0],
            ];
            /* Otherwise just use all buckets */
        }
        else {
            for (const [amount, bucket] of buckets) {
                bucketsToTakeFrom.push(bucket);
            }
        }
        const inputsToUse = [];
        /* See https://github.com/turtlecoin/turtlecoin/blob/153c08c3a046434522f7ac3ddd043037888b2bf5/src/CryptoNoteCore/Currency.cpp#L629 */
        /* With 3 mixin == 314 bytes. */
        const inputSize = 1 + (6 + 2) + 32 + 64 + 1 + 4 + mixin * (4 + 64);
        /* Probably about 100 inputs max. This ignores other size constraints,
           since it is a max, after all. */
        const maxInputsToTake = Constants_1.MAX_FUSION_TX_SIZE / inputSize;
        let foundMoney = 0;
        /* Loop through each bucket (Remember we're only looping through one if
           we've got a full bucket) */
        for (const bucket of bucketsToTakeFrom) {
            for (const walletAmount of bucket) {
                inputsToUse.push(walletAmount);
                foundMoney += walletAmount.input.amount;
                if (inputsToUse.length >= maxInputsToTake) {
                    return [inputsToUse, foundMoney];
                }
            }
        }
        return [inputsToUse, foundMoney];
    }
    /**
     * Store the private key for a given transaction
     */
    storeTxPrivateKey(txPrivateKey, txHash) {
        this.transactionPrivateKeys.set(txHash, txPrivateKey);
    }
    /**
     * Store an unconfirmed incoming amount, so we can correctly display locked
     * balances
     */
    storeUnconfirmedIncomingInput(input, publicSpendKey) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }
        subWallet.storeUnconfirmedIncomingInput(input);
    }
    /**
     * Get all transactions in a wallet container
     */
    getTransactions() {
        return this.transactions;
    }
    /**
     * Get the number of transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
     */
    getNumTransactions() {
        return this.transactions.length;
    }
    /**
     * Get all unconfirmed transactions in a wallet container
     */
    getUnconfirmedTransactions() {
        return this.lockedTransactions;
    }
    /**
     * Get the number of unconfirmed transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
     */
    getNumUnconfirmedTransactions() {
        return this.lockedTransactions.length;
    }
}
exports.SubWallets = SubWallets;
