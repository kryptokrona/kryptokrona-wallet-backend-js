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
const events_1 = require("events");
const fs = require("fs");
const _ = require("lodash");
const Metronome_1 = require("./Metronome");
const SubWallets_1 = require("./SubWallets");
const OpenWallet_1 = require("./OpenWallet");
const WalletEncryption_1 = require("./WalletEncryption");
const CnUtils_1 = require("./CnUtils");
const ValidateParameters_1 = require("./ValidateParameters");
const WalletSynchronizer_1 = require("./WalletSynchronizer");
const Config_1 = require("./Config");
const Logger_1 = require("./Logger");
const WalletError_1 = require("./WalletError");
const Transfer_1 = require("./Transfer");
const Constants_1 = require("./Constants");
const Utilities_1 = require("./Utilities");
/**
 * The WalletBackend provides an interface that allows you to synchronize
 * with a daemon, download blocks, process them, and pick out transactions that
 * belong to you.
 * It also allows you to inspect these transactions, view your balance,
 * send transactions, and more.
 * @noInheritDoc
 */
class WalletBackend extends events_1.EventEmitter {
    /**
     * @param newWallet Are we creating a new wallet? If so, it will start
     *                  syncing from the current time.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Set to zero if `newWallet` is `true`.
     *
     * @param privateSpendKey   Omit this parameter to create a view wallet.
     *
     */
    constructor(config, daemon, address, scanHeight, newWallet, privateViewKey, privateSpendKey) {
        super();
        /**
         * Whether our wallet is synced. Used for selectively firing the sync/desync
         * event.
         */
        this.synced = false;
        /**
         * Have we started the mainloop
         */
        this.started = false;
        /**
         * Whether we should automatically keep the wallet optimized
         */
        this.autoOptimize = true;
        /**
         * Are we in the middle of an optimization?
         */
        this.currentlyOptimizing = false;
        /**
         * Are we in the middle of a transaction?
         */
        this.currentlyTransacting = false;
        this.config = config;
        daemon.updateConfig(config);
        this.subWallets = new SubWallets_1.SubWallets(config, address, scanHeight, newWallet, privateViewKey, privateSpendKey);
        let timestamp = 0;
        if (newWallet) {
            timestamp = Utilities_1.getCurrentTimestampAdjusted(this.config.blockTargetTime);
        }
        this.walletSynchronizer = new WalletSynchronizer_1.WalletSynchronizer(daemon, this.subWallets, timestamp, scanHeight, privateViewKey, this.config);
        this.daemon = daemon;
        this.syncThread = new Metronome_1.Metronome(() => this.sync(true), this.config.syncThreadInterval);
        this.daemonUpdateThread = new Metronome_1.Metronome(() => this.updateDaemonInfo(), this.config.daemonUpdateInterval);
        this.lockedTransactionsCheckThread = new Metronome_1.Metronome(() => this.checkLockedTransactions(), this.config.lockedTransactionsCheckInterval);
    }
    /**
     *
     * This method opens a password protected wallet from a filepath.
     * The password protection follows the same format as wallet-api,
     * zedwallet-beta, and WalletBackend. It does NOT follow the same format
     * as turtle-service or zedwallet, and will be unable to open wallets
     * created with this program.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);
     *
     * const [wallet, error] = WB.WalletBackend.openWalletFromFile(daemon, 'mywallet.wallet', 'hunter2');
     *
     * if (err) {
     *      console.log('Failed to open wallet: ' + err.toString());
     * }
     * ```
     * @param filename  The location of the wallet file on disk
     *
     * @param password  The password to use to decrypt the wallet. May be blank.
     */
    static openWalletFromFile(daemon, filename, password, config) {
        const [walletJSON, error] = OpenWallet_1.openWallet(filename, password);
        if (error) {
            return [undefined, error];
        }
        return WalletBackend.loadWalletFromJSON(daemon, walletJSON, config);
    }
    /**
     *
     * This method opens a password protected wallet from an encrypted string.
     * The password protection follows the same format as wallet-api,
     * zedwallet-beta, and WalletBackend. It does NOT follow the same format
     * as turtle-service or zedwallet, and will be unable to open wallets
     * created with this program.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);
     * const data = 'ENCRYPTED_WALLET_STRING';
     *
     * const [wallet, error] = WB.WalletBackend.openWalletFromEncryptedString(daemon, data, 'hunter2');
     *
     * if (err) {
     *      console.log('Failed to open wallet: ' + err.toString());
     * }
     * ```
     * @param data  The encrypted string representing the wallet data
     *
     * @param password  The password to use to decrypt the wallet. May be blank.
     */
    static openWalletFromEncryptedString(deamon, data, password, config) {
        const [walletJSON, error] = WalletEncryption_1.WalletEncryption.decryptWalletFromString(data, password);
        if (error) {
            return [undefined, error];
        }
        return WalletBackend.loadWalletFromJSON(deamon, walletJSON, config);
    }
    /**
     * Loads a wallet from a JSON encoded string. For the correct format for
     * the JSON to use, see https://github.com/turtlecoin/wallet-file-interaction
     *
     * You can obtain this JSON using [[toJSONString]].
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);
     *
     * const [wallet, err] = WB.WalletBackend.loadWalletFromJSON(daemon, json);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface. Either
     *                      a conventional daemon, or a blockchain cache API.
     *
     * @param json          Wallet info encoded as a JSON encoded string. Note
     *                      that this should be a *string*, NOT a JSON object.
     *                      This function will call `JSON.parse()`, so you should
     *                      not do that yourself.
     */
    static loadWalletFromJSON(daemon, json, config) {
        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.initAfterLoad(daemon, Config_1.MergeConfig(config));
            return [wallet, undefined];
        }
        catch (err) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WALLET_FILE_CORRUPTED)];
        }
    }
    /**
     * Imports a wallet from a 25 word mnemonic seed.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);
     *
     * const seed = 'necklace went vials phone both haunted either eskimos ' +
     *              'dialect civilian western dabbing snout rustled balding ' +
     *              'puddle looking orbit rest agenda jukebox opened sarcasm ' +
     *              'solved eskimos';
     *
     * const [wallet, err] = WB.WalletBackend.importWalletFromSeed(daemon, 100000, seed);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface. Either
     *                      a conventional daemon, or a blockchain cache API.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero if not given.
     *
     * @param mnemonicSeed  The mnemonic seed to import. Should be a 25 word string.
     */
    static importWalletFromSeed(daemon, scanHeight = 0, mnemonicSeed, config) {
        let keys;
        try {
            keys = CnUtils_1.CryptoUtils(Config_1.MergeConfig(config)).createAddressFromMnemonic(mnemonicSeed);
        }
        catch (err) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_MNEMONIC, err.toString())];
        }
        if (scanHeight < 0) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN)];
        }
        if (!Number.isInteger(scanHeight)) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NON_INTEGER_GIVEN)];
        }
        /* Can't sync from the current scan height, not newly created */
        const newWallet = false;
        const wallet = new WalletBackend(Config_1.MergeConfig(config), daemon, keys.address, scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
        return [wallet, undefined];
    }
    /**
     * Imports a wallet from a pair of private keys.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);
     *
     * const privateViewKey = 'ce4c27d5b135dc5310669b35e53efc9d50d92438f00c76442adf8c85f73f1a01';
     * const privateSpendKey = 'f1b1e9a6f56241594ddabb243cdb39355a8b4a1a1c0343dde36f3b57835fe607';
     *
     * const [wallet, err] = WB.WalletBackend.importWalletFromSeed(daemon, 100000, privateViewKey, privateSpendKey);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface. Either
     *                      a conventional daemon, or a blockchain cache API.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     *
     * @param privateViewKey    The private view key to import. Should be a 64 char hex string.
     *
     * @param privateSpendKey   The private spend key to import. Should be a 64 char hex string.
     */
    static importWalletFromKeys(daemon, scanHeight = 0, privateViewKey, privateSpendKey, config) {
        if (!Utilities_1.isHex64(privateViewKey) || !Utilities_1.isHex64(privateSpendKey)) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT)];
        }
        let keys;
        try {
            keys = CnUtils_1.CryptoUtils(Config_1.MergeConfig(config)).createAddressFromKeys(privateSpendKey, privateViewKey);
        }
        catch (err) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT, err.toString())];
        }
        if (scanHeight < 0) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN)];
        }
        if (!Number.isInteger(scanHeight)) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NON_INTEGER_GIVEN)];
        }
        /* Can't sync from the current scan height, not newly created */
        const newWallet = false;
        const wallet = new WalletBackend(Config_1.MergeConfig(config), daemon, keys.address, scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
        return [wallet, undefined];
    }
    /**
     * This method imports a wallet you have previously created, in a 'watch only'
     * state. This wallet can view incoming transactions, but cannot send
     * transactions. It also cannot view outgoing transactions, so balances
     * may appear incorrect.
     * This is useful for viewing your balance whilst not risking your funds
     * or private keys being stolen.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);
     *
     * const privateViewKey = 'ce4c27d5b135dc5310669b35e53efc9d50d92438f00c76442adf8c85f73f1a01';
     *
     * const address = 'TRTLv2Fyavy8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyoBh4wW';
     *
     * const [wallet, err] = WB.WalletBackend.importViewWallet(daemon, 100000, privateViewKey, address);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface. Either
     *                      a conventional daemon, or a blockchain cache API.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     * @param privateViewKey    The private view key of this view wallet. Should be a 64 char hex string.
     *
     * @param address       The public address of this view wallet.
     */
    static importViewWallet(daemon, scanHeight = 0, privateViewKey, address, config) {
        if (!Utilities_1.isHex64(privateViewKey)) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT)];
        }
        const integratedAddressesAllowed = false;
        const err = ValidateParameters_1.validateAddresses(new Array(address), integratedAddressesAllowed, Config_1.MergeConfig(config));
        if (!_.isEqual(err, WalletError_1.SUCCESS)) {
            return [undefined, err];
        }
        if (scanHeight < 0) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN)];
        }
        if (!Number.isInteger(scanHeight)) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NON_INTEGER_GIVEN)];
        }
        /* Can't sync from the current scan height, not newly created */
        const newWallet = false;
        const wallet = new WalletBackend(Config_1.MergeConfig(config), daemon, address, scanHeight, newWallet, privateViewKey);
        return [wallet, undefined];
    }
    /**
     * This method creates a new wallet instance with a random key pair.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);
     *
     * const wallet = WB.WalletBackend.createWallet(daemon);
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface. Either
     *                      a conventional daemon, or a blockchain cache API.
     */
    static createWallet(daemon, config) {
        const newWallet = true;
        const scanHeight = 0;
        const keys = CnUtils_1.CryptoUtils(Config_1.MergeConfig(config)).createNewAddress();
        const wallet = new WalletBackend(Config_1.MergeConfig(config), daemon, keys.address, scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
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
        return Object.assign(wallet, {
            subWallets: SubWallets_1.SubWallets.fromJSON(json.subWallets),
            walletSynchronizer: WalletSynchronizer_1.WalletSynchronizer.fromJSON(json.walletSynchronizer),
        });
    }
    /**
     * Performs the same operation as reset(), but uses the initial scan height
     * or timestamp. For example, if you created your wallet at block 800,000,
     * this method would start rescanning from then.
     *
     * This function will return once the wallet has been successfully reset,
     * and syncing has began again.
     *
     * Example:
     * ```javascript
     * await wallet.rescan();
     * ```
     */
    rescan() {
        const [scanHeight, scanTimestamp] = this.walletSynchronizer.getScanHeights();
        return this.reset(scanHeight, scanTimestamp);
    }
    /**
     *
     * Discard all transaction data, and begin scanning the wallet again
     * from the scanHeight or timestamp given. Defaults to a height of zero,
     * if not given.
     *
     * This function will return once the wallet has been successfully reset,
     * and syncing has began again.
     *
     * Example:
     * ```javascript
     * await wallet.reset(123456);
     * ```
     *
     * @param scanHeight The scan height to begin scanning transactions from
     * @param timestamp The timestamp to being scanning transactions from
     */
    reset(scanHeight = 0, scanTimestamp = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const shouldRestart = this.started;
            yield this.stop();
            yield this.walletSynchronizer.reset(scanHeight, scanTimestamp);
            yield this.subWallets.reset(scanHeight, scanTimestamp);
            if (shouldRestart) {
                yield this.start();
            }
        });
    }
    /**
     * Gets the wallet, local daemon, and network block count
     *
     * Example:
     * ```javascript
     * const [walletBlockCount, localDaemonBlockCount, networkBlockCount] =
     *      wallet.getSyncStatus();
     * ```
     */
    getSyncStatus() {
        return [
            this.walletSynchronizer.getHeight(),
            this.daemon.getLocalDaemonBlockCount(),
            this.daemon.getNetworkBlockCount(),
        ];
    }
    /**
     * Converts the wallet into a JSON string. This can be used to later restore
     * the wallet with [[loadWalletFromJSON]].
     *
     * Example:
     * ```javascript
     * const walletData = wallet.toJSONString();
     * ```
     */
    toJSONString() {
        return JSON.stringify(this, null, 4);
    }
    /**
     *
     * Most people don't mine blocks, so by default we don't scan them. If
     * you want to scan them, flip it on/off here.
     *
     * Example:
     * ```javascript
     * wallet.scanCoinbaseTransactions(true);
     * ```
     *
     * @param shouldScan Should we scan coinbase transactions?
     */
    scanCoinbaseTransactions(shouldScan) {
        this.config.scanCoinbaseTransactions = shouldScan;
    }
    /**
     * Sets the log level. Log messages below this level are not shown.
     *
     * Logging by default occurs to stdout. See [[setLoggerCallback]] to modify this,
     * or gain more control over what is logged.
     *
     * Example:
     * ```javascript
     * wallet.setLogLevel(WB.LogLevel.DEBUG);
     * ```
     *
     * @param logLevel The level to log messages at.
     */
    setLogLevel(logLevel) {
        Logger_1.logger.setLogLevel(logLevel);
    }
    /**
     * This flag will automatically send fusion transactions when needed
     * to keep your wallet permanently optimized.
     *
     * The downsides are that sometimes your wallet will 'unexpectedly' have
     * locked funds.
     *
     * The upside is that when you come to sending a large transaction, it
     * should nearly always succeed.
     *
     * This flag is ENABLED by default.
     *
     * Example:
     * ```javascript
     * wallet.enableAutoOptimization(false);
     * ```
     *
     * @param shouldAutoOptimize Should we automatically keep the wallet optimized?
     */
    enableAutoOptimization(shouldAutoOptimize) {
        this.autoOptimize = shouldAutoOptimize;
    }
    /**
     * Sets a callback to be used instead of console.log for more fined control
     * of the logging output.
     *
     * Ensure that you have enabled logging for this function to take effect.
     * See [[setLogLevel]] for more details.
     *
     * Example:
     * ```javascript
     * wallet.setLoggerCallback((prettyMessage, message, level, categories) => {
     *       if (categories.includes(WB.LogCategory.SYNC)) {
     *           console.log(prettyMessage);
     *       }
     *   });
     * ```
     *
     * @param callback The callback to use for log messages
     * @param callback.prettyMessage A nicely formatted log message, with timestamp, levels, and categories
     * @param callback.message       The raw log message
     * @param callback.level         The level at which the message was logged at
     * @param callback.categories    The categories this log message falls into
     */
    setLoggerCallback(callback) {
        Logger_1.logger.setLoggerCallback(callback);
    }
    /**
     * Provide a function to process blocks instead of the inbuilt one. The
     * only use for this is to leverage native code to provide quicker
     * cryptography functions - the default JavaScript is not that speedy.
     *
     * Note that if you're in a node environment, this library will use
     * C++ code with node-gyp, so it will be nearly as fast as C++ implementations.
     * You only need to worry about this in less conventional environments,
     * like react-native, or possibly the web.
     *
     * If you don't know what you're doing,
     * DO NOT TOUCH THIS - YOU WILL BREAK WALLET SYNCING
     *
     * Note you don't have to set the globalIndex properties on returned inputs.
     * We will fetch them from the daemon if needed. However, if you have them,
     * return them, to save us a daemon call.
     *
     * Your function should return an array of `[publicSpendKey, TransactionInput]`.
     * The public spend key is the corresponding subwallet that the transaction input
     * belongs to.
     *
     * Return an empty array if no inputs are found that belong to the user.
     *
     * Example:
     * ```javascript
     * wallet.setBlockOutputProcessFunc(mySuperSpeedyFunction);
     * ```
     *
     * @param func The function to process block outputs.
     * @param func.block The block to be processed.
     * @param func.privateViewKey The private view key of this wallet container.
     * @param func.spendKeys An array of [publicSpendKey, privateSpendKey]. These are the spend keys of each subwallet.
     * @param func.isViewWallet Whether this wallet is a view only wallet or not.
     * @param func.processCoinbaseTransactions Whether you should process coinbase transactions or not.
     */
    setBlockOutputProcessFunc(func) {
        this.externalBlockProcessFunction = func;
    }
    /**
     * Initializes and starts the wallet sync process. You should call this
     * function before enquiring about daemon info or fee info. The wallet will
     * not process blocks until you call this method.
     *
     * Example:
     * ```javascript
     * await wallet.start();
     * ```
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.started) {
                yield this.daemon.init();
                this.syncThread.start();
                this.daemonUpdateThread.start();
                this.lockedTransactionsCheckThread.start();
                this.started = true;
            }
        });
    }
    /**
     * The inverse of the [[start]] method, this pauses the blockchain sync
     * process.
     *
     * If you want the node process to close cleanly (i.e, without using `process.exit()`),
     * you need to call this function. Otherwise, the library will keep firing
     * callbacks, and so your script will hang.
     *
     * Example:
     * ```javascript
     * wallet.stop();
     * ```
     */
    stop() {
        this.syncThread.stop();
        this.daemonUpdateThread.stop();
        this.lockedTransactionsCheckThread.stop();
        this.started = false;
    }
    /**
     * Get the node fee the daemon you are connected to is charging for
     * transactions. If the daemon charges no fee, this will return `['', 0]`
     *
     * Example:
     * ```javascript
     * const [nodeFeeAddress, nodeFeeAmount] = wallet.getNodeFee();
     *
     * if (nodeFeeAmount === 0) {
     *      console.log('Yay, no fees!');
     * }
     * ```
     */
    getNodeFee() {
        return this.daemon.nodeFee();
    }
    /**
     * Gets the shared private view key for this wallet container.
     *
     * Example:
     * ```javascript
     * const privateViewKey = wallet.getPrivateViewKey();
     * ```
     */
    getPrivateViewKey() {
        return this.subWallets.getPrivateViewKey();
    }
    /**
     * Exposes some internal functions for those who know what they're doing...
     *
     * Example:
     * ```javascript
     * const syncFunc = wallet.internal().sync;
     * await syncFunc(true);
     * ```
     *
     * @returns Returns an object with two members, sync(), and updateDaemonInfo().
     */
    internal() {
        return {
            sync: (sleep) => this.sync(sleep),
            updateDaemonInfo: () => this.updateDaemonInfo(),
        };
    }
    /**
     * Gets the publicSpendKey and privateSpendKey for the given address, if
     * possible.
     *
     * Note: secret key will be 00000... (64 zeros) if this wallet is a view only wallet.
     *
     * Example:
     * ```javascript
     * const [publicSpendKey, privateSpendKey, err] = wallet.getSpendKeys('TRTLxyz...');
     *
     * if (err) {
     *      console.log('Failed to get spend keys for address: ' + err.toString());
     * }
     * ```
     *
     * @param address A valid address in this container, to get the spend keys of
     */
    getSpendKeys(address) {
        const integratedAddressesAllowed = false;
        const err = ValidateParameters_1.validateAddresses(new Array(address), integratedAddressesAllowed, this.config);
        if (!_.isEqual(err, WalletError_1.SUCCESS)) {
            return [undefined, undefined, err];
        }
        const [publicViewKey, publicSpendKey] = Utilities_1.addressToKeys(address, this.config);
        const [err2, privateSpendKey] = this.subWallets.getPrivateSpendKey(publicSpendKey);
        if (!_.isEqual(err2, WalletError_1.SUCCESS)) {
            return [undefined, undefined, err2];
        }
        return [publicSpendKey, privateSpendKey, undefined];
    }
    /**
     * Gets the private spend and private view for the primary address.
     * The primary address is the first created wallet in the container.
     *
     * Example:
     * ```javascript
     * const [privateSpendKey, privateViewKey] = wallet.getPrimaryAddressPrivateKeys();
     * ```
     */
    getPrimaryAddressPrivateKeys() {
        return [this.subWallets.getPrimaryPrivateSpendKey(), this.getPrivateViewKey()];
    }
    /**
     * Get the primary address mnemonic seed. If the primary address isn't
     * a deterministic wallet, it will return a WalletError.
     *
     * Example:
     * ```javascript
     * const [seed, err] = wallet.getMnemonicSeed();
     *
     * if (err) {
     *      console.log('Wallet is not a deterministic wallet: ' + err.toString());
     * }
     * ```
     */
    getMnemonicSeed() {
        return this.getMnemonicSeedForAddress(this.subWallets.getPrimaryAddress());
    }
    /**
     * Get the mnemonic seed for the specified address. If the specified address
     * is invalid or the address isn't a deterministic wallet, it will return
     * a WalletError.
     *
     * Example:
     * ```javascript
     * const [seed, err] = wallet.getMnemonicSeedForAddress('TRTLxyz...');
     *
     * if (err) {
     *      console.log('Address does not belong to a deterministic wallet: ' + err.toString());
     * }
     * ```
     *
     * @param address A valid address that exists in this container
     */
    getMnemonicSeedForAddress(address) {
        const privateViewKey = this.getPrivateViewKey();
        const [publicSpendKey, privateSpendKey, error] = this.getSpendKeys(address);
        if (error) {
            return [undefined, error];
        }
        const parsedAddr = CnUtils_1.CryptoUtils(this.config).createAddressFromKeys(privateSpendKey, privateViewKey);
        if (!parsedAddr.mnemonic) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.KEYS_NOT_DETERMINISTIC)];
        }
        return [parsedAddr.mnemonic, undefined];
    }
    /**
     * Gets the primary address of a wallet container.
     * The primary address is the address that was created first in the wallet
     * container.
     *
     * Example:
     * ```javascript
     * const address = wallet.getPrimaryAddress();
     * ```
     */
    getPrimaryAddress() {
        return this.subWallets.getPrimaryAddress();
    }
    /**
     * Encrypt the wallet using the given password. Password may be empty. Note that an empty password does not mean an
     * unencrypted wallet - simply a wallet encrypted with the empty string.
     *
     * This will take some time (Roughly a second on a modern PC) - it runs 500,000 iterations of pbkdf2.
     *
     * Example:
     * ```javascript
     * const saved = wallet.encryptWalletToString('hunter2');
     *
     * ```
     *
     * @param password The password to encrypt the wallet with
     *
     * @return Returns the encrypted wallet as astring.
     */
    encryptWalletToString(password) {
        const walletJson = JSON.stringify(this);
        return WalletEncryption_1.WalletEncryption.encryptWalletToString(walletJson, password);
    }
    /**
     * Save the wallet to the given filename. Password may be empty, but
     * filename must not be. Note that an empty password does not mean an
     * unencrypted wallet - simply a wallet encrypted with the empty string.
     *
     * This will take some time (Roughly a second on a modern PC) - it runs 500,000 iterations of pbkdf2.
     *
     * Example:
     * ```javascript
     * const saved = wallet.saveWalletToFile('test.wallet', 'hunter2');
     *
     * if (!saved) {
     *      console.log('Failed to save wallet!');
     * }
     * ```
     *
     * @param filename The file location to save the wallet to.
     * @param password The password to encrypt the wallet with
     *
     * @return Returns a boolean indicating success.
     */
    saveWalletToFile(filename, password) {
        const walletJson = JSON.stringify(this);
        const fileData = WalletEncryption_1.WalletEncryption.encryptWalletToBuffer(walletJson, password);
        try {
            fs.writeFileSync(filename, fileData);
            return true;
        }
        catch (err) {
            Logger_1.logger.log('Failed to write file: ' + err.toString(), Logger_1.LogLevel.ERROR, [Logger_1.LogCategory.FILESYSTEM, Logger_1.LogCategory.SAVE]);
            return false;
        }
    }
    /**
     * Gets the address of every subwallet in this container.
     *
     * Example:
     * ```javascript
     * let i = 1;
     *
     * for (const address of wallet.getAddresses()) {
     *      console.log(`Address [${i}]: ${address}`);
     *      i++;
     * }
     * ```
     */
    getAddresses() {
        return this.subWallets.getAddresses();
    }
    /**
     * Optimizes your wallet as much as possible. It will optimize every single
     * subwallet correctly, if you have multiple subwallets. Note that this
     * method does not wait for the funds to return to your wallet before
     * returning, so, it is likely balances will remain locked.
     *
     * Note that if you want to alert the user in real time of the hashes or
     * number of transactions sent, you can subscribe to the `createdfusiontx`
     * event. This will be fired every time a fusion transaction is sent.
     *
     * You may also want to consider manually creating individual transactions
     * if you want more control over the process. See [[sendFusionTransactionBasic]].
     *
     * This method may take a *very long time* if your wallet is not optimized
     * at all. It is suggested to not block the UI/mainloop of your program
     * when using this method.
     *
     * Example:
     * ```javascript
     * const [numberOfTransactionsSent, hashesOfSentFusionTransactions] = await wallet.optimize();
     *
     * console.log(`Sent ${numberOfTransactionsSent} fusion transactions, hashes: ${hashesOfSentFusionTransactions.join(', ')}`);
     * ```
     */
    optimize() {
        return __awaiter(this, void 0, void 0, function* () {
            let numTransactionsSent = 0;
            let hashes = [];
            for (const address of this.getAddresses()) {
                const [numSent, newHashes] = yield this.optimizeAddress(address);
                numTransactionsSent += numSent;
                hashes = hashes.concat(newHashes);
            }
            return [numTransactionsSent, hashes];
        });
    }
    /**
     * Sends a fusion transaction, if possible.
     * Fusion transactions are zero fee, and optimize your wallet
     * for sending larger amounts. You may (probably will) need to perform
     * multiple fusion transactions.
     *
     * If you want to ensure your wallet gets fully optimized, consider using
     * [[optimize]].
     *
     * Example:
     * ```javascript
     * const [hash, err] = await wallet.sendFusionTransactionBasic();
     *
     * if (err) {
     *      console.log('Failed to send fusion transaction: ' + err.toString());
     * }
     * ```
     */
    sendFusionTransactionBasic() {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentlyTransacting = true;
            const f = () => __awaiter(this, void 0, void 0, function* () {
                const [transaction, hash, error] = yield Transfer_1.sendFusionTransactionBasic(this.config, this.daemon, this.subWallets);
                if (transaction) {
                    this.emit('createdfusiontx', transaction);
                }
                /* Typescript is too dumb for return [hash, error] to work.. */
                if (hash) {
                    Logger_1.logger.log('Sent fusion transaction ' + hash, Logger_1.LogLevel.INFO, Logger_1.LogCategory.TRANSACTIONS);
                    return [hash, undefined];
                }
                else {
                    return [undefined, error];
                }
            });
            const result = yield f();
            this.currentlyTransacting = false;
            return result;
        });
    }
    /**
     * Sends a fusion transaction, if possible.
     * Fusion transactions are zero fee, and optimize your wallet
     * for sending larger amounts. You may (probably will) need to perform
     * multiple fusion transactions.
     *
     * If you want to ensure your wallet gets fully optimized, consider using
     * [[optimize]].
     *
     * All parameters are optional.
     *
     * Example:
     * ```javascript
     * const [hash, err] = await wallet.sendFusionTransactionAdvanced(3, undefined, 'TRTLxyz..');
     *
     * if (err) {
     *      console.log('Failed to send transaction: ' + err.toString());
     * }
     * ```
     *
     * @param mixin                 The amount of input keys to hide your input with.
     *                              Your network may enforce a static mixin.
     * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
     * @param destination           The destination for the fusion transaction to be sent to.
     *                              Must be an address existing in this container.
     */
    sendFusionTransactionAdvanced(mixin, subWalletsToTakeFrom, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentlyTransacting = true;
            const f = () => __awaiter(this, void 0, void 0, function* () {
                const [transaction, hash, error] = yield Transfer_1.sendFusionTransactionAdvanced(this.config, this.daemon, this.subWallets, mixin, subWalletsToTakeFrom, destination);
                if (transaction) {
                    this.emit('createdfusiontx', transaction);
                }
                /* Typescript is too dumb for return [hash, error] to work.. */
                if (hash) {
                    Logger_1.logger.log('Sent fusion transaction ' + hash, Logger_1.LogLevel.INFO, Logger_1.LogCategory.TRANSACTIONS);
                    return [hash, undefined];
                }
                else {
                    return [undefined, error];
                }
            });
            const result = yield f();
            this.currentlyTransacting = false;
            return result;
        });
    }
    /**
     * Sends a transaction of amount to the address destination, using the
     * given payment ID, if specified.
     *
     * Network fee is set to default, mixin is set to default, all subwallets
     * are taken from, primary address is used as change address.
     *
     * If you need more control, use [[sendTransactionAdvanced]].
     *
     * Example:
     * ```javascript
     * const [hash, err] = await wallet.sendTransactionBasic('TRTLxyz...', 1234);
     *
     * if (err) {
     *      console.log('Failed to send transaction: ' + err.toString());
     * }
     * ```
     *
     * @param destination   The address to send the funds to
     * @param amount        The amount to send, in ATOMIC units
     * @param paymentID     The payment ID to include with this transaction. Optional.
     *
     * @return Returns either an error, or the transaction hash.
     */
    sendTransactionBasic(destination, amount, paymentID) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentlyTransacting = true;
            const f = () => __awaiter(this, void 0, void 0, function* () {
                const [transaction, hash, error] = yield Transfer_1.sendTransactionBasic(this.config, this.daemon, this.subWallets, destination, amount, paymentID);
                if (transaction) {
                    this.emit('createdtx', transaction);
                }
                /* Typescript is too dumb for return [hash, error] to work.. */
                if (hash) {
                    Logger_1.logger.log('Sent transaction ' + hash, Logger_1.LogLevel.INFO, Logger_1.LogCategory.TRANSACTIONS);
                    return [hash, undefined];
                }
                else {
                    return [undefined, error];
                }
            });
            const result = yield f();
            this.currentlyTransacting = false;
            return result;
        });
    }
    /**
     * Sends a transaction, which permits multiple amounts to different destinations,
     * specifying the mixin, fee, subwallets to draw funds from, and change address.
     *
     * All parameters are optional aside from destinations.
     *
     * Example:
     * ```javascript
     * const destinations = [
     *      ['TRTLxyz...', 1000],
     *      ['TRTLzyx...', 10000],
     * ];
     *
     * const [hash, err] = await wallet.sendTransactionAdvanced(destinations, undefined, 100, 'c59d157d1d96f280ece0816a8925cae8232432b7235d1fa92c70faf3064434b3');
     *
     * if (err) {
     *      console.log('Failed to send transaction: ' + err.toString());
     * }
     * ```
     *
     * @param destinations          An array of destinations, and amounts to send to that
     *                              destination. Amounts are in ATOMIC units.
     * @param mixin                 The amount of input keys to hide your input with.
     *                              Your network may enforce a static mixin.
     * @param fee                   The network fee to use with this transaction. In ATOMIC units.
     * @param paymentID             The payment ID to include with this transaction. Defaults to none.
     * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from. Defaults to all addresses.
     * @param changeAddress         The address to send any returned change to. Defaults to the primary address.
     */
    sendTransactionAdvanced(destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentlyTransacting = true;
            const f = () => __awaiter(this, void 0, void 0, function* () {
                const [transaction, hash, error] = yield Transfer_1.sendTransactionAdvanced(this.config, this.daemon, this.subWallets, destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress);
                if (transaction) {
                    this.emit('createdtx', transaction);
                }
                /* Typescript is too dumb for return [hash, error] to work.. */
                if (hash) {
                    Logger_1.logger.log('Sent transaction ' + hash, Logger_1.LogLevel.INFO, Logger_1.LogCategory.TRANSACTIONS);
                    return [hash, undefined];
                }
                else {
                    return [undefined, error];
                }
            });
            const result = yield f();
            this.currentlyTransacting = false;
            return result;
        });
    }
    /**
     * Get the unlocked and locked balance for the wallet container.
     *
     * Example:
     * ```javascript
     * const [unlockedBalance, lockedBalance] = wallet.getBalance();
     * ```
     *
     * @param subWalletsToTakeFrom The addresses to check the balance of. If
     *                             not given, defaults to all addresses.
     */
    getBalance(subWalletsToTakeFrom) {
        return this.subWallets.getBalance(this.daemon.getNetworkBlockCount(), subWalletsToTakeFrom);
    }
    /**
     * Gets all the transactions in the wallet container.
     *
     * Newer transactions are at the front of the array - Unconfirmed transactions
     * come at the very front.
     *
     * Example:
     * ```javascript
     * for (const tx of wallet.getTransactions()) {
     *      console.log(`Transaction ${tx.hash} - ${WB.prettyPrintAmount(tx.totalAmount())} - ${tx.timestamp}`);
     * }
     * ```
     *
     * @param startIndex Index to start taking transactions from
     * @param numTransactions Number of transactions to take
     * @param includeFusions Should we include fusion transactions?
     */
    getTransactions(startIndex, numTransactions, includeFusions = true) {
        /* Clone the array and reverse it, newer txs first */
        const unconfirmed = this.subWallets.getUnconfirmedTransactions().slice().reverse();
        /* Clone the array and reverse it, newer txs first */
        const confirmed = this.subWallets.getTransactions().slice().reverse();
        const allTransactions = unconfirmed.concat(confirmed).filter((x) => includeFusions ? true : x.totalAmount() !== 0);
        if (startIndex === undefined) {
            startIndex = 0;
        }
        if (startIndex >= allTransactions.length) {
            return [];
        }
        if (numTransactions === undefined || numTransactions + startIndex > allTransactions.length) {
            numTransactions = allTransactions.length - startIndex;
        }
        return allTransactions.slice(startIndex, startIndex + numTransactions);
    }
    /**
     * Gets the specified transaction, if it exists in this wallet container.
     *
     * Example:
     * ```javascript
     * const tx = wallet.getTransaction('693950eeec41dc36cfc5109eba15807ce3d63eff21f1eec20a7d1bda99563b1c');
     *
     * if (tx) {
     *      console.log(`Tx ${tx.hash} is worth ${WB.prettyPrintAmount(tx.totalAmount())}`);
     * } else {
     *      console.log("Couldn't find transaction! Is your wallet synced?");
     * }
     * ```
     *
     * @param hash The hash of the transaction to get
     */
    getTransaction(hash) {
        const txs = this.getTransactions();
        return txs.find((tx) => tx.hash === hash);
    }
    /**
     * Get the number of transactions in the wallet container. Can be used
     * if you want to avoid fetching all transactions repeatedly when nothing
     * has changed.
     *
     * Note that it probably is more effective to subscribe to the transaction
     * related events to update your UI, rather than polling for the number
     * of transactions.
     *
     * Example:
     * ```javascript
     * let numTransactions = 0;
     *
     * while (true) {
     *      const tmpNumTransactions = wallet.getNumTransactions();
     *
     *      if (numTransactions != tmpNumTransactions) {
     *          console.log(tmpNumTransactions - numTransactions + ' new transactions found!');
     *          numTransactions = tmpNumTransactions;
     *      }
     * }
     * ```
     */
    getNumTransactions() {
        return this.subWallets.getNumTransactions()
            + this.subWallets.getNumUnconfirmedTransactions();
    }
    /**
     * Remove any transactions that have been cancelled
     */
    checkLockedTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Checking locked transactions...', Logger_1.LogLevel.DEBUG, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
            const lockedTransactionHashes = this.subWallets.getLockedTransactionHashes();
            const cancelledTransactions = yield this.walletSynchronizer.findCancelledTransactions(lockedTransactionHashes);
            for (const cancelledTX of cancelledTransactions) {
                this.subWallets.removeCancelledTransaction(cancelledTX);
            }
        });
    }
    /**
     * Update daemon status
     */
    updateDaemonInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Updating daemon info...', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.DAEMON);
            yield this.daemon.updateDaemonInfo();
            const walletHeight = this.walletSynchronizer.getHeight();
            const networkHeight = this.daemon.getNetworkBlockCount();
            if (walletHeight >= networkHeight) {
                /* Yay, synced with the network */
                if (!this.synced) {
                    this.emit('sync', walletHeight, networkHeight);
                    this.synced = true;
                }
            }
            else {
                /* We are no longer synced :( */
                if (this.synced) {
                    this.emit('desync', walletHeight, networkHeight);
                    this.synced = false;
                }
            }
        });
    }
    /**
     * Stores any transactions, inputs, and spend keys images
     */
    storeTxData(txData, blockHeight) {
        /* Store any corresponding inputs */
        for (const [publicKey, input] of txData.inputsToAdd) {
            Logger_1.logger.log('Adding input ' + input.key, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            this.subWallets.storeTransactionInput(publicKey, input);
        }
        /* Mark any spent key images */
        for (const [publicKey, keyImage] of txData.keyImagesToMarkSpent) {
            this.subWallets.markInputAsSpent(publicKey, keyImage, blockHeight);
        }
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
        if (txData.transactionsToAdd.length > 0 && this.autoOptimize) {
            this.performAutoOptimize();
        }
    }
    /**
     * Get the global indexes for a range of blocks
     *
     * When we get the global indexes, we pass in a range of blocks, to obscure
     * which transactions we are interested in - the ones that belong to us.
     * To do this, we get the global indexes for all transactions in a range.
     *
     * For example, if we want the global indexes for a transaction in block
     * 17, we get all the indexes from block 10 to block 20.
     */
    getGlobalIndexes(blockHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            const startHeight = Utilities_1.getLowerBound(blockHeight, Constants_1.GLOBAL_INDEXES_OBSCURITY);
            const endHeight = Utilities_1.getUpperBound(blockHeight, Constants_1.GLOBAL_INDEXES_OBSCURITY);
            return this.daemon.getGlobalIndexesForRange(startHeight, endHeight);
        });
    }
    /**
     * Process config.blocksPerTick stored blocks, finding transactions and
     * inputs that belong to us
     */
    processBlocks(sleep) {
        return __awaiter(this, void 0, void 0, function* () {
            /* Take the blocks to process for this tick */
            const blocks = yield this.walletSynchronizer.fetchBlocks(this.config.blocksPerTick);
            if (blocks.length === 0) {
                if (sleep) {
                    yield Utilities_1.delay(1000);
                }
                return false;
            }
            for (const block of blocks) {
                Logger_1.logger.log('Processing block ' + block.blockHeight, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                /* Forked chain, remove old data */
                if (this.walletSynchronizer.getHeight() >= block.blockHeight) {
                    Logger_1.logger.log('Removing forked transactions', Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
                    this.subWallets.removeForkedTransactions(block.blockHeight);
                }
                if (block.blockHeight % 5000 === 0 && block.blockHeight !== 0) {
                    this.subWallets.pruneSpentInputs(block.blockHeight - 5000);
                }
                /* User can supply us a function to do the processing, possibly
                   utilizing native code for moar speed */
                const processFunction = this.externalBlockProcessFunction
                    || this.walletSynchronizer.processBlockOutputs.bind(this.walletSynchronizer);
                const blockInputs = yield processFunction(block, this.getPrivateViewKey(), this.subWallets.getAllSpendKeys(), this.subWallets.isViewWallet, this.config.scanCoinbaseTransactions);
                let globalIndexes = new Map();
                /* Fill in output indexes if not returned from daemon */
                for (const [publicKey, input] of blockInputs) {
                    /* Using a daemon type which doesn't provide output indexes,
                       and not in a view wallet */
                    if (!this.subWallets.isViewWallet && input.globalOutputIndex === undefined) {
                        /* Fetch the indexes if we don't have them already */
                        if (_.isEmpty(globalIndexes)) {
                            globalIndexes = yield this.getGlobalIndexes(block.blockHeight);
                        }
                        /* If the indexes returned doesn't include our array, the daemon is
                           faulty. If we can't connect to the daemon, it will throw instead,
                           which we will catch further up */
                        const ourIndexes = globalIndexes.get(input.parentTransactionHash);
                        if (!ourIndexes) {
                            throw new Error('Could not get global indexes from daemon! ' +
                                'Possibly faulty/malicious daemon.');
                        }
                        input.globalOutputIndex = ourIndexes[input.transactionIndex];
                    }
                }
                const txData = this.walletSynchronizer.processBlock(block, blockInputs);
                /* Store the data */
                this.storeTxData(txData, block.blockHeight);
                /* Store the block hash and remove the block we just processed */
                this.walletSynchronizer.dropBlock(block.blockHeight, block.blockHash);
                Logger_1.logger.log('Finished processing block ' + block.blockHeight, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            }
            return true;
        });
    }
    /**
     * Main loop. Download blocks, process them.
     */
    sync(sleep) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.processBlocks(sleep);
            }
            catch (err) {
                Logger_1.logger.log('Error processing blocks: ' + err.toString(), Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
            }
            return false;
        });
    }
    /**
     * Converts recursively to JSON. Should be used in conjuction with JSON.stringify.
     * Example:
     *
     * ```
     * JSON.stringify(wallet, null, 4);
     * ```
     */
    toJSON() {
        return {
            subWallets: this.subWallets.toJSON(),
            walletFileFormatVersion: Constants_1.WALLET_FILE_FORMAT_VERSION,
            walletSynchronizer: this.walletSynchronizer.toJSON(),
        };
    }
    /**
     * Initialize stuff not stored in the JSON.
     */
    initAfterLoad(daemon, config) {
        this.config = config;
        this.daemon = daemon;
        this.daemon.updateConfig(config);
        this.walletSynchronizer.initAfterLoad(this.subWallets, daemon, this.config);
        this.subWallets.initAfterLoad(this.config);
        this.syncThread = new Metronome_1.Metronome(() => this.sync(true), this.config.syncThreadInterval);
        this.daemonUpdateThread = new Metronome_1.Metronome(() => this.updateDaemonInfo(), this.config.daemonUpdateInterval);
        this.lockedTransactionsCheckThread = new Metronome_1.Metronome(() => this.checkLockedTransactions(), this.config.lockedTransactionsCheckInterval);
    }
    /**
     * Since we're going to use optimize() with auto optimizing, and auto
     * optimizing is enabled by default, we have to ensure we only optimize
     * a single wallet at once. Otherwise, we'll end up with everyones balance
     * in the primary wallet.
     */
    optimizeAddress(address) {
        return __awaiter(this, void 0, void 0, function* () {
            let failCount = 0;
            let sentTransactions = 0;
            const hashes = [];
            /* Since input selection is random, lets let it fail a few times before
               stopping */
            while (failCount < 5) {
                /* Draw from address, and return funds to address */
                const [hash, error] = yield this.sendFusionTransactionAdvanced(undefined, [address], address);
                if (error) {
                    failCount++;
                }
                else if (hash) {
                    failCount = 0;
                    sentTransactions++;
                    hashes.push(hash);
                }
            }
            return [sentTransactions, hashes];
        });
    }
    performAutoOptimize() {
        return __awaiter(this, void 0, void 0, function* () {
            /* Already optimizing, don't optimize again */
            if (this.currentlyOptimizing) {
                return;
            }
            else {
                this.currentlyOptimizing = true;
            }
            const f = () => __awaiter(this, void 0, void 0, function* () {
                /* In a transaction, don't optimize as it may possibly break things */
                if (this.currentlyTransacting) {
                    return;
                }
                const walletHeight = this.walletSynchronizer.getHeight();
                const networkHeight = this.daemon.getNetworkBlockCount();
                /* We're not close to synced, don't bother optimizing yet */
                if (walletHeight + 100 < networkHeight) {
                    return;
                }
                Logger_1.logger.log('Performing auto optimization', Logger_1.LogLevel.INFO, Logger_1.LogCategory.TRANSACTIONS);
                /* Do the optimize! */
                yield this.optimize();
                Logger_1.logger.log('Auto optimization complete', Logger_1.LogLevel.INFO, Logger_1.LogCategory.TRANSACTIONS);
            });
            yield f();
            /* We're done. */
            this.currentlyOptimizing = false;
        });
    }
}
exports.WalletBackend = WalletBackend;
