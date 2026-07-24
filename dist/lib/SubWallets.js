"use strict";
// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubWallets = void 0;
const CnUtils_1 = require("./CnUtils");
const JsonSerialization_1 = require("./JsonSerialization");
const SubWallet_1 = require("./SubWallet");
const Config_1 = require("./Config");
const Logger_1 = require("./Logger");
const Types_1 = require("./Types");
const Constants_1 = require("./Constants");
const Utilities_1 = require("./Utilities");
const WalletError_1 = require("./WalletError");
const _ = require("lodash");
const kryptokrona_utils_1 = require("kryptokrona-utils");
/**
 * Stores each subwallet, along with transactions and public spend keys
 */
class SubWallets {
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
            knownTransactions: [],
        });
        newSubWallets.initKeyImageMap();
        return newSubWallets;
    }
    constructor(config, isViewWallet, privateViewKey, publicSpendKeys, subWallets) {
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
         * Transactions we have already checked
         */
        this.knownTransactions = [];
        /**
         * A mapping of transaction hashes, to transaction private keys
         */
        this.transactionPrivateKeys = new Map();
        /**
         * A mapping of key images to the subwallet public spend key that owns them
         */
        this.keyImageOwners = new Map();
        this.config = new Config_1.Config();
        this.config = config;
        this.isViewWallet = isViewWallet;
        this.privateViewKey = privateViewKey;
        this.publicSpendKeys = publicSpendKeys;
        this.subWallets = subWallets;
    }
    /**
     * @param config
     * @param address
     * @param scanHeight
     * @param newWallet
     * @param privateViewKey
     * @param privateSpendKey Private spend key is optional if it's a view wallet
     */
    static init(config, address, scanHeight, newWallet, privateViewKey, privateSpendKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let timestamp = 0;
            if (newWallet) {
                timestamp = (0, Utilities_1.getCurrentTimestampAdjusted)(config.blockTargetTime);
            }
            const decodedAddress = yield kryptokrona_utils_1.Address.fromAddress(address, config.addressPrefix);
            const publicSpendKeys = [];
            publicSpendKeys.push(decodedAddress.spend.publicKey);
            const subWallet = new SubWallet_1.SubWallet(config, address, scanHeight, timestamp, decodedAddress.spend.publicKey, privateSpendKey);
            const subWallets = new Map();
            subWallets.set(decodedAddress.spend.publicKey, subWallet);
            return new SubWallets(config, privateSpendKey === undefined, privateViewKey, publicSpendKeys, subWallets);
        });
    }
    initKeyImageMap() {
        for (const [publicKey, subWallet] of this.subWallets) {
            for (const keyImage of subWallet.getKeyImages()) {
                this.keyImageOwners.set(keyImage, publicKey);
            }
        }
    }
    pruneSpentInputs(pruneHeight) {
        for (const [, subWallet] of this.subWallets) {
            subWallet.pruneSpentInputs(pruneHeight);
        }
    }
    reset(scanHeight, scanTimestamp) {
        this.transactions = [];
        this.lockedTransactions = [];
        this.transactionPrivateKeys = new Map();
        this.keyImageOwners = new Map();
        this.knownTransactions = [];
        for (const [, subWallet] of this.subWallets) {
            subWallet.reset(scanHeight, scanTimestamp);
        }
    }
    rewind(scanHeight) {
        this.lockedTransactions = [];
        this.removeForkedTransactions(scanHeight);
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
            txPrivateKeys: (0, JsonSerialization_1.txPrivateKeysToVector)(this.transactionPrivateKeys),
            knownTransactions: [],
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
        for (const [, subWallet] of this.subWallets) {
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
        Logger_1.logger.log(`Transaction details: ${JSON.stringify(transaction)}`, Logger_1.LogLevel.TRACE, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
        /* Remove this transaction from the locked data structure, if we had
           added it previously as an outgoing tx */
        _.remove(this.lockedTransactions, (tx) => {
            return tx.hash === transaction.hash;
        });
        if (this.transactions.some((tx) => tx.hash === transaction.hash)) {
            Logger_1.logger.log(`Already seen transaction ${transaction.hash}, ignoring.`, Logger_1.LogLevel.DEBUG, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
            return;
        }
        this.transactions.push(transaction);
    }
    /**
     * Adds a transaction we sent to the locked transactions container
     */
    addUnconfirmedTransaction(transaction) {
        Logger_1.logger.log(`Unconfirmed transaction details: ${JSON.stringify(transaction)}`, Logger_1.LogLevel.TRACE, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
        if (this.lockedTransactions.some((tx) => tx.hash === transaction.hash)) {
            Logger_1.logger.log(`Already seen unconfirmed transaction ${transaction.hash}, ignoring.`, Logger_1.LogLevel.DEBUG, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
            return;
        }
        this.lockedTransactions.push(transaction);
    }
    /**
     * @param publicSpendKey    The public spend key of the subwallet to add this
     *                          input to
     * @param input
     *
     * Store the transaction input in the corresponding subwallet
     */
    storeTransactionInput(publicSpendKey, input) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }
        Logger_1.logger.log(`Input details: ${JSON.stringify(input)}`, Logger_1.LogLevel.TRACE, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
        if (!this.isViewWallet) {
            this.keyImageOwners.set(input.keyImage, publicSpendKey);
        }
        subWallet.storeTransactionInput(input, this.isViewWallet);
    }
    /**
     * @param publicSpendKey    The public spend key of the subwallet to mark
     *                          the corresponding input spent in
     * @param spendHeight       The height the input was spent at
     * @param keyImage
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
    markInputAsLocked(publicSpendKey, keyImage, transactionHash) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }
        subWallet.markInputAsLocked(keyImage, transactionHash);
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
        for (const [, subWallet] of this.subWallets) {
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
        let keyImagesToRemove = [];
        for (const [, subWallet] of this.subWallets) {
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
    convertSyncTimestampToHeight(timestamp, height) {
        for (const [, subWallet] of this.subWallets) {
            subWallet.convertSyncTimestampToHeight(timestamp, height);
        }
    }
    haveSpendableInput(input, height) {
        for (const [, subWallet] of this.subWallets) {
            if (subWallet.haveSpendableInput(input, height)) {
                return true;
            }
        }
        return false;
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
        return __awaiter(this, void 0, void 0, function* () {
            const subWallet = this.subWallets.get(publicSpendKey);
            if (!subWallet) {
                throw new Error('Subwallet not found!');
            }
            if (this.isViewWallet) {
                const nullKey = '0'.repeat(64);
                return Promise.resolve([nullKey, nullKey]);
            }
            return subWallet.getTxInputKeyImage(derivation, outputIndex);
        });
    }
    /**
     * Returns the summed balance of the given subwallet addresses. If none are given,
     * take from all.
     *
     * @return Returns [unlockedBalance, lockedBalance]
     */
    getBalance(currentHeight, subWalletsToTakeFrom) {
        return __awaiter(this, void 0, void 0, function* () {
            let publicSpendKeys = [];
            /* If no subwallets given, take from all */
            if (!subWalletsToTakeFrom) {
                publicSpendKeys = this.publicSpendKeys;
            }
            else {
                for (const address of subWalletsToTakeFrom) {
                    const [, publicSpendKey] = yield (0, Utilities_1.addressToKeys)(address, this.config);
                    publicSpendKeys.push(publicSpendKey);
                }
            }
            let unlockedBalance = 0;
            let lockedBalance = 0;
            /* For faster lookups in case we have a ton of transactions or
               subwallets to take from */
            const lookupMap = new Map(publicSpendKeys.map((x) => [x, true]));
            for (const transaction of this.transactions) {
                const unlocked = (0, Utilities_1.isInputUnlocked)(transaction.unlockTime, currentHeight);
                for (const [publicKey, amount] of transaction.transfers) {
                    if (lookupMap.has(publicKey)) {
                        if (unlocked) {
                            unlockedBalance += amount;
                        }
                        else {
                            lockedBalance += amount;
                        }
                    }
                }
            }
            for (const transaction of this.lockedTransactions) {
                for (const [publicKey, amount] of transaction.transfers) {
                    if (lookupMap.has(publicKey)) {
                        unlockedBalance += amount;
                    }
                }
            }
            let unconfirmedIncomingBalance = 0;
            let locked = 0;
            for (const publicSpendKey of publicSpendKeys) {
                const subWallet = this.subWallets.get(publicSpendKey);
                if (!subWallet) {
                    throw new Error('Subwallet not found!');
                }
                unconfirmedIncomingBalance += subWallet.getUnconfirmedChange();
                locked += subWallet.getLockedMessageBalance();
            }
            lockedBalance += unconfirmedIncomingBalance;
            unlockedBalance -= (unconfirmedIncomingBalance - locked);
            return [unlockedBalance, lockedBalance];
        });
    }
    /**
     * Gets all addresses contained in this SubWallets container
     */
    getAddresses() {
        const addresses = [];
        for (const [, subWallet] of this.subWallets) {
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
    getSpendableTransactionInputs(subWalletsToTakeFrom, currentHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            let availableInputs = [];
            /* Loop through each subwallet that we can take from */
            for (const address of subWalletsToTakeFrom) {
                const [, publicSpendKey] = yield (0, Utilities_1.addressToKeys)(address, this.config);
                const subWallet = this.subWallets.get(publicSpendKey);
                if (!subWallet) {
                    throw new Error('Subwallet not found!');
                }
                /* Fetch the spendable inputs */
                availableInputs = availableInputs.concat(subWallet.getSpendableInputs(currentHeight));
            }
            /* Sort by amount, largest first */
            availableInputs = _.orderBy(availableInputs, [(x) => x.input.amount], ['desc']);
            /* Push into base 10 buckets. Smallest amount buckets will come first, and
             * largest amounts within those buckets come first */
            let buckets = new Map();
            for (const input of availableInputs) {
                /* Find out how many digits the amount has, i.e. 1337 has 4 digits,
                   420 has 3 digits */
                const numberOfDigits = Math.floor(Math.log10(input.input.amount)) + 1;
                /* Grab existing array or make a new one */
                const tmpArr = buckets.get(numberOfDigits) || [];
                /* Add input to array */
                tmpArr.push(input);
                /* Update bucket with new array */
                buckets.set(numberOfDigits, tmpArr);
            }
            /* ES6 maps are sorted by insertion order, so we create a new map, sorting
             * the buckets we want first in the resulting map, first. */
            buckets = new Map([...buckets].sort((a, b) => {
                return a[0] > b[0] ? 1 : -1;
            }));
            const ordered = [];
            while (buckets.size > 0) {
                for (const [amount, bucket] of buckets) {
                    /* Bucket has been exhausted, remove from list */
                    if (bucket.length === 0) {
                        buckets.delete(amount);
                    }
                    else {
                        /* Add the final (smallest amount in this bucket) to the
                         * result, and remove it */
                        ordered.push(bucket.pop());
                    }
                }
            }
            return ordered;
        });
    }
    getFusionTransactionInputs(subWalletsToTakeFrom, mixin, currentHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            let availableInputs = [];
            /* Loop through each subwallet that we can take from */
            for (const address of subWalletsToTakeFrom) {
                const [, publicSpendKey] = yield (0, Utilities_1.addressToKeys)(address, this.config);
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
            for (const [, bucket] of buckets) {
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
                for (const [, bucket] of buckets) {
                    bucketsToTakeFrom.push(bucket);
                }
            }
            const inputsToUse = [];
            // tslint:disable-next-line: max-line-length
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
        });
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
     * Get the transactions of the given subWallet address. If no subWallet address is given,
     * gets all transactions.
     */
    getTransactions(address, includeFusions) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.filterTransactions(this.transactions, address, includeFusions);
        });
    }
    /**
     * Get the number of transactions for the given subWallet, if no subWallet is given,
     * gets the total number of transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
     */
    getNumTransactions(address, includeFusions = true) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.getTransactions(address, includeFusions)).length;
        });
    }
    /**
     * Get the unconfirmed transactions of the given subwallet address. If no subwallet address
     * is given, gets all unconfirmed transactions.
     */
    getUnconfirmedTransactions(address, includeFusions = true) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.filterTransactions(this.lockedTransactions, address, includeFusions);
        });
    }
    /**
     * Get the number of unconfirmed transactions for the given subWallet, if no subWallet is given,
     * gets the total number of unconfirmed transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
     */
    getNumUnconfirmedTransactions(address, includeFusions) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.getUnconfirmedTransactions(address, includeFusions)).length;
        });
    }
    initAfterLoad(config) {
        this.config = config;
        this.subWallets.forEach((subWallet) => subWallet.initAfterLoad(config));
    }
    addSubWallet(scanHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isViewWallet) {
                /* Adding a random subwallet to a view wallet makes no sense. */
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ILLEGAL_VIEW_WALLET_OPERATION)];
            }
            /* Make a random address to get a new pub/priv spend key pair */
            const address = yield kryptokrona_utils_1.Address.fromEntropy(undefined, undefined, this.config.addressPrefix);
            if (this.publicSpendKeys.includes(address.spend.publicKey)) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.SUBWALLET_ALREADY_EXISTS)];
            }
            this.publicSpendKeys.push(address.spend.publicKey);
            /**
             * Create the actual address using the shared private view key and the new
             * private spend key
             */
            const newAddress = yield (yield kryptokrona_utils_1.Address.fromKeys(address.spend.privateKey, this.privateViewKey, this.config.addressPrefix)).address();
            const subWallet = new SubWallet_1.SubWallet(this.config, newAddress, scanHeight, 0, address.spend.publicKey, address.spend.privateKey, false);
            this.subWallets.set(address.spend.publicKey, subWallet);
            return [newAddress, undefined];
        });
    }
    importSubWallet(privateSpendKey, scanHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isViewWallet) {
                /* Adding a random subwallet to a view wallet makes no sense. */
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ILLEGAL_VIEW_WALLET_OPERATION)];
            }
            const publicSpendKey = yield (0, CnUtils_1.CryptoUtils)(this.config).privateKeyToPublicKey(privateSpendKey);
            if (this.publicSpendKeys.includes(publicSpendKey)) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.SUBWALLET_ALREADY_EXISTS)];
            }
            const publicViewKey = yield (0, CnUtils_1.CryptoUtils)(this.config).privateKeyToPublicKey(this.privateViewKey);
            const address = yield (yield kryptokrona_utils_1.Address.fromPublicKeys(publicSpendKey, publicViewKey, undefined, this.config.addressPrefix)).address();
            this.publicSpendKeys.push(publicSpendKey);
            const subWallet = new SubWallet_1.SubWallet(this.config, address, scanHeight, 0, publicSpendKey, privateSpendKey, false);
            this.subWallets.set(publicSpendKey, subWallet);
            return [address, undefined];
        });
    }
    importViewSubWallet(publicSpendKey, scanHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isViewWallet) {
                /* Adding a random subwallet to a view wallet makes no sense. */
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ILLEGAL_NON_VIEW_WALLET_OPERATION)];
            }
            if (this.publicSpendKeys.includes(publicSpendKey)) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.SUBWALLET_ALREADY_EXISTS)];
            }
            const publicViewKey = yield (0, CnUtils_1.CryptoUtils)(this.config).privateKeyToPublicKey(this.privateViewKey);
            const address = yield (yield kryptokrona_utils_1.Address.fromPublicKeys(publicSpendKey, publicViewKey, undefined, this.config.addressPrefix)).address();
            this.publicSpendKeys.push(publicSpendKey);
            const subWallet = new SubWallet_1.SubWallet(this.config, address, scanHeight, 0, publicSpendKey, undefined, false);
            this.subWallets.set(publicSpendKey, subWallet);
            return [address, undefined];
        });
    }
    deleteSubWallet(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const [, publicSpendKey] = yield (0, Utilities_1.addressToKeys)(address, this.config);
            const subWallet = this.subWallets.get(publicSpendKey);
            if (!subWallet) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_IN_WALLET);
            }
            if (subWallet.isPrimaryAddress()) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.CANNOT_DELETE_PRIMARY_ADDRESS);
            }
            this.subWallets.delete(publicSpendKey);
            this.deleteAddressTransactions(this.transactions, publicSpendKey);
            this.deleteAddressTransactions(this.lockedTransactions, publicSpendKey);
            this.publicSpendKeys = this.publicSpendKeys.filter(elem => elem != publicSpendKey);
            return WalletError_1.SUCCESS;
        });
    }
    getWalletCount() {
        return this.subWallets.size;
    }
    deleteAddressTransactions(txs, publicSpendKey) {
        _.remove(txs, (tx) => {
            /* See if this transaction contains the subwallet we're deleting */
            if (tx.transfers.has(publicSpendKey)) {
                /* If it's the only element, delete the transaction */
                if (tx.transfers.size === 1) {
                    return true;
                    /* Otherwise just delete the transfer in the transaction */
                }
                else {
                    tx.transfers.delete(publicSpendKey);
                }
            }
            return false;
        });
    }
    filterTransactions(txs, address, includeFusions = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const filters = [];
            if (address) {
                const [, publicSpendKey] = yield (0, Utilities_1.addressToKeys)(address, this.config);
                filters.push((tx) => tx.transfers.has(publicSpendKey));
            }
            if (!includeFusions) {
                filters.push((tx) => !tx.isFusionTransaction());
            }
            return txs.filter((tx) => filters.every((f) => f(tx)));
        });
    }
}
exports.SubWallets = SubWallets;
