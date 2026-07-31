"use strict";
// Copyright (c) 2018-2023, Zpalmtree
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
exports.SubWallet = void 0;
const Logger_1 = require("./Logger");
const Types_1 = require("./Types");
const Utilities_1 = require("./Utilities");
const CryptoWrapper_1 = require("./CryptoWrapper");
const Config_1 = require("./Config");
const _ = require("lodash");
class SubWallet {
    static fromJSON(json) {
        const subWallet = Object.create(SubWallet.prototype);
        return Object.assign(subWallet, {
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
    constructor(config, address, scanHeight, timestamp, publicSpendKey, privateSpendKey, primaryAddress = true) {
        /**
         * A vector of the stored transaction input data, to be used for
         * sending transactions later
         */
        this.unspentInputs = [];
        /**
         * Inputs which have been used in a transaction, and are waiting to
         * either be put into a block, or return to our wallet
         */
        this.lockedInputs = [];
        /**
         * Inputs which have been spent in a transaction
         */
        this.spentInputs = [];
        /**
         * Inputs which have come in from a transaction we sent - either from
         * change or from sending to ourself - we use this to display unlocked
         * balance correctly
         */
        this.unconfirmedIncomingAmounts = [];
        /**
         * The timestamp to begin syncing the wallet at
         * (usually creation time or zero)
         */
        this.syncStartTimestamp = 0;
        /**
         * The height to begin syncing the wallet at
         */
        this.syncStartHeight = 0;
        this.config = new Config_1.Config();
        this.address = address;
        this.syncStartHeight = scanHeight;
        this.syncStartTimestamp = timestamp;
        this.publicSpendKey = publicSpendKey;
        this.privateSpendKey = privateSpendKey;
        this.primaryAddress = primaryAddress;
        this.config = config;
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
    pruneSpentInputs(pruneHeight) {
        const lenBeforePrune = this.spentInputs.length;
        /* Remove all spent inputs that are older than 5000 blocks old.
           It is assumed the blockchain cannot fork more than this, and this
           frees up a lot of disk space with large, old wallets. */
        _.remove(this.spentInputs, (input) => input.spendHeight > pruneHeight);
        const lenAfterPrune = this.spentInputs.length;
        const difference = lenBeforePrune - lenAfterPrune;
        if (difference !== 0) {
            Logger_1.logger.log('Pruned ' + difference + ' spent inputs', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
        }
    }
    reset(scanHeight, scanTimestamp) {
        this.syncStartHeight = scanHeight;
        this.syncStartTimestamp = scanTimestamp;
        this.spentInputs = [];
        this.lockedInputs = [];
        this.unconfirmedIncomingAmounts = [];
        this.unspentInputs = [];
    }
    /**
     * Get the private spend key, or null key if view wallet
     */
    getPrivateSpendKey() {
        return this.privateSpendKey || '0'.repeat(64);
    }
    /**
     * Whether this address is the primary wallet address
     */
    isPrimaryAddress() {
        return this.primaryAddress;
    }
    /**
     * Get this wallets address
     */
    getAddress() {
        return this.address;
    }
    /**
     * Store an unspent input
     */
    storeTransactionInput(input, isViewWallet) {
        if (!isViewWallet) {
            /* Find the input in the unconfirmed incoming amounts - inputs we
               sent ourselves, that are now returning as change. Remove from
               vector if found. */
            _.remove(this.unconfirmedIncomingAmounts, (storedInput) => {
                return storedInput.key === input.key;
            });
        }
        const existingInput = this.unspentInputs.find((x) => x.key === input.key);
        if (existingInput !== undefined) {
            Logger_1.logger.log(`Input ${input.key} was added to the wallet twice!`, Logger_1.LogLevel.ERROR, Logger_1.LogCategory.SYNC);
            return;
        }
        this.unspentInputs.push(input);
    }
    /**
     * Move input from unspent/locked to spend container
     */
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
            Logger_1.logger.log('Could not find key image to remove!', Logger_1.LogLevel.ERROR, Logger_1.LogCategory.SYNC);
            return;
        }
        removedInput.spendHeight = spendHeight;
        this.spentInputs.push(removedInput);
    }
    /**
     * Move an input from the unspent container to the locked container
     */
    markInputAsLocked(keyImage, transactionHash) {
        /* Remove input from unspent */
        const [removedInput] = _.remove(this.unspentInputs, (input) => {
            return input.keyImage === keyImage;
        });
        if (this.lockedInputs.some(a => a.keyImage === keyImage)) {
            Logger_1.logger.log(`This input is already locked! ${JSON.stringify(keyImage)}`, Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
            return;
        }
        if (!removedInput)
            return;
        removedInput.parentTransactionHash = transactionHash;
        if (!removedInput) {
            Logger_1.logger.log('Could not find key image to lock!', Logger_1.LogLevel.ERROR, Logger_1.LogCategory.SYNC);
            return;
        }
        /* Add to locked */
        this.lockedInputs.push(removedInput);
    }
    /**
     * Remove inputs belonging to a cancelled transaction and mark them as
     * unspent
     */
    removeCancelledTransaction(transactionHash) {
        /* Find inputs used in the cancelled transaction, and remove them from
           the locked inputs */
        const removed = _.remove(this.lockedInputs, (input) => {
            return input.parentTransactionHash === transactionHash;
        }).map((input) => {
            input.spendHeight = 0;
            return input;
        });
        /* Add them to the unspent vector */
        this.unspentInputs = this.unspentInputs.concat(removed);
        /* Remove unconfirmed amounts we used to correctly calculate incoming
           change */
        _.remove(this.unconfirmedIncomingAmounts, (input) => {
            return input.parentTransactionHash === transactionHash;
        });
    }
    /**
     * Remove transactions and inputs that occured after a fork height
     */
    removeForkedTransactions(forkHeight) {
        /* This will get resolved by the wallet in time */
        this.unconfirmedIncomingAmounts = [];
        const removedLocked = _.remove(this.lockedInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });
        /* Remove unspent inputs which arrived after this height */
        const removedUnspent = _.remove(this.unspentInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });
        /* Remove spent inputs which arrived after this height */
        const removedSpent = _.remove(this.spentInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });
        /* This input arrived before the fork height, but was spent after the
           fork height. So, we move them back into the unspent inputs vector. */
        const nowUnspent = _.remove(this.spentInputs, (input) => {
            return input.spendHeight >= forkHeight;
        });
        this.unspentInputs = this.unspentInputs.concat(nowUnspent.map((input) => { input.spendHeight = 0; return input; }));
        /* Could do this with concat+map.. but i think this is a little more
           readable */
        const keyImagesToRemove = [];
        for (const input of removedLocked) {
            keyImagesToRemove.push(input.keyImage);
        }
        for (const input of removedUnspent) {
            keyImagesToRemove.push(input.keyImage);
        }
        for (const input of removedSpent) {
            keyImagesToRemove.push(input.keyImage);
        }
        return keyImagesToRemove;
    }
    /**
     * Convert a timestamp to a height
     */
    convertSyncTimestampToHeight(startTimestamp, startHeight) {
        /* If we don't have a start timestamp then we don't need to convert */
        if (this.syncStartTimestamp !== 0) {
            this.syncStartTimestamp = startTimestamp;
            this.syncStartHeight = startHeight;
        }
    }
    /**
     * Gets every stored key image
     */
    getKeyImages() {
        let keyImages = [];
        keyImages = keyImages.concat(this.unspentInputs.map((x) => x.keyImage));
        keyImages = keyImages.concat(this.lockedInputs.map((x) => x.keyImage));
        keyImages = keyImages.concat(this.spentInputs.map((x) => x.keyImage));
        return keyImages;
    }
    /**
     * Generate the key image for this input
     */
    getTxInputKeyImage(derivation, outputIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, CryptoWrapper_1.generateKeyImagePrimitive)(this.publicSpendKey, this.privateSpendKey, outputIndex, derivation, this.config);
        });
    }
    /**
     * Get the unlocked/locked balance at a given height
     */
    getBalance(currentHeight) {
        let unlockedBalance = 0;
        let lockedBalance = 0;
        for (const input of this.unspentInputs) {
            if ((0, Utilities_1.isInputUnlocked)(input.unlockTime, currentHeight)) {
                unlockedBalance += input.amount;
            }
            else {
                lockedBalance += input.amount;
            }
        }
        const locked = this.getLockedMessageBalance();
        unlockedBalance += locked;
        lockedBalance += _.sumBy(this.unconfirmedIncomingAmounts, 'amount');
        if (unlockedBalance < 0)
            unlockedBalance = 0;
        return [unlockedBalance, lockedBalance];
    }
    /**
    * Gets the amount of incoming and outgoing funds locked in the mempool, uses this to subtract from locked amount
    * so we do not get a negative number when displaying available balance.
    */
    getLockedMessageBalance() {
        Logger_1.logger.log(`Unconfirmed inc amounts, getLocked ${JSON.stringify(this.unconfirmedIncomingAmounts)}`, Logger_1.LogLevel.DEBUG, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
        const unconfirmed = this.unconfirmedIncomingAmounts.filter(a => a.locked === true);
        return _.sumBy(unconfirmed, 'amount');
    }
    /**
     * Gets the amount of funds returning to us as change from outgoing
     * unconfirmed transactions
     */
    getUnconfirmedChange() {
        return _.sumBy(this.unconfirmedIncomingAmounts, 'amount');
    }
    haveSpendableInput(input, currentHeight) {
        for (const i of this.unspentInputs) {
            if (input.key === i.key) {
                return (0, Utilities_1.isInputUnlocked)(i.unlockTime, currentHeight);
            }
        }
        return false;
    }
    /**
     * Get inputs that are available to be spent, and their keys
     */
    getSpendableInputs(currentHeight) {
        const inputs = [];
        for (const input of this.unspentInputs) {
            if ((0, Utilities_1.isInputUnlocked)(input.unlockTime, currentHeight)) {
                inputs.push(new Types_1.TxInputAndOwner(input, this.privateSpendKey, this.publicSpendKey));
            }
        }
        return inputs;
    }
    storeUnconfirmedIncomingInput(input) {
        if (this.unconfirmedIncomingAmounts.some(a => a.key === input.key)) {
            Logger_1.logger.log(`Already know this unconfirmed input`, Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
            return;
        }
        this.unconfirmedIncomingAmounts.push(input);
    }
    initAfterLoad(config) {
        this.config = config;
    }
}
exports.SubWallet = SubWallet;
