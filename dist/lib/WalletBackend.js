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
exports.WalletBackend = void 0;
// tslint:disable: max-line-length
const events_1 = require("events");
const kryptokrona_utils_1 = require("kryptokrona-utils");
const fs = require("fs");
const _ = require("lodash");
const Metronome_1 = require("./Metronome");
const SubWallets_1 = require("./SubWallets");
const OpenWallet_1 = require("./OpenWallet");
const WalletEncryption_1 = require("./WalletEncryption");
const ValidateParameters_1 = require("./ValidateParameters");
const WalletSynchronizer_1 = require("./WalletSynchronizer");
const Config_1 = require("./Config");
const Logger_1 = require("./Logger");
const SynchronizationStatus_1 = require("./SynchronizationStatus");
const WalletError_1 = require("./WalletError");
const Transfer_1 = require("./Transfer");
const Constants_1 = require("./Constants");
const Utilities_1 = require("./Utilities");
const Assert_1 = require("./Assert");
const CnUtils_1 = require("./CnUtils");
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
     * const daemon = new WB.Daemon('127.0.0.1', 11898);
     *
     * const [wallet, error] = await WB.WalletBackend.openWalletFromFile(daemon, 'mywallet.wallet', 'hunter2');
     *
     * if (err) {
     *      console.log('Failed to open wallet: ' + err.toString());
     * }
     * ```
     * @param daemon
     * @param filename  The location of the wallet file on disk
     * @param password  The password to use to decrypt the wallet. May be blank.
     * @param config
     */
    static openWalletFromFile(daemon, filename, password, config) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function openWalletFromFile called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertString)(filename, 'filename');
            (0, Assert_1.assertString)(password, 'password');
            const [walletJSON, error] = (0, OpenWallet_1.openWallet)(filename, password);
            if (error) {
                return [undefined, error];
            }
            return WalletBackend.loadWalletFromJSON(daemon, walletJSON, config);
        });
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
     * const daemon = new WB.Daemon('127.0.0.1', 11898);
     * const data = 'ENCRYPTED_WALLET_STRING';
     *
     * const [wallet, error] = await WB.WalletBackend.openWalletFromEncryptedString(daemon, data, 'hunter2');
     *
     * if (err) {
     *      console.log('Failed to open wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon
     * @param data  The encrypted string representing the wallet data
     *
     * @param password  The password to use to decrypt the wallet. May be blank.
     * @param config
     */
    static openWalletFromEncryptedString(daemon, data, password, config) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function openWalletFromEncryptedString called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertString)(data, 'data');
            (0, Assert_1.assertString)(password, 'password');
            const [walletJSON, error] = WalletEncryption_1.WalletEncryption.decryptWalletFromString(data, password);
            if (error) {
                return [undefined, error];
            }
            return WalletBackend.loadWalletFromJSON(daemon, walletJSON, config);
        });
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
     * const daemon = new WB.Daemon('127.0.0.1', 11898);
     *
     * const [wallet, err] = await WB.WalletBackend.loadWalletFromJSON(daemon, json);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the Daemon interface.
     *
     * @param json          Wallet info encoded as a JSON encoded string. Note
     *                      that this should be a *string*, NOT a JSON object.
     *                      This function will call `JSON.parse()`, so you should
     *                      not do that yourself.
     * @param config
     */
    static loadWalletFromJSON(daemon, json, config) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function loadWalletFromJSON called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertString)(json, 'json');
            (0, CnUtils_1.CryptoUtils)((0, Config_1.MergeConfig)(config));
            try {
                const wallet = JSON.parse(json, WalletBackend.reviver);
                wallet.initAfterLoad(daemon, (0, Config_1.MergeConfig)(config));
                return [wallet, undefined];
            }
            catch (err) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WALLET_FILE_CORRUPTED)];
            }
        });
    }
    /**
     * Imports a wallet from a 25 word mnemonic seed.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.Daemon('127.0.0.1', 11898);
     *
     * const seed = 'necklace went vials phone both haunted either eskimos ' +
     *              'dialect civilian western dabbing snout rustled balding ' +
     *              'puddle looking orbit rest agenda jukebox opened sarcasm ' +
     *              'solved eskimos';
     *
     * const [wallet, err] = await WB.WalletBackend.importWalletFromSeed(daemon, 100000, seed);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the Daemon interface.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero if not given.
     *
     * @param mnemonicSeed  The mnemonic seed to import. Should be a 25 word string.
     * @param config
     */
    static importWalletFromSeed(daemon, scanHeight = 0, mnemonicSeed, config) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function importWalletFromSeed called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertNumber)(scanHeight, 'scanHeight');
            (0, Assert_1.assertString)(mnemonicSeed, 'mnemonicSeed');
            const merged = (0, Config_1.MergeConfig)(config);
            (0, CnUtils_1.CryptoUtils)(merged);
            let keys;
            try {
                keys = yield kryptokrona_utils_1.Address.fromMnemonic(mnemonicSeed, undefined, merged.addressPrefix);
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
            const wallet = yield WalletBackend.init(merged, daemon, yield keys.address(), scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
            return [wallet, undefined];
        });
    }
    /**
     * Imports a wallet from a pair of private keys.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.Daemon('127.0.0.1', 11898);
     *
     * const privateViewKey = 'ce4c27d5b135dc5310669b35e53efc9d50d92438f00c76442adf8c85f73f1a01';
     * const privateSpendKey = 'f1b1e9a6f56241594ddabb243cdb39355a8b4a1a1c0343dde36f3b57835fe607';
     *
     * const [wallet, err] = await WB.WalletBackend.importWalletFromSeed(daemon, 100000, privateViewKey, privateSpendKey);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the Daemon interface.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     *
     * @param privateViewKey    The private view key to import. Should be a 64 char hex string.
     *
     * @param privateSpendKey   The private spend key to import. Should be a 64 char hex string.
     * @param config
     */
    static importWalletFromKeys(daemon, scanHeight = 0, privateViewKey, privateSpendKey, config) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function importWalletFromKeys called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertNumber)(scanHeight, 'scanHeight');
            (0, Assert_1.assertString)(privateViewKey, 'privateViewKey');
            (0, Assert_1.assertString)(privateSpendKey, 'privateSpendKey');
            if (!(0, Utilities_1.isHex64)(privateViewKey) || !(0, Utilities_1.isHex64)(privateSpendKey)) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT)];
            }
            const merged = (0, Config_1.MergeConfig)(config);
            (0, CnUtils_1.CryptoUtils)(merged);
            let keys;
            try {
                keys = yield kryptokrona_utils_1.Address.fromKeys(privateSpendKey, privateViewKey, merged.addressPrefix);
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
            const wallet = yield WalletBackend.init(merged, daemon, yield keys.address(), scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
            return [wallet, undefined];
        });
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
     * const daemon = new WB.Daemon('127.0.0.1', 11898);
     *
     * const privateViewKey = 'ce4c27d5b135dc5310669b35e53efc9d50d92438f00c76442adf8c85f73f1a01';
     *
     * const address = 'TRTLv2Fyavy8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyoBh4wW';
     *
     * const [wallet, err] = await WB.WalletBackend.importViewWallet(daemon, 100000, privateViewKey, address);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the Daemon interface.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     * @param privateViewKey    The private view key of this view wallet. Should be a 64 char hex string.
     *
     * @param address       The public address of this view wallet.
     * @param config
     */
    static importViewWallet(daemon, scanHeight = 0, privateViewKey, address, config) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function importViewWallet called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertNumber)(scanHeight, 'scanHeight');
            (0, Assert_1.assertString)(privateViewKey, 'privateViewKey');
            (0, Assert_1.assertString)(address, 'address');
            if (!(0, Utilities_1.isHex64)(privateViewKey)) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT)];
            }
            (0, CnUtils_1.CryptoUtils)((0, Config_1.MergeConfig)(config));
            const integratedAddressesAllowed = false;
            const err = yield (0, ValidateParameters_1.validateAddresses)(new Array(address), integratedAddressesAllowed, (0, Config_1.MergeConfig)(config));
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
            const wallet = yield WalletBackend.init((0, Config_1.MergeConfig)(config), daemon, address, scanHeight, newWallet, privateViewKey);
            return [wallet, undefined];
        });
    }
    /**
     * This method creates a new wallet instance with a random key pair.
     *
     * Example:
     * ```javascript
     * const WB = require('turtlecoin-wallet-backend');
     *
     * const daemon = new WB.Daemon('127.0.0.1', 11898);
     *
     * const wallet = await WB.WalletBackend.createWallet(daemon);
     * ```
     *
     * @param daemon        An implementation of the Daemon interface.
     * @param config
     */
    static createWallet(daemon, config) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function createWallet called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            const newWallet = true;
            const scanHeight = 0;
            const merged = (0, Config_1.MergeConfig)(config);
            (0, CnUtils_1.CryptoUtils)(merged);
            const address = yield kryptokrona_utils_1.Address.fromEntropy(undefined, undefined, merged.addressPrefix);
            return WalletBackend.init(merged, daemon, yield address.address(), scanHeight, newWallet, address.view.privateKey, address.spend.privateKey);
        });
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
    constructor(config, daemon, subWallets, walletSynchronizer) {
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
         * Should we perform auto optimization when next synced
         */
        this.shouldPerformAutoOptimize = true;
        /**
         * Are we in the middle of an optimization?
         */
        this.currentlyOptimizing = false;
        /**
         * Are we in the middle of a transaction?
         */
        this.currentlyTransacting = false;
        /**
         * We only want to submit dead node once, then reset the flag when we
         * swap node or the node comes back online.
         */
        this.haveEmittedDeadNode = false;
        /**
         * Previously prepared transactions for later sending.
         */
        this.preparedTransactions = new Map();
        this.config = config;
        this.daemon = daemon;
        this.subWallets = subWallets;
        this.walletSynchronizer = walletSynchronizer;
        this.setupEventHandlers();
        this.setupMetronomes();
        this.haveEmittedDeadNode = false;
    }
    /**
     * @param config
     * @param daemon
     * @param address
     * @param newWallet Are we creating a new wallet? If so, it will start
     *                  syncing from the current time.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Set to zero if `newWallet` is `true`.
     * @param privateViewKey
     * @param privateSpendKey   Omit this parameter to create a view wallet.
     *
     */
    static init(config, daemon, address, scanHeight, newWallet, privateViewKey, privateSpendKey) {
        return __awaiter(this, void 0, void 0, function* () {
            daemon.updateConfig(config);
            const subWallets = yield SubWallets_1.SubWallets.init(config, address, scanHeight, newWallet, privateViewKey, privateSpendKey);
            let timestamp = 0;
            if (newWallet) {
                timestamp = (0, Utilities_1.getCurrentTimestampAdjusted)(config.blockTargetTime);
            }
            const walletSynchronizer = new WalletSynchronizer_1.WalletSynchronizer(daemon, subWallets, timestamp, scanHeight, privateViewKey, config);
            const result = new WalletBackend(config, daemon, subWallets, walletSynchronizer);
            if (!result.usingNativeCrypto()) {
                Logger_1.logger.log('Wallet is not using native crypto. Syncing could be much slower than normal.', Logger_1.LogLevel.WARNING, Logger_1.LogCategory.GENERAL);
            }
            return result;
        });
    }
    /**
     * Swaps the currently connected daemon with a different one. If the wallet
     * is currently started, it will remain started after the node is swapped,
     * if it is currently stopped, it will remain stopped.
     *
     * Example:
     * ```javascript
     * const daemon = new WB.Daemon('blockapi.turtlepay.io', 443);
     * await wallet.swapNode(daemon);
     * const daemonInfo = wallet.getDaemonConnectionInfo();
     * console.log(`Connected to ${daemonInfo.ssl ? 'https://' : 'http://'}${daemonInfo.host}:${daemonInfo.port}`);
     * ```
     */
    swapNode(newDaemon) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function swapNode called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            Logger_1.logger.log(`Swapping node from ${this.daemon.getConnectionString()} to ${newDaemon.getConnectionString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.DAEMON);
            const shouldRestart = this.started;
            yield this.stop();
            /* Ensuring we don't double emit if same daemon instance is given */
            if (this.daemon !== newDaemon) {
                /* Passing through events from daemon to users */
                newDaemon.on('disconnect', () => {
                    this.emit('disconnect');
                });
                newDaemon.on('connect', () => {
                    this.emit('connect');
                });
            }
            this.daemon = newDaemon;
            this.daemon.updateConfig(this.config);
            /* Discard blocks which are stored which may cause issues, for example,
             * if we swap from a cache node to a non cache node,
             * /getGlobalIndexesForRange will fail. */
            this.discardStoredBlocks();
            this.haveEmittedDeadNode = false;
            if (shouldRestart) {
                yield this.start();
            }
        });
    }
    /**
     * Gets information on the currently connected daemon - It's host, port,
     * daemon type, and ssl presence.
     * This can be helpful if you are taking arbitary host/port from a user,
     * and wish to display the daemon type they are connecting to once we
     * have figured it out.
     * Note that the `ssl` and `daemonType` variables may have not been
     * determined yet - If you have not awaited [[start]] yet, or if the daemon
     * is having connection issues.
     *
     * For this reason, there are two additional properties - `sslDetermined`,
     * and `daemonTypeDetermined` which let you verify that we have managed
     * to contact the daemon and detect its specifics.
     *
     * Example:
     * ```javascript
     * const daemonInfo = wallet.getDaemonConnectionInfo();
     * console.log(`Connected to ${daemonInfo.ssl ? 'https://' : 'http://'}${daemonInfo.host}:${daemonInfo.port}`);
     * ```
     */
    getDaemonConnectionInfo() {
        Logger_1.logger.log('Function getDaemonConnectionInfo called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        return this.daemon.getConnectionInfo();
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
        Logger_1.logger.log('Function rescan called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
     * @param scanTimestamp The timestamp to being scanning transactions from
     */
    reset(scanHeight = 0, scanTimestamp = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function reset called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertNumber)(scanHeight, 'scanHeight');
            (0, Assert_1.assertNumber)(scanTimestamp, 'scanTimestamp');
            const shouldRestart = this.started;
            yield this.stop();
            yield this.walletSynchronizer.reset(scanHeight, scanTimestamp);
            yield this.subWallets.reset(scanHeight, scanTimestamp);
            if (shouldRestart) {
                yield this.start();
            }
            this.emit('heightchange', this.walletSynchronizer.getHeight(), this.daemon.getLocalDaemonBlockCount(), this.daemon.getNetworkBlockCount());
        });
    }
    /**
     * This function works similarly to both [[reset]] and [[rescan]].
     *
     * The difference is that while reset and rescan discard all progress before
     * the specified height, and then continues syncing from there, rewind
     * instead retains the information previous, and only removes information
     * after the rewind height.
     *
     * This can be helpful if you suspect a transaction has been missed by
     * the sync process, and want to only rescan a small section of blocks.
     *
     * Example:
     * ```javascript
     * await wallet.rewind(123456);
     * ```
     *
     * @param scanHeight The scan height to rewind to
     */
    rewind(scanHeight = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function rewind called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertNumber)(scanHeight, 'scanHeight');
            const shouldRestart = this.started;
            yield this.stop();
            yield this.walletSynchronizer.rewind(scanHeight);
            yield this.subWallets.rewind(scanHeight);
            if (shouldRestart) {
                yield this.start();
            }
            this.emit('heightchange', this.walletSynchronizer.getHeight(), this.daemon.getLocalDaemonBlockCount(), this.daemon.getNetworkBlockCount());
        });
    }
    /**
     * Adds a subwallet to the wallet container. Must not be used on a view
     * only wallet. For more information on subwallets, see https://docs.turtlecoin.lol/developer/subwallets
     *
     * Example:
     * ```javascript
     * const [address, error] = await wallet.addSubWallet();
     *
     * if (!error) {
     *      console.log(`Created subwallet with address of ${address}`);
     * }
     * ```
     *
     * @returns Returns the newly created address or an error.
     */
    addSubWallet() {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function addSubWallet called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            const currentHeight = this.walletSynchronizer.getHeight();
            return this.subWallets.addSubWallet(currentHeight);
        });
    }
    /**
     * Imports a subwallet to the wallet container. Must not be used on a view
     * only wallet. For more information on subwallets, see https://docs.turtlecoin.lol/developer/subwallets
     *
     * Example:
     * ```javascript
     * const [address, error] = await wallet.importSubWallet('c984628484a1a5eaab4cfb63831b2f8ac8c3a56af2102472ab35044b46742501');
     *
     * if (!error) {
     *      console.log(`Imported subwallet with address of ${address}`);
     * } else {
     *      console.log(`Failed to import subwallet: ${error.toString()}`);
     * }
     * ```
     *
     * @param privateSpendKey The private spend key of the subwallet to import
     * @param scanHeight The scan height to start scanning this subwallet from.
     *                   If the scan height is less than the wallets current
     *                   height, the entire wallet will be rewound to that height,
     *                   and will restart syncing. If not specified, this defaults
     *                   to the current height.
     * @returns Returns the newly created address or an error.
     */
    importSubWallet(privateSpendKey, scanHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function importSubWallet called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            const currentHeight = this.walletSynchronizer.getHeight();
            if (scanHeight === undefined) {
                scanHeight = currentHeight;
            }
            (0, Assert_1.assertString)(privateSpendKey, 'privateSpendKey');
            (0, Assert_1.assertNumber)(scanHeight, 'scanHeight');
            if (!(0, Utilities_1.isHex64)(privateSpendKey)) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT)];
            }
            const [error, address] = yield this.subWallets.importSubWallet(privateSpendKey, scanHeight);
            /* If the import height is lower than the current height then we need
             * to go back and rescan those blocks with the new subwallet. */
            if (!error) {
                if (currentHeight > scanHeight) {
                    yield this.rewind(scanHeight);
                }
            }
            /* Since we destructured the components, compiler can no longer figure
             * out it's either [string, undefined], or [undefined, WalletError] -
             * it could possibly be [string, WalletError] */
            return [error, address];
        });
    }
    /**
     * Imports a view only subwallet to the wallet container. Must not be used
     * on a non view wallet. For more information on subwallets, see https://docs.turtlecoin.lol/developer/subwallets
     *
     * Example:
     * ```javascript
     * const [address, error] = await wallet.importViewSubWallet('c984628484a1a5eaab4cfb63831b2f8ac8c3a56af2102472ab35044b46742501');
     *
     * if (!error) {
     *      console.log(`Imported view subwallet with address of ${address}`);
     * } else {
     *      console.log(`Failed to import view subwallet: ${error.toString()}`);
     * }
     * ```
     *
     * @param publicSpendKey The public spend key of the subwallet to import
     * @param scanHeight The scan height to start scanning this subwallet from.
     *                   If the scan height is less than the wallets current
     *                   height, the entire wallet will be rewound to that height,
     *                   and will restart syncing. If not specified, this defaults
     *                   to the current height.
     * @returns Returns the newly created address or an error.
     */
    importViewSubWallet(publicSpendKey, scanHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function importViewSubWallet called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            const currentHeight = this.walletSynchronizer.getHeight();
            if (scanHeight === undefined) {
                scanHeight = currentHeight;
            }
            (0, Assert_1.assertString)(publicSpendKey, 'publicSpendKey');
            (0, Assert_1.assertNumber)(scanHeight, 'scanHeight');
            if (!(0, Utilities_1.isHex64)(publicSpendKey)) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT)];
            }
            const [error, address] = yield this.subWallets.importViewSubWallet(publicSpendKey, scanHeight);
            /* If the import height is lower than the current height then we need
             * to go back and rescan those blocks with the new subwallet. */
            if (!error) {
                if (currentHeight > scanHeight) {
                    yield this.rewind(scanHeight);
                }
            }
            /* Since we destructured the components, compiler can no longer figure
             * out it's either [string, undefined], or [undefined, WalletError] -
             * it could possibly be [string, WalletError] */
            return [error, address];
        });
    }
    /**
     * Removes the subwallet specified from the wallet container. If you have
     * not backed up the private keys for this subwallet, all funds in it
     * will be lost.
     *
     * Example:
     * ```javascript
     * const error = await wallet.deleteSubWallet('TRTLv2txGW8daTunmAVV6dauJgEv1LezM2Hse7EUD5c11yKHsNDrzQ5UWNRmu2ToQVhDcr82ZPVXy4mU5D7w9RmfR747KeXD3UF');
     *
     * if (error) {
     *      console.log(`Failed to delete subwallet: ${error.toString()}`);
     * }
     * ```
     *
     * @param address The subwallet address to remove
     */
    deleteSubWallet(address) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function deleteSubWallet called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertString)(address, 'address');
            const err = yield (0, ValidateParameters_1.validateAddresses)(new Array(address), false, this.config);
            if (!_.isEqual(err, WalletError_1.SUCCESS)) {
                return err;
            }
            return this.subWallets.deleteSubWallet(address);
        });
    }
    /**
     * Returns the number of subwallets in this wallet.
     *
     * Example:
     * ```javascript
     * const count = wallet.getWalletCount();
     *
     * console.log(`Wallet has ${count} subwallets`);
     * ```
     */
    getWalletCount() {
        Logger_1.logger.log('Function getWalletCount called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        return this.subWallets.getWalletCount();
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
        Logger_1.logger.log('Function getSyncStatus called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
        Logger_1.logger.log('Function toJSONString called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
        Logger_1.logger.log('Function scanCoinbaseTransactions called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        (0, Assert_1.assertBoolean)(shouldScan, 'shouldScan');
        /* We are not currently scanning coinbase transactions, and the caller
         * just turned it on. So, we need to discard stored blocks that don't
         * have the coinbase transaction property. */
        if (!this.config.scanCoinbaseTransactions && shouldScan) {
            this.discardStoredBlocks();
        }
        this.config.scanCoinbaseTransactions = shouldScan;
    }
    /**
     * Only some applications need to scan pool transactions.
     * Make it easy to turn it on/off.
     * Example:
     * ```javascript
     * wallet.scanPoolTransactions(false);
     * ```
     *
     * @param shouldScan Should we scan for pool transactions?
     */
    scanPoolTransactions(shouldScan) {
        Logger_1.logger.log('Function scanPoolTransactions called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        (0, Assert_1.assertBoolean)(shouldScan, 'shouldScan');
        this.config.scanPoolTransactions = shouldScan;
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
        Logger_1.logger.log('Function setLogLevel called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
        Logger_1.logger.log('Function enableAutoOptimization called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        (0, Assert_1.assertBoolean)(shouldAutoOptimize, 'shouldAutoOptimize');
        this.autoOptimize = shouldAutoOptimize;
    }
    /**
     * Returns a string indicating the type of cryptographic functions being used.
     *
     * Example:
     * ```javascript
     * const cryptoType = wallet.getCryptoType();
     *
     * console.log(`Wallet is using the ${cryptoType} cryptographic library.`);
     * ```
     */
    getCryptoType() {
        Logger_1.logger.log('Function getCryptoType called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        const type = new kryptokrona_utils_1.Crypto().type;
        switch (type) {
            case kryptokrona_utils_1.CryptoType.NODEADDON:
                return 'C++';
            case kryptokrona_utils_1.CryptoType.JS:
                return 'js';
            case kryptokrona_utils_1.CryptoType.WASM:
                return 'wasm';
            case kryptokrona_utils_1.CryptoType.WASMJS:
                return 'wasmjs';
            case kryptokrona_utils_1.CryptoType.EXTERNAL:
                return 'user-defined';
            case kryptokrona_utils_1.CryptoType.MIXED:
                return 'mixed';
            case kryptokrona_utils_1.CryptoType.UNKNOWN:
            default:
                return 'unknown';
        }
    }
    /**
     * Returns a boolean indicating whether or not the wallet is using native crypto
     *
     * Example:
     * ```javascript
     * const native = wallet.usingNativeCrypto();
     *
     * if (native) {
     *     console.log('Wallet is using native cryptographic code.');
     * }
     * ```
     */
    usingNativeCrypto() {
        Logger_1.logger.log('Function usingNativeCrypto called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        return kryptokrona_utils_1.Crypto.isNative;
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
        Logger_1.logger.log('Function setLoggerCallback called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
        Logger_1.logger.log('Function setBlockOutputProcessFunc called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
            Logger_1.logger.log('Function start called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            if (!this.started) {
                this.started = true;
                yield this.daemon.init();
                yield Promise.all([
                    this.syncThread.start(),
                    this.daemonUpdateThread.start(),
                    this.lockedTransactionsCheckThread.start()
                ]);
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
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function stop called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            this.started = false;
            yield this.syncThread.stop();
            yield this.daemonUpdateThread.stop();
            yield this.lockedTransactionsCheckThread.stop();
        });
    }
    /**
     * Get the node fee the daemon you are connected to is charging for
     * transactions. If the daemon charges no fee, this will return `['', 0]`
     *
     * Fees returned will be zero if you have not yet awaited [[start]].
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
        Logger_1.logger.log('Function getNodeFee called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
        Logger_1.logger.log('Function getPrivateViewKey called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
        Logger_1.logger.log('Function internal called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
     * const [publicSpendKey, privateSpendKey, err] = await wallet.getSpendKeys('TRTLxyz...');
     *
     * if (err) {
     *      console.log('Failed to get spend keys for address: ' + err.toString());
     * }
     * ```
     *
     * @param address A valid address in this container, to get the spend keys of
     */
    getSpendKeys(address) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function getSpendKeys called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertString)(address, 'address');
            const integratedAddressesAllowed = false;
            const err = yield (0, ValidateParameters_1.validateAddresses)(new Array(address), integratedAddressesAllowed, this.config);
            if (!_.isEqual(err, WalletError_1.SUCCESS)) {
                return [undefined, undefined, err];
            }
            const [, publicSpendKey] = yield (0, Utilities_1.addressToKeys)(address, this.config);
            const [err2, privateSpendKey] = this.subWallets.getPrivateSpendKey(publicSpendKey);
            if (!_.isEqual(err2, WalletError_1.SUCCESS)) {
                return [undefined, undefined, err2];
            }
            return [publicSpendKey, privateSpendKey, undefined];
        });
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
        Logger_1.logger.log('Function getPrimaryAddressPrivateKeys called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        return [
            this.subWallets.getPrimaryPrivateSpendKey(),
            this.subWallets.getPrivateViewKey(),
        ];
    }
    /**
     * Get the primary address mnemonic seed. If the primary address isn't
     * a deterministic wallet, it will return a WalletError.
     *
     * Example:
     * ```javascript
     * const [seed, err] = await wallet.getMnemonicSeed();
     *
     * if (err) {
     *      console.log('Wallet is not a deterministic wallet: ' + err.toString());
     * }
     * ```
     */
    getMnemonicSeed() {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function getMnemonicSeed called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            return this.getMnemonicSeedForAddress(this.subWallets.getPrimaryAddress());
        });
    }
    /**
     * Get the mnemonic seed for the specified address. If the specified address
     * is invalid or the address isn't a deterministic wallet, it will return
     * a WalletError.
     *
     * Example:
     * ```javascript
     * const [seed, err] = await wallet.getMnemonicSeedForAddress('TRTLxyz...');
     *
     * if (err) {
     *      console.log('Address does not belong to a deterministic wallet: ' + err.toString());
     * }
     * ```
     *
     * @param address A valid address that exists in this container
     */
    getMnemonicSeedForAddress(address) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function getMnemonicSeedForAddress called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertString)(address, 'address');
            const privateViewKey = this.subWallets.getPrivateViewKey();
            const [, privateSpendKey, error] = yield this.getSpendKeys(address);
            if (error) {
                return [undefined, error];
            }
            const parsedAddr = yield kryptokrona_utils_1.Address.fromKeys(privateSpendKey, privateViewKey, this.config.addressPrefix);
            if (!parsedAddr.mnemonic) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.KEYS_NOT_DETERMINISTIC)];
            }
            return [parsedAddr.mnemonic, undefined];
        });
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
        Logger_1.logger.log('Function getPrimaryAddress called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
        Logger_1.logger.log('Function encryptWalletToString called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        (0, Assert_1.assertString)(password, 'password');
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
        Logger_1.logger.log('Function saveWalletToFile called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        (0, Assert_1.assertString)(filename, 'filename');
        (0, Assert_1.assertString)(password, 'password');
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
        Logger_1.logger.log('Function getAddresses called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
            Logger_1.logger.log('Function optimize called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
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
     * const result = await wallet.sendFusionTransactionBasic();
     *
     * if (result.success) {
     *      console.log(`Sent transaction, hash ${result.transactionHash}`);
     * } else {
     *      console.log(`Failed to send transaction: ${result.error.toString()}`);
     * }
     * ```
     */
    sendFusionTransactionBasic() {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function sendFusionTransactionBasic called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            return this.sendTransactionInternal(() => {
                return (0, Transfer_1.sendFusionTransactionBasic)(this.config, this.daemon, this.subWallets);
            }, true, true);
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
     * const result = await wallet.sendFusionTransactionAdvanced(3, undefined, 'TRTLxyz..');
     *
     * if (result.success) {
     *      console.log(`Sent transaction, hash ${result.transactionHash}, fee ${WB.prettyPrintAmount(result.fee)}`);
     * } else {
     *      console.log(`Failed to send transaction: ${result.error.toString()}`);
     * }
     * ```
     *
     * @param mixin                 The amount of input keys to hide your input with.
     *                              Your network may enforce a static mixin.
     * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
     * @param destination           The destination for the fusion transaction to be sent to.
     *                              Must be an address existing in this container.
     * @param extraData             Extra arbitrary data to include in the transaction
     */
    sendFusionTransactionAdvanced(mixin, subWalletsToTakeFrom, destination, extraData) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function sendFusionTransactionAdvanced called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertNumberOrUndefined)(mixin, 'mixin');
            (0, Assert_1.assertArrayOrUndefined)(subWalletsToTakeFrom, 'subWalletsToTakeFrom');
            (0, Assert_1.assertStringOrUndefined)(destination, 'destination');
            return this.sendTransactionInternal(() => {
                return (0, Transfer_1.sendFusionTransactionAdvanced)(this.config, this.daemon, this.subWallets, mixin, subWalletsToTakeFrom, destination, extraData);
            }, true, true);
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
     * const result = await wallet.sendTransactionBasic('TRTLxyz...', 1234);
     *
     * if (result.success) {
     *      console.log(`Sent transaction, hash ${result.transactionHash}, fee ${WB.prettyPrintAmount(result.fee)}`);
     * } else {
     *      console.log(`Failed to send transaction: ${result.error.toString()}`);
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
            Logger_1.logger.log('Function sendTransactionBasic called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertString)(destination, 'destination');
            (0, Assert_1.assertNumber)(amount, 'amount');
            (0, Assert_1.assertStringOrUndefined)(paymentID, 'paymentID');
            return this.sendTransactionInternal(() => {
                return (0, Transfer_1.sendTransactionBasic)(this.config, this.daemon, this.subWallets, destination, amount, paymentID);
            }, false, true);
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
     * const result = await wallet.sendTransactionAdvanced(
     *      destinations,
     *      undefined,
     *      undefined,
     *      'c59d157d1d96f280ece0816a8925cae8232432b7235d1fa92c70faf3064434b3'
     * );
     *
     * if (result.success) {
     *      console.log(`Sent transaction, hash ${result.transactionHash}, fee ${WB.prettyPrintAmount(result.fee)}`);
     * } else {
     *      console.log(`Failed to send transaction: ${result.error.toString()}`);
     * }
     * ```
     *
     * @param destinations          An array of destinations, and amounts to send to that
     *                              destination. Amounts are in ATOMIC units.
     * @param mixin                 The amount of input keys to hide your input with.
     *                              Your network may enforce a static mixin.
     * @param fee                   The network fee, fee per byte, or minimum fee to use with this transaction. Defaults to minimum fee.
     * @param paymentID             The payment ID to include with this transaction. Defaults to none.
     * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from. Defaults to all addresses.
     * @param changeAddress         The address to send any returned change to. Defaults to the primary address.
     *
     * @param relayToNetwork        Whether we should submit the transaction to the network or not.
     *                              If set to false, allows you to review the transaction fee before sending it.
     *                              Use [[sendPreparedTransaction]] to send a transaction that you have not
     *                              relayed to the network. Defaults to true.
     *
     * @param sendAll               Whether we should send the entire balance available. Since fee per
     *                              byte means estimating fees is difficult, we can handle that process
     *                              on your behalf. The entire balance minus fees will be sent to the
     *                              first destination address. The amount given in the first destination
     *                              address will be ignored. Any following destinations will have
     *                              the given amount sent. For example, if your destinations array was
     *                              ```
     *                              [['address1', 0], ['address2', 50], ['address3', 100]]
     *                              ```
     *                              Then address2 would be sent 50, address3 would be sent 100,
     *                              and address1 would get whatever remains of the balance
     *                              after paying node/network fees.
     *                              Defaults to false.
     * @param extraData             Extra arbitrary data to include in the transaction
     */
    sendTransactionAdvanced(destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, relayToNetwork, sendAll, extraData) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function sendTransactionAdvanced called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertArray)(destinations, 'destinations');
            (0, Assert_1.assertNumberOrUndefined)(mixin, 'mixin');
            (0, Assert_1.assertObjectOrUndefined)(fee, 'fee');
            (0, Assert_1.assertStringOrUndefined)(paymentID, 'paymentID');
            (0, Assert_1.assertArrayOrUndefined)(subWalletsToTakeFrom, 'subWalletsToTakeFrom');
            (0, Assert_1.assertStringOrUndefined)(changeAddress, 'changeAddress');
            (0, Assert_1.assertBooleanOrUndefined)(relayToNetwork, 'relayToNetwork');
            (0, Assert_1.assertBooleanOrUndefined)(sendAll, 'sendAll');
            return this.sendTransactionInternal(() => {
                return (0, Transfer_1.sendTransactionAdvanced)(this.config, this.daemon, this.subWallets, destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, relayToNetwork, sendAll, extraData);
            }, false, relayToNetwork);
        });
    }
    /**
     * Relays a previously prepared transaction to the network.
     *
     * Example:
     * ```javascript
     * const destinations = [
     *      ['TRTLxyz...', 1000],
     *      ['TRTLzyx...', 10000],
     * ];
     *
     * const creation = await wallet.sendTransactionAdvanced(
     *      destinations,
     *      undefined, // mixin
     *      undefined, // fee
     *      undefined, // payment ID
     *      undefined, // subWalletsToTakeFrom
     *      undefined, // changeAddress
     *      false // relay to network
     * );
     *
     * if (creation.success)
     *      // Inspect certain transaction properties before sending if desired
     *      if (creation.fee > 100000) {
     *          console.log('Fee is quite high! You may wish to attempt optimizing your wallet');
     *          return;
     *      }
     *
     *      const result = await wallet.sendPreparedTransaction(creation.transactionHash);
     *
     *      if (result.success) {
     *          console.log(`Sent transaction, hash ${result.transactionHash}, fee ${WB.prettyPrintAmount(result.fee)}`);
     *      } else {
     *          console.log(`Failed to relay transaction: ${result.error.toString()}`);
     *      }
     * } else {
     *      wallet.deletePreparedTransaction(creation.transactionHash);
     *      console.log(`Failed to send transaction: ${creation.error.toString()}`);
     * }
     *
     */
    sendPreparedTransaction(transactionHash) {
        Logger_1.logger.log('Function sendPreparedTransaction called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        (0, Assert_1.assertString)(transactionHash, 'transactionHash');
        const tx = this.preparedTransactions.get(transactionHash);
        if (tx === undefined) {
            return Promise.resolve({
                error: new WalletError_1.WalletError(WalletError_1.WalletErrorCode.PREPARED_TRANSACTION_NOT_FOUND),
                success: false,
            });
        }
        return this.sendTransactionInternal(() => __awaiter(this, void 0, void 0, function* () {
            const res = yield (0, Transfer_1.sendPreparedTransaction)(tx, this.subWallets, this.daemon, this.config);
            res.transactionHash = transactionHash;
            if (res.success) {
                this.preparedTransactions.delete(transactionHash);
            }
            return res;
        }), false, true);
    }
    /**
     * Relays a previously prepared transaction to the network. Data can be stored
     * client side if you wish for prepared transactions to still be usable after
     * restarting the wallet app, for example.
     *
     * Example:
     * ```javascript
     * const destinations = [
     *      ['TRTLxyz...', 1000],
     *      ['TRTLzyx...', 10000],
     * ];
     *
     * const creation = await wallet.sendTransactionAdvanced(
     *      destinations,
     *      undefined, // mixin
     *      undefined, // fee
     *      undefined, // payment ID
     *      undefined, // subWalletsToTakeFrom
     *      undefined, // changeAddress
     *      false // relay to network
     * );
     *
     * if (creation.success)
     *      // Inspect certain transaction properties before sending if desired
     *      if (creation.fee > 100000) {
     *          console.log('Fee is quite high! You may wish to attempt optimizing your wallet');
     *          return;
     *      }
     *
     *      const result = await wallet.sendRawPreparedTransaction(creation.preparedTransaction);
     *
     *      if (result.success) {
     *          console.log(`Sent transaction, hash ${result.transactionHash}, fee ${WB.prettyPrintAmount(result.fee)}`);
     *      } else {
     *          console.log(`Failed to relay transaction: ${result.error.toString()}`);
     *      }
     * } else {
     *      console.log(`Failed to send transaction: ${creation.error.toString()}`);
     *      wallet.deletePreparedTransaction(creation.transactionHash);
     * }
     *
     */
    sendRawPreparedTransaction(rawTransaction) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function sendRawPreparedTransaction called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertObject)(rawTransaction, 'rawTransaction');
            return this.sendTransactionInternal(() => __awaiter(this, void 0, void 0, function* () {
                const res = yield (0, Transfer_1.sendPreparedTransaction)(rawTransaction, this.subWallets, this.daemon, this.config);
                if (res.success && res.rawTransaction && res.rawTransaction.hash) {
                    res.transactionHash = yield res.rawTransaction.hash();
                    this.preparedTransactions.delete(res.transactionHash);
                }
                return res;
            }), false, true);
        });
    }
    /**
     * Delete a prepared transaction stored to free up RAM. Returns whether
     * the transaction was found and has been removed, or false if it was not
     * found.
     *
     * Example:
     * ```javascript
     * const destinations = [
     *      ['TRTLxyz...', 1000],
     *      ['TRTLzyx...', 10000],
     * ];
     *
     * const creation = await wallet.sendTransactionAdvanced(
     *      destinations,
     *      undefined, // mixin
     *      undefined, // fee
     *      undefined, // payment ID
     *      undefined, // subWalletsToTakeFrom
     *      undefined, // changeAddress
     *      false // relay to network
     * );
     *
     * if (creation.success)
     *      // Inspect certain transaction properties before sending if desired
     *      if (creation.fee > 100000) {
     *          console.log('Fee is quite high! You may wish to attempt optimizing your wallet');
     *          return;
     *      }
     *
     *      const result = await wallet.sendRawPreparedTransaction(creation.preparedTransaction);
     *
     *      if (result.success) {
     *          console.log(`Sent transaction, hash ${result.transactionHash}, fee ${WB.prettyPrintAmount(result.fee)}`);
     *      } else {
     *          console.log(`Failed to relay transaction: ${result.error.toString()}`);
     *      }
     * } else {
     *      console.log(`Failed to send transaction: ${creation.error.toString()}`);
     *      wallet.deletePreparedTransaction(creation.transactionHash);
     * }
     */
    deletePreparedTransaction(transactionHash) {
        Logger_1.logger.log('Function deletePreparedTransaction called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        (0, Assert_1.assertString)(transactionHash, 'transactionHash');
        return this.preparedTransactions.delete(transactionHash);
    }
    /**
     * Deletes all prepared transactions.
     *
     * Example:
     * ```javascript
     * wallet.deletePreparedTransactions();
     * ```
     *
     */
    deletePreparedTransactions() {
        Logger_1.logger.log('Function deletePreparedTransactions called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        this.preparedTransactions.clear();
    }
    /**
     * Gets all prepared transactions.
     *
     * Example:
     * ```javascript
     * const preparedTransactions = wallet.getPreparedTransactions();
     * ```
     *
     */
    getPreparedTransactions() {
        Logger_1.logger.log('Function getPreparedTransactions called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
        return Array.from(this.preparedTransactions.values());
    }
    /**
     * Get the unlocked and locked balance for the wallet container.
     *
     * Example:
     * ```javascript
     * const [unlockedBalance, lockedBalance] = await wallet.getBalance();
     * ```
     *
     * @param subWalletsToTakeFrom The addresses to check the balance of. If
     *                             not given, defaults to all addresses.
     */
    getBalance(subWalletsToTakeFrom) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function getBalance called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertArrayOrUndefined)(subWalletsToTakeFrom, 'subWalletsToTakeFrom');
            return this.subWallets.getBalance(this.daemon.getNetworkBlockCount(), subWalletsToTakeFrom);
        });
    }
    /**
     * Gets all the transactions in the wallet container unless a subWallet address is specified,
     * in which case we get only the transactions for that subWallet.
     *
     * Newer transactions are at the front of the array - Unconfirmed transactions
     * come at the very front.
     *
     * Example:
     * ```javascript
     * for (const tx of await wallet.getTransactions()) {
     *      console.log(`Transaction ${tx.hash} - ${WB.prettyPrintAmount(tx.totalAmount())} - ${tx.timestamp}`);
     * }
     * ```
     *
     * @param startIndex Index to start taking transactions from
     * @param numTransactions Number of transactions to take
     * @param includeFusions Should we include fusion transactions?
     * @param subWallet Should we only include transactions of the specified subWallet?
     */
    getTransactions(startIndex, numTransactions, includeFusions = true, subWallet) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function getTransactions called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertNumberOrUndefined)(startIndex, 'startIndex');
            (0, Assert_1.assertNumberOrUndefined)(numTransactions, 'numTransactions');
            (0, Assert_1.assertBoolean)(includeFusions, 'includeFusions');
            /* Clone the array and reverse it, newer txs first */
            const unconfirmed = (yield this.subWallets.getUnconfirmedTransactions(subWallet, includeFusions)).slice().reverse();
            /* Clone the array and reverse it, newer txs first */
            const confirmed = (yield this.subWallets.getTransactions(subWallet, includeFusions)).slice().reverse();
            const allTransactions = unconfirmed.concat(confirmed);
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
        });
    }
    /**
     * Gets the specified transaction, if it exists in this wallet container.
     *
     * Example:
     * ```javascript
     * const tx = await wallet.getTransaction('693950eeec41dc36cfc5109eba15807ce3d63eff21f1eec20a7d1bda99563b1c');
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
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function getTransaction called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertString)(hash, 'hash');
            const txs = yield this.getTransactions();
            return txs.find((tx) => tx.hash === hash);
        });
    }
    /**
     * Get the number of transactions belonging to the given subWallet. If no subWallet is given,
     * gets the total number of transactions in the wallet container. Can be used
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
     *      const tmpNumTransactions = await wallet.getNumTransactions();
     *
     *      if (numTransactions != tmpNumTransactions) {
     *          console.log(tmpNumTransactions - numTransactions + ' new transactions found!');
     *          numTransactions = tmpNumTransactions;
     *      }
     * }
     * ```
     *
     * @param subWallet Should we only count transactions of the specified subWallet?
     * @param includeFusions Should we count fusion transactions? Defaults to true.
     */
    getNumTransactions(subWallet, includeFusions = true) {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Function getNumTransactions called', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.GENERAL);
            (0, Assert_1.assertStringOrUndefined)(subWallet, 'subWallet');
            (0, Assert_1.assertBoolean)(includeFusions, 'includeFusions');
            return (yield this.subWallets.getNumTransactions(subWallet, includeFusions))
                + (yield this.subWallets.getNumUnconfirmedTransactions(subWallet, includeFusions));
        });
    }
    sendTransactionInternal(sendTransactionFunc, fusion, relayToNetwork = true) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentlyTransacting = true;
            const result = yield sendTransactionFunc();
            if (result.success) {
                if (result.prettyTransaction) {
                    const eventName = fusion ? 'createdfusiontx' : 'createdtx';
                    this.emit(eventName, result.prettyTransaction);
                    Logger_1.logger.log('Sent transaction ' + result.transactionHash, Logger_1.LogLevel.INFO, Logger_1.LogCategory.TRANSACTIONS);
                }
                else {
                    Logger_1.logger.log('Created transaction ' + result.transactionHash, Logger_1.LogLevel.INFO, Logger_1.LogCategory.TRANSACTIONS);
                }
            }
            const preparedTransaction = {
                fee: result.fee,
                paymentID: result.paymentID,
                inputs: result.inputs,
                changeAddress: result.changeAddress,
                changeRequired: result.changeRequired,
                rawTransaction: result.rawTransaction,
            };
            /* Store prepared transaction for later relaying */
            if (result.success && result.transactionHash && !relayToNetwork) {
                this.preparedTransactions.set(result.transactionHash, preparedTransaction);
            }
            this.currentlyTransacting = false;
            return {
                success: result.success,
                error: result.error,
                fee: result.fee,
                relayedToNetwork: result.success ? relayToNetwork : undefined,
                transactionHash: result.transactionHash,
                preparedTransaction: result.success ? preparedTransaction : undefined,
                destinations: result.destinations,
                nodeFee: result.nodeFee,
            };
        });
    }
    discardStoredBlocks() {
        const [scanHeight, scanTimestamp] = this.walletSynchronizer.getScanHeights();
        const newSynchronizationStatus = new SynchronizationStatus_1.SynchronizationStatus(this.walletSynchronizer.getHeight(), this.walletSynchronizer.getBlockCheckpoints(), this.walletSynchronizer.getRecentBlockHashes());
        this.walletSynchronizer = new WalletSynchronizer_1.WalletSynchronizer(this.daemon, this.subWallets, scanTimestamp, scanHeight, this.subWallets.getPrivateViewKey(), this.config, newSynchronizationStatus);
        /* Resetup event handlers */
        this.walletSynchronizer.on('heightchange', (walletHeight) => {
            this.emit('heightchange', walletHeight, this.daemon.getLocalDaemonBlockCount(), this.daemon.getNetworkBlockCount());
            this.haveEmittedDeadNode = false;
        });
        this.walletSynchronizer.on('deadnode', () => {
            if (!this.haveEmittedDeadNode) {
                this.haveEmittedDeadNode = true;
                this.emit('deadnode');
            }
        });
        this.walletSynchronizer.on('unconfirmedtx', (amount, hash) => {
            this.emit('unconfirmedtx', amount, hash);
        });
    }
    /**
     * Remove any transactions that have been cancelled
     */
    checkLockedTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            Logger_1.logger.log('Checking locked transactions...', Logger_1.LogLevel.DEBUG, [Logger_1.LogCategory.SYNC, Logger_1.LogCategory.TRANSACTIONS]);
            if (this.config.scanPoolTransactions) {
                yield this.checkPoolTransactions();
            }
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
                if (this.shouldPerformAutoOptimize && this.autoOptimize) {
                    this.performAutoOptimize()
                        .catch(error => this.emit('autoOptimizeError', error));
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
            Logger_1.logger.log(`Adding input ${input.key} with keyimage ${input.keyImage}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            this.subWallets.storeTransactionInput(publicKey, input);
        }
        /* Mark any spent key images */
        for (const [publicKey, keyImage] of txData.keyImagesToMarkSpent) {
            Logger_1.logger.log(`Marking input with keyimage ${keyImage} as spent`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
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
        if (txData.transactionsToAdd.length > 0) {
            this.shouldPerformAutoOptimize = true;
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
            const startHeight = (0, Utilities_1.getLowerBound)(blockHeight, Constants_1.GLOBAL_INDEXES_OBSCURITY);
            const endHeight = (0, Utilities_1.getUpperBound)(blockHeight, Constants_1.GLOBAL_INDEXES_OBSCURITY);
            return this.daemon.getGlobalIndexesForRange(startHeight, endHeight);
        });
    }
    checkPoolTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.walletSynchronizer.checkPoolTransactions();
            Logger_1.logger.log('Checking pool transactions ', Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
        });
    }
    /**
     * Process config.blocksPerTick stored blocks, finding transactions and
     * inputs that belong to us
     */
    processBlocks(sleep) {
        return __awaiter(this, void 0, void 0, function* () {
            /* Take the blocks to process for this tick */
            const [blocks, shouldSleep] = yield this.walletSynchronizer.fetchBlocks(this.config.blocksPerTick);
            if (blocks.length === 0) {
                if (sleep && shouldSleep) {
                    yield (0, Utilities_1.delay)(1000);
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
                const blockInputs = yield processFunction(block, this.subWallets.getPrivateViewKey(), this.subWallets.getAllSpendKeys(), this.subWallets.isViewWallet, this.config.scanCoinbaseTransactions);
                let globalIndexes = new Map();
                /* Fill in output indexes if not returned from daemon */
                for (const [, input] of blockInputs) {
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
                this.emit('heightchange', block.blockHeight, this.daemon.getLocalDaemonBlockCount(), this.daemon.getNetworkBlockCount());
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
    setupMetronomes() {
        this.syncThread = new Metronome_1.Metronome(() => this.sync(true), this.config.syncThreadInterval);
        this.daemonUpdateThread = new Metronome_1.Metronome(() => this.updateDaemonInfo(), this.config.daemonUpdateInterval);
        this.lockedTransactionsCheckThread = new Metronome_1.Metronome(() => this.checkLockedTransactions(), this.config.lockedTransactionsCheckInterval);
    }
    setupEventHandlers() {
        /* Passing through events from daemon to users */
        this.daemon.on('disconnect', () => {
            this.emit('disconnect');
        });
        this.daemon.on('connect', () => {
            this.emit('connect');
        });
        this.daemon.on('rawblock', (block) => {
            this.emit('rawblock', block);
        });
        this.daemon.on('rawtransaction', (transaction) => {
            this.emit('rawtransaction', transaction);
        });
        this.daemon.on('heightchange', (localDaemonBlockCount, networkDaemonBlockCount) => {
            this.emit('heightchange', this.walletSynchronizer.getHeight(), localDaemonBlockCount, networkDaemonBlockCount);
            this.haveEmittedDeadNode = false;
        });
        /* Compiler being really stupid and can't figure out how to fix.. */
        this.daemon.on('deadnode', () => {
            if (!this.haveEmittedDeadNode) {
                this.haveEmittedDeadNode = true;
                this.emit('deadnode');
            }
        });
        this.walletSynchronizer.initAfterLoad(this.subWallets, this.daemon, this.config);
        this.walletSynchronizer.on('heightchange', (walletHeight) => {
            this.emit('heightchange', walletHeight, this.daemon.getLocalDaemonBlockCount(), this.daemon.getNetworkBlockCount());
            this.haveEmittedDeadNode = false;
        });
        this.walletSynchronizer.on('deadnode', () => {
            if (!this.haveEmittedDeadNode) {
                this.haveEmittedDeadNode = true;
                this.emit('deadnode');
            }
        });
        this.walletSynchronizer.on('unconfirmedtx', (amount, hash) => {
            this.emit('unconfirmedtx', amount, hash);
        });
    }
    /**
     * Initialize stuff not stored in the JSON.
     */
    initAfterLoad(daemon, config) {
        this.synced = false;
        this.started = false;
        this.autoOptimize = true;
        this.shouldPerformAutoOptimize = true;
        this.currentlyOptimizing = false;
        this.currentlyTransacting = false;
        this.haveEmittedDeadNode = false;
        this.preparedTransactions = new Map();
        this.config = config;
        this.daemon = daemon;
        this.daemon.updateConfig(config);
        this.setupEventHandlers();
        this.subWallets.initAfterLoad(this.config);
        this.setupMetronomes();
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
                const result = yield this.sendFusionTransactionAdvanced(undefined, [address], address);
                if (!result.success) {
                    failCount++;
                }
                else if (result.transactionHash) {
                    this.subWallets.knownTransactions.push(result.transactionHash);
                    failCount = 0;
                    sentTransactions++;
                    hashes.push(result.transactionHash);
                }
            }
            return [sentTransactions, hashes];
        });
    }
    performAutoOptimize() {
        return __awaiter(this, void 0, void 0, function* () {
            this.shouldPerformAutoOptimize = false;
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
