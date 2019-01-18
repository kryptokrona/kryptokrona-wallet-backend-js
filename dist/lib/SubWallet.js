"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const CnUtils_1 = require("./CnUtils");
const Types_1 = require("./Types");
const Utilities_1 = require("./Utilities");
const _ = require("lodash");
class SubWallet {
    constructor(address, scanHeight, timestamp, publicSpendKey, privateSpendKey) {
        /* A vector of the stored transaction input data, to be used for
           sending transactions later */
        this.unspentInputs = [];
        /* Inputs which have been used in a transaction, and are waiting to
           either be put into a block, or return to our wallet */
        this.lockedInputs = [];
        /* Inputs which have been spent in a transaction */
        this.spentInputs = [];
        /* Inputs which have come in from a transaction we sent - either from
           change or from sending to ourself - we use this to display unlocked
           balance correctly */
        this.unconfirmedIncomingAmounts = [];
        /* The timestamp to begin syncing the wallet at
           (usually creation time or zero) */
        this.syncStartTimestamp = 0;
        /* The height to begin syncing the wallet at */
        this.syncStartHeight = 0;
        this.address = address;
        this.syncStartHeight = scanHeight;
        this.syncStartTimestamp = timestamp;
        this.publicSpendKey = publicSpendKey;
        this.privateSpendKey = privateSpendKey;
        this.primaryAddress = true;
    }
    static fromJSON(json) {
        const subWallet = Object.create(SubWallet.prototype);
        return Object.assign(subWallet, json, {
            unspentInputs: json.unspentInputs.map((x) => Types_1.TransactionInput.fromJSON(x)),
            lockedInputs: json.lockedInputs.map((x) => Types_1.TransactionInput.fromJSON(x)),
            spentInputs: json.spentInputs.map((x) => Types_1.TransactionInput.fromJSON(x)),
            unconfirmedIncomingAmounts: json.unconfirmedIncomingAmounts.map((x) => Types_1.UnconfirmedInput.fromJSON(x)),
            publicSpendKey: json.publicSpendKey,
            privateSpendKey: json.privateSpendKey === '0'.repeat(64) ? undefined : json.privateSpendKey,
            syncStartTimestamp: json.syncStartTimestamp,
            syncStartHeight: json.syncStartHeight,
            address: json.address,
            primaryAddress: json.isPrimaryAddress,
        });
    }
    toJSON() {
        return {
            unspentInputs: this.unspentInputs.map((x) => x.toJSON()),
            lockedInputs: this.lockedInputs.map((x) => x.toJSON()),
            spentInputs: this.spentInputs.map((x) => x.toJSON()),
            unconfirmedIncomingAmounts: this.unconfirmedIncomingAmounts.map((x) => x.toJSON()),
            publicSpendKey: this.publicSpendKey,
            /* Null secret key if view wallet */
            privateSpendKey: this.privateSpendKey ? this.privateSpendKey : '0'.repeat(64),
            syncStartTimestamp: this.syncStartTimestamp,
            syncStartHeight: this.syncStartHeight,
            address: this.address,
            isPrimaryAddress: this.primaryAddress,
        };
    }
    getPrivateSpendKey() {
        return this.privateSpendKey || '0'.repeat(64);
    }
    isPrimaryAddress() {
        return this.primaryAddress;
    }
    getAddress() {
        return this.address;
    }
    storeTransactionInput(input, isViewWallet) {
        if (!isViewWallet) {
            /* Find the input in the unconfirmed incoming amounts - inputs we
               sent ourselves, that are now returning as change. Remove from
               vector if found. */
            _.remove(this.unconfirmedIncomingAmounts, (storedInput) => {
                return storedInput.key !== input.key;
            });
        }
        this.unspentInputs.push(input);
    }
    markInputAsSpent(keyImage, spendHeight) {
        /* Remove from unspent if exists */
        let [removedInput] = _.remove(this.unspentInputs, (input) => {
            return input.keyImage === keyImage;
        });
        if (!removedInput) {
            /* Not in unspent, check locked */
            [removedInput] = _.remove(this.lockedInputs, (input) => {
                return input.keyImage === keyImage;
            });
        }
        if (!removedInput) {
            throw new Error('Could not find key image to remove!');
        }
        removedInput.spendHeight = spendHeight;
        this.spentInputs.push(removedInput);
    }
    removeCancelledTransaction(transactionHash) {
        /* Find inputs used in the cancelled transaction, and remove them from
           the locked inputs */
        const removed = _.remove(this.lockedInputs, (input) => {
            return input.parentTransactionHash === transactionHash;
        });
        /* Add them to the unspent vector */
        this.unspentInputs = this.unspentInputs.concat(
        /* Mark them as no longer spent */
        removed.map((input) => {
            input.spendHeight = 0;
            return input;
        }));
        /* Remove unconfirmed amounts we used to correctly calculate incoming
           change */
        _.remove(this.unconfirmedIncomingAmounts, (input) => {
            return input.parentTransactionHash === transactionHash;
        });
    }
    removeForkedTransactions(forkHeight) {
        this.lockedInputs = [];
        this.unconfirmedIncomingAmounts = [];
        _.remove(this.unspentInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });
        /* unspent, formerly spent */
        const unspent = _.remove(this.spentInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });
        unspent.map((input) => input.spendHeight = 0);
        /* Add to unspent vector */
        this.unspentInputs.concat(
        /* Mark as no longer spent */
        unspent.map((input) => {
            input.spendHeight = 0;
            return input;
        }));
    }
    convertSyncTimestampToHeight(startTimestamp, startHeight) {
        /* If we don't have a start timestamp then we don't need to convert */
        if (this.syncStartTimestamp !== 0) {
            this.syncStartTimestamp = startTimestamp;
            this.syncStartHeight = startHeight;
        }
    }
    hasKeyImage(keyImage) {
        if (this.unspentInputs.some((input) => input.keyImage === keyImage)) {
            return true;
        }
        if (this.lockedInputs.some((input) => input.keyImage === keyImage)) {
            return true;
        }
        return false;
    }
    getTxInputKeyImage(derivation, outputIndex) {
        const [keyImage, privateEphemeral] = CnUtils_1.CryptoUtils.generateKeyImagePrimitive(this.publicSpendKey, this.privateSpendKey, outputIndex, derivation);
        return keyImage;
    }
    getBalance(currentHeight) {
        let unlockedBalance = 0;
        let lockedBalance = 0;
        for (const input of this.unspentInputs) {
            if (Utilities_1.isInputUnlocked(input.unlockTime, currentHeight)) {
                unlockedBalance += input.amount;
            }
            else {
                lockedBalance += input.amount;
            }
        }
        lockedBalance += _.sumBy(this.unconfirmedIncomingAmounts, 'amount');
        return [unlockedBalance, lockedBalance];
    }
    getSpendableInputs(currentHeight) {
        const inputs = [];
        for (const input of this.unspentInputs) {
            if (Utilities_1.isInputUnlocked(input.unlockTime, currentHeight)) {
                inputs.push(new Types_1.TxInputAndOwner(input, this.privateSpendKey, this.publicSpendKey));
            }
        }
        return inputs;
    }
}
exports.SubWallet = SubWallet;
