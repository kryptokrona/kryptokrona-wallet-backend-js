"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const deepEqual = require("deep-equal");
const events_1 = require("events");
const _ = require("lodash");
const Config_1 = require("./Config");
const CnUtils_1 = require("./CnUtils");
const Constants_1 = require("./Constants");
const Logger_1 = require("./Logger");
const Metronome_1 = require("./Metronome");
const OpenWallet_1 = require("./OpenWallet");
const SubWallets_1 = require("./SubWallets");
const Types_1 = require("./Types");
const Utilities_1 = require("./Utilities");
const ValidateParameters_1 = require("./ValidateParameters");
const WalletError_1 = require("./WalletError");
const WalletSynchronizer_1 = require("./WalletSynchronizer");
/**
 * Documentation for the WalletBackend class.
 * @noInheritDoc
 */
class WalletBackend extends events_1.EventEmitter {
    constructor(daemon, address, scanHeight, newWallet, privateViewKey, privateSpendKey) {
        super();
        /* Whether our wallet is synced */
        this.synced = false;
        this.blocksToProcess = [];
        this.subWallets = new SubWallets_1.SubWallets(address, scanHeight, newWallet, privateViewKey, privateSpendKey);
        let timestamp = 0;
        if (newWallet) {
            timestamp = Utilities_1.getCurrentTimestampAdjusted();
        }
        this.walletSynchronizer = new WalletSynchronizer_1.WalletSynchronizer(daemon, this.subWallets, timestamp, scanHeight, privateViewKey);
        this.daemon = daemon;
        this.mainLoopExecutor = new Metronome_1.Metronome(this.mainLoop.bind(this), Config_1.default.mainLoopInterval);
    }
    /* Opens a wallet given a filepath and a password */
    static openWalletFromFile(daemon, filename, password) {
        const walletJSON = OpenWallet_1.openWallet(filename, password);
        if (walletJSON instanceof WalletError_1.WalletError) {
            return walletJSON;
        }
        return WalletBackend.loadWalletFromJSON(daemon, walletJSON);
    }
    /* Opens a wallet from a valid wallet JSON string (unencrypted) */
    static loadWalletFromJSON(daemon, json) {
        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.initAfterLoad(daemon);
            return wallet;
        }
        catch (err) {
            console.log(err);
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WALLET_FILE_CORRUPTED);
        }
    }
    /* Imports a wallet from a mnemonic seed */
    static importWalletFromSeed(daemon, scanHeight, mnemonicSeed) {
        let keys;
        try {
            keys = CnUtils_1.CryptoUtils.createAddressFromMnemonic(mnemonicSeed);
        }
        catch (err) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_MNEMONIC, err.toString());
        }
        if (scanHeight < 0) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }
        /* Can't sync from the current scan height, not newly created */
        const newWallet = false;
        const wallet = new WalletBackend(daemon, keys.address, scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
        return wallet;
    }
    /* Imports a wallet from a spend and view key */
    static importWalletFromKeys(daemon, scanHeight, privateViewKey, privateSpendKey) {
        if (!Utilities_1.isHex64(privateViewKey) || !Utilities_1.isHex64(privateSpendKey)) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT);
        }
        let keys;
        try {
            keys = CnUtils_1.CryptoUtils.createAddressFromKeys(privateSpendKey, privateViewKey);
        }
        catch (err) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT, err.toString());
        }
        if (scanHeight < 0) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }
        /* Can't sync from the current scan height, not newly created */
        const newWallet = false;
        const wallet = new WalletBackend(daemon, keys.address, scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
        return wallet;
    }
    /* Imports a view only wallet */
    static importViewWallet(daemon, scanHeight, privateViewKey, address) {
        if (!Utilities_1.isHex64(privateViewKey)) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT);
        }
        const integratedAddressesAllowed = false;
        const err = ValidateParameters_1.validateAddresses(new Array(address), integratedAddressesAllowed);
        if (!deepEqual(err, WalletError_1.SUCCESS)) {
            return err;
        }
        if (scanHeight < 0) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }
        /* Can't sync from the current scan height, not newly created */
        const newWallet = false;
        const wallet = new WalletBackend(daemon, address, scanHeight, newWallet, privateViewKey, undefined);
        return wallet;
    }
    /* Creates a wallet with a random key pair (it will be a determinstic/
       mnemonic wallet, however */
    static createWallet(daemon) {
        const newWallet = true;
        const scanHeight = 0;
        const keys = CnUtils_1.CryptoUtils.createNewAddress();
        const wallet = new WalletBackend(daemon, keys.address, scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
        return wallet;
    }
    /* Utility function for nicer JSON parsing function */
    static reviver(key, value) {
        return key === '' ? WalletBackend.fromJSON(value) : value;
    }
    /* Loads a wallet from a WalletBackendJSON */
    static fromJSON(json) {
        const wallet = Object.create(WalletBackend.prototype);
        const version = json.walletFileFormatVersion;
        if (version !== Constants_1.WALLET_FILE_FORMAT_VERSION) {
            throw new Error('Unsupported wallet file format version!');
        }
        return Object.assign(wallet, json, {
            subWallets: SubWallets_1.SubWallets.fromJSON(json.subWallets),
            walletSynchronizer: WalletSynchronizer_1.WalletSynchronizer.fromJSON(json.walletSynchronizer),
        });
    }
    setLogLevel(logLevel) {
        Logger_1.logger.setLogLevel(logLevel);
    }
    setLoggerCallback(callback) {
        Logger_1.logger.setLoggerCallback(callback);
    }
    /* Fetch initial daemon info and fee. Should we do this in the constructor
       instead...? Well... not much point wasting time if they just want to
       make a wallet */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.daemon.init();
        });
    }
    /* Starts the main loop */
    start() {
        this.mainLoopExecutor.start();
    }
    /* Stops the main loop */
    stop() {
        this.mainLoopExecutor.stop();
    }
    mainLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            /* No blocks. Get some more from the daemon. */
            if (_.isEmpty(this.blocksToProcess)) {
                yield this.fetchAndStoreBlocks();
                return;
            }
            try {
                yield this.processBlocks();
            }
            catch (err) {
                Logger_1.logger.log('Error processing blocks: ' + err.toString(), Logger_1.LogLevel.DEBUG, [Logger_1.LogCategory.SYNC]);
            }
        });
    }
    /* Converts recursively from typescript to JSON data. Can be dumped to file */
    toJSON() {
        return {
            subWallets: this.subWallets.toJSON(),
            walletFileFormatVersion: Constants_1.WALLET_FILE_FORMAT_VERSION,
            walletSynchronizer: this.walletSynchronizer.toJSON(),
        };
    }
    /* Initialize stuff not stored in the JSON */
    initAfterLoad(daemon) {
        this.daemon = daemon;
        this.walletSynchronizer.initAfterLoad(this.subWallets, daemon);
    }
    getNodeFee() {
        return this.daemon.nodeFee();
    }
    /* Gets the shared private view key */
    getPrivateViewKey() {
        return this.subWallets.getPrivateViewKey();
    }
    /* Gets the [publicSpendKey, privateSpendKey] for the given address, if
       possible. Note: secret key will be 00000... if view wallet */
    getSpendKeys(address) {
        const integratedAddressesAllowed = false;
        const err = ValidateParameters_1.validateAddresses(new Array(address), integratedAddressesAllowed);
        if (!deepEqual(err, WalletError_1.SUCCESS)) {
            return err;
        }
        const [publicViewKey, publicSpendKey] = Utilities_1.addressToKeys(address);
        const [err2, privateSpendKey] = this.subWallets.getPrivateSpendKey(publicSpendKey);
        if (!deepEqual(err2, WalletError_1.SUCCESS)) {
            return err2;
        }
        return [publicSpendKey, privateSpendKey];
    }
    /* Get the private spend and private view for the primary address */
    getPrimaryAddressPrivateKeys() {
        return [this.subWallets.getPrimaryPrivateSpendKey(), this.getPrivateViewKey()];
    }
    /* Get the primary address mnemonic seed, if possible */
    getMnemonicSeed() {
        return this.getMnemonicSeedForAddress(this.subWallets.getPrimaryAddress());
    }
    getMnemonicSeedForAddress(address) {
        const privateViewKey = this.getPrivateViewKey();
        const spendKeys = this.getSpendKeys(address);
        if (spendKeys instanceof WalletError_1.WalletError) {
            return spendKeys;
        }
        const parsedAddr = CnUtils_1.CryptoUtils.createAddressFromKeys(spendKeys[1], privateViewKey);
        if (!parsedAddr.mnemonic) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.KEYS_NOT_DETERMINISTIC);
        }
        return parsedAddr.mnemonic;
    }
    getPrimaryAddress() {
        return this.subWallets.getPrimaryAddress();
    }
    fetchAndStoreBlocks() {
        return __awaiter(this, void 0, void 0, function* () {
            const daemonInfo = this.daemon.getDaemonInfo();
            this.blocksToProcess = yield this.walletSynchronizer.getBlocks();
            const walletHeight = this.walletSynchronizer.getHeight();
            const networkHeight = this.daemon.getNetworkBlockCount();
            if (walletHeight >= networkHeight) {
                /* Yay, synced with the network */
                if (!this.synced) {
                    this.emit('sync', walletHeight, networkHeight);
                    this.synced = true;
                }
                const lockedTransactionHashes = this.subWallets.getLockedTransactionHashes();
                const cancelledTransactions = yield this.walletSynchronizer.checkLockedTransactions(lockedTransactionHashes);
                for (const cancelledTX of cancelledTransactions) {
                    this.subWallets.removeCancelledTransaction(cancelledTX);
                }
            }
            else {
                /* We are no longer synced :( */
                if (this.synced) {
                    this.emit('desync', walletHeight, networkHeight);
                    this.synced = false;
                }
            }
            yield daemonInfo;
            /* Sleep for a second (not blocking the event loop) before
               continuing processing */
            yield Utilities_1.delay(Config_1.default.blockFetchInterval);
        });
    }
    storeTxData(txData, blockHeight) {
        /* Store any transactions */
        for (const transaction of txData.transactionsToAdd) {
            Logger_1.logger.log('Adding transaction ' + transaction.hash, Logger_1.LogLevel.INFO, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
            this.subWallets.addTransaction(transaction);
            /* Alert listeners we've got a transaction */
            this.emit('transaction', transaction);
            if (transaction.totalAmount() > 0) {
                this.emit('incomingtx', transaction);
            }
            else if (transaction.totalAmount() < 0) {
                this.emit('outgoingtx', transaction);
            }
            else {
                this.emit('fusiontx', transaction);
            }
        }
        /* Store any corresponding inputs */
        for (const [publicKey, input] of txData.inputsToAdd) {
            Logger_1.logger.log('Adding input ' + input.key, Logger_1.LogLevel.DEBUG, [Logger_1.LogCategory.SYNC]);
            this.subWallets.storeTransactionInput(publicKey, input);
        }
        /* Mark any spent key images */
        for (const [publicKey, keyImage] of txData.keyImagesToMarkSpent) {
            this.subWallets.markInputAsSpent(publicKey, keyImage, blockHeight);
        }
    }
    processBlocks() {
        return __awaiter(this, void 0, void 0, function* () {
            /* Take the blocks to process for this tick */
            const blocks = _.take(this.blocksToProcess, Config_1.default.blocksPerTick);
            for (const block of blocks) {
                Logger_1.logger.log('Processing block ' + block.blockHeight, Logger_1.LogLevel.INFO, [Logger_1.LogCategory.SYNC]);
                /* Forked chain, remove old data */
                if (this.walletSynchronizer.getHeight() >= block.blockHeight) {
                    Logger_1.logger.log('Removing forked transactions', Logger_1.LogLevel.INFO, [Logger_1.LogCategory.SYNC]);
                    this.subWallets.removeForkedTransactions(block.blockHeight);
                }
                let txData = new Types_1.TransactionData();
                /* Process the coinbase tx */
                txData = yield this.walletSynchronizer.processCoinbaseTransaction(block.coinbaseTransaction, block.blockTimestamp, block.blockHeight, txData);
                /* Process the normal txs */
                for (const tx of block.transactions) {
                    txData = yield this.walletSynchronizer.processTransaction(tx, block.blockTimestamp, block.blockHeight, txData);
                }
                /* Store the data */
                this.storeTxData(txData, block.blockHeight);
                /* Store the block hash we just processed */
                this.walletSynchronizer.storeBlockHash(block.blockHeight, block.blockHash);
                /* Remove the block we just processed */
                this.blocksToProcess = _.drop(this.blocksToProcess);
                Logger_1.logger.log('Finished processing block ' + block.blockHeight, Logger_1.LogLevel.DEBUG, [Logger_1.LogCategory.SYNC]);
            }
        });
    }
}
exports.WalletBackend = WalletBackend;
