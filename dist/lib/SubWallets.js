"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const CnUtils_1 = require("./CnUtils");
const JsonSerialization_1 = require("./JsonSerialization");
const SubWallet_1 = require("./SubWallet");
const Types_1 = require("./Types");
const Utilities_1 = require("./Utilities");
const WalletError_1 = require("./WalletError");
const _ = require("lodash");
class SubWallets {
    /* Private spend key is optional if it's a view wallet */
    constructor(address, scanHeight, newWallet, privateViewKey, privateSpendKey) {
        /* The public spend keys this wallet contains. Used for verifying if a
           transaction is ours. */
        this.publicSpendKeys = [];
        /* Mapping of public spend key to subwallet */
        this.subWallets = new Map();
        /* Our transactions */
        this.transactions = [];
        this.lockedTransactions = [];
        /* A mapping of transaction hashes, to transaction private keys */
        this.transactionPrivateKeys = new Map();
        this.isViewWallet = privateSpendKey === undefined;
        this.privateViewKey = privateViewKey;
        let timestamp = 0;
        if (newWallet) {
            timestamp = Utilities_1.getCurrentTimestampAdjusted();
        }
        const publicKeys = CnUtils_1.CryptoUtils.decodeAddress(address);
        this.publicSpendKeys.push(publicKeys.publicSpendKey);
        const subWallet = new SubWallet_1.SubWallet(address, scanHeight, timestamp, publicKeys.publicSpendKey, privateSpendKey);
        this.subWallets.set(publicKeys.publicSpendKey, subWallet);
    }
    static fromJSON(json) {
        const subWallets = Object.create(SubWallets.prototype);
        return Object.assign(subWallets, json, {
            publicSpendKeys: json.publicSpendKeys,
            subWallets: new Map(json.subWallet.map((x) => [x.publicSpendKey, SubWallet_1.SubWallet.fromJSON(x)])),
            transactions: json.transactions.map((x) => Types_1.Transaction.fromJSON(x)),
            lockedTransactions: json.lockedTransactions.map((x) => Types_1.Transaction.fromJSON(x)),
            privateViewKey: json.privateViewKey,
            isViewWallet: json.isViewWallet,
            transactionPrivateKeys: new Map(json.txPrivateKeys.map((x) => [x.transactionHash, x.txPrivateKey])),
        });
    }
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
    getPrivateViewKey() {
        return this.privateViewKey;
    }
    getPrivateSpendKey(publicSpendKey) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            return [new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_IN_WALLET), ''];
        }
        return [WalletError_1.SUCCESS, subWallet.getPrivateSpendKey()];
    }
    /* Gets the 'primary' subwallet */
    getPrimarySubWallet() {
        for (const [publicKey, subWallet] of this.subWallets) {
            if (subWallet.isPrimaryAddress()) {
                return subWallet;
            }
        }
        throw new Error('Wallet has no primary address!');
    }
    getPrimaryAddress() {
        return this.getPrimarySubWallet().getAddress();
    }
    getPrimaryPrivateSpendKey() {
        return this.getPrimarySubWallet().getPrivateSpendKey();
    }
    getLockedTransactionHashes() {
        return this.lockedTransactions.map((x) => x.hash);
    }
    addTransaction(transaction) {
        /* Remove this transaction from the locked data structure, if we had
           added it previously as an outgoing tx */
        _.remove(this.lockedTransactions, (tx) => {
            return tx.hash === transaction.hash;
        });
        if (this.transactions.some((tx) => tx.hash === transaction.hash)) {
            throw new Error('Transaction ' + transaction.hash + ' was added to the wallet twice!');
        }
        this.transactions.push(transaction);
    }
    storeTransactionInput(publicSpendKey, input) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }
        subWallet.storeTransactionInput(input, this.isViewWallet);
    }
    markInputAsSpent(publicSpendKey, keyImage, spendHeight) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }
        subWallet.markInputAsSpent(keyImage, spendHeight);
    }
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
    removeForkedTransactions(forkHeight) {
        _.remove(this.transactions, (tx) => {
            return tx.blockHeight >= forkHeight;
        });
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.removeForkedTransactions(forkHeight);
        }
    }
    convertSyncTimestampToHeight(timestamp, height) {
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.convertSyncTimestampToHeight(timestamp, height);
        }
    }
    getKeyImageOwner(keyImage) {
        if (this.isViewWallet) {
            return [false, ''];
        }
        for (const [publicKey, subWallet] of this.subWallets) {
            if (subWallet.hasKeyImage(keyImage)) {
                return [true, publicKey];
            }
        }
        return [false, ''];
    }
    getPublicSpendKeys() {
        return this.publicSpendKeys;
    }
    getTxInputKeyImage(publicSpendKey, derivation, outputIndex) {
        const subWallet = this.subWallets.get(publicSpendKey);
        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }
        if (this.isViewWallet) {
            return '0'.repeat(64);
        }
        return subWallet.getTxInputKeyImage(derivation, outputIndex);
    }
    getBalance(subWalletsToTakeFrom, takeFromAll, currentHeight) {
        /* If we're able to take from every subwallet, set the wallets to take from
           to all our public spend keys */
        if (takeFromAll) {
            subWalletsToTakeFrom = this.publicSpendKeys;
        }
        let unlockedBalance = 0;
        let lockedBalance = 0;
        for (const publicSpendKey of subWalletsToTakeFrom) {
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
}
exports.SubWallets = SubWallets;
