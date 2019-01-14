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
    constructor(daemon, address, scanHeight, newWallet, privateViewKey, privateSpendKey) {
        super();
        /**
         * Whether our wallet is synced. Used for selectively firing the sync/desync
         * event.
         */
        this.synced = false;
        /**
         * Blocks previously downloaded that we need to process
         */
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
    /**
     * @param filename  The location of the wallet file on disk
     * @param password  The password to use to decrypt the wallet. May be blank.
     * @returns         Returns either a WalletBackend, or a WalletError if the
     *                  password was wrong, the file didn't exist, the JSON was
     *                  invalid, etc.
     *
     * This method opens a password protected wallet from a filepath.
     * The password protection follows the same format as wallet-api,
     * zedwallet-beta, and WalletBackend. It does NOT follow the same format
     * as turtle-service or zedwallet, and will be unable to open wallets
     * created with this program.
     *
     * Usage:
     * ```
     * const wallet = WalletBackend.openWalletFromFile('mywallet.wallet', 'hunter2');
     *
     * if (wallet instanceof WalletError) {
     *      console.log('Failed to open wallet: ' + wallet.toString());
     * }
     * ```
     */
    static openWalletFromFile(daemon, filename, password) {
        const walletJSON = OpenWallet_1.openWallet(filename, password);
        if (walletJSON instanceof WalletError_1.WalletError) {
            return walletJSON;
        }
        return WalletBackend.loadWalletFromJSON(daemon, walletJSON);
    }
    /**
     * @returns     Returns a WalletBackend, or a WalletError if the JSON is
     *              an invalid format
     *
     * Loads a wallet from a JSON encoded string. For the correct format for
     * the JSON to use, see https://github.com/turtlecoin/wallet-file-interaction
     *
     * Usage:
     * ```
     * const daemon = new ConventionalDaemon('127.0.0.1', 11898);
     *
     * const wallet = WalletBackend.loadWalletFromJSON(daemon, json);
     *
     * if (wallet instanceof WalletError) {
     *      console.log('Failed to load wallet: ' + wallet.toString());
     * }
     * ```
     *
     */
    static loadWalletFromJSON(daemon, json) {
        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.initAfterLoad(daemon);
            return wallet;
        }
        catch (err) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WALLET_FILE_CORRUPTED);
        }
    }
    /**
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     *
     * @returns             Returns a WalletBackend, or a WalletError if the
     *                      mnemonic is invalid or the scan height is invalid.
     *
     * Imports a wallet from a 25 word mnemonic seed.
     *
     * Usage:
     * ```
     * const daemon = new ConventionalDaemon('127.0.0.1', 11898);
     *
     * const seed = 'necklace went vials phone both haunted either eskimos ' +
     *              'dialect civilian western dabbing snout rustled balding ' +
     *              'puddle looking orbit rest agenda jukebox opened sarcasm ' +
     *              'solved eskimos';
     *
     * const wallet = WalletBackend.importWalletFromSeed(daemon, 100000, seed);
     *
     * if (wallet instanceof WalletError) {
     *      console.log('Failed to load wallet: ' + wallet.toString());
     * }
     * ```
     */
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
    /**
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     *
     * @returns             Returns a WalletBackend, or a WalletError if the
     *                      keys are invalid or the scan height is invalid.
     *
     * Imports a wallet from a pair of private keys.
     *
     * Usage:
     * ```
     * const daemon = new ConventionalDaemon('127.0.0.1', 11898);
     *
     * const privateViewKey = 'ce4c27d5b135dc5310669b35e53efc9d50d92438f00c76442adf8c85f73f1a01';
     * const privateSpendKey = 'f1b1e9a6f56241594ddabb243cdb39355a8b4a1a1c0343dde36f3b57835fe607';
     *
     * const wallet = WalletBackend.importWalletFromSeed(daemon, 100000, privateViewKey, privateSpendKey);
     *
     * if (wallet instanceof WalletError) {
     *      console.log('Failed to load wallet: ' + wallet.toString());
     * }
     * ```
     *
     */
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
    /**
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     * @param address       The public address of this view wallet
     *
     * This method imports a wallet you have previously created, in a 'watch only'
     * state. This wallet can view incoming transactions, but cannot send
     * transactions. It also cannot view outgoing transactions, so balances
     * may appear incorrect.
     * This is useful for viewing your balance whilst not risking your funds
     * or private keys being stolen.
     */
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
    /**
     * This method creates a new wallet instance with a random key pair.
     *
     * The created addresses view key will be derived in terms of the spend key,
     * i.e. it will have a mnemonic seed.
     */
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
    /**
     * Gets the wallet, local daemon, and network block count
     *
     * Usage:
     * ```
     * let [walletBlockCount, localDaemonBlockCount, networkBlockCount] =
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
     * Most people don't mine blocks, so by default we don't scan them. If
     * you want to scan them, flip it on/off here.
     */
    scanCoinbaseTransactions(shouldScan) {
        Config_1.default.scanCoinbaseTransactions = shouldScan;
    }
    /**
     * Converts the wallet into a JSON string. This can be used to later restore
     * the wallet with `loadWalletFromJSON`.
     */
    toJSONString() {
        return JSON.stringify(this, null, 4);
    }
    /**
     * Sets the log level. Log messages below this level are not shown.
     */
    setLogLevel(logLevel) {
        Logger_1.logger.setLogLevel(logLevel);
    }
    /**
     * @param callback The callback to use for log messages
     * @param callback.prettyMessage A nicely formatted log message, with timestamp, levels, and categories
     * @param callback.message       The raw log message
     * @param callback.level         The level at which the message was logged at
     * @param callback.categories    The categories this log message falls into
     *
     * Sets a callback to be used instead of console.log for more fined control
     * of the logging output.
     *
     * Usage:
     * ```
     * wallet.setLoggerCallback((prettyMessage, message, level, categories) => {
     *       if (categories.includes(LogCategory.SYNC)) {
     *           console.log(prettyMessage);
     *       }
     *   });
     * ```
     *
     */
    setLoggerCallback(callback) {
        Logger_1.logger.setLoggerCallback(callback);
    }
    /**
     * Initializes and starts the wallet sync process. You should call this
     * function before enquiring about daemon info or fee info. The wallet will
     * not process blocks until you call this method.
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.daemon.init();
            this.mainLoopExecutor.start();
        });
    }
    /**
     * The inverse of the start() method, this pauses the blockchain sync
     * process.
     */
    stop() {
        this.mainLoopExecutor.stop();
    }
    /**
     * Get the node fee the daemon you are connected to is charging for
     * transactions. If the daemon charges no fee, this will return `['', 0]`
     *
     * @returns Returns the node fee address, and the node fee amount, in
     *          atomic units
     */
    getNodeFee() {
        return this.daemon.nodeFee();
    }
    /**
     * Gets the shared private view key for this wallet container.
     */
    getPrivateViewKey() {
        return this.subWallets.getPrivateViewKey();
    }
    /**
     * Gets the publicSpendKey and privateSpendKey for the given address, if
     * possible.
     *
     * Note: secret key will be 00000... (64 zeros) if view wallet.
     *
     * @return Returns either the public and private spend key, or a WalletError
     *         if the address doesn't exist or is invalid
     */
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
    /**
     * Get the private spend and private view for the primary address.
     * The primary address is the first created wallet in the container.
     */
    getPrimaryAddressPrivateKeys() {
        return [this.subWallets.getPrimaryPrivateSpendKey(), this.getPrivateViewKey()];
    }
    /**
     * Get the primary address mnemonic seed. If the primary address isn't
     * a deterministic wallet, it will return a WalletError.
     */
    getMnemonicSeed() {
        return this.getMnemonicSeedForAddress(this.subWallets.getPrimaryAddress());
    }
    /**
     * Get the mnemonic seed for the specified address. If the specified address
     * is invalid or the address isn't a deterministic wallet, it will return
     * a WalletError.
     */
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
    /**
     * Gets the primary address of a wallet container.
     * The primary address is the address that was created first in the wallet
     * container.
     */
    getPrimaryAddress() {
        return this.subWallets.getPrimaryAddress();
    }
    /**
     * Save the wallet to the given filename. Password may be empty, but
     * filename must not be.
     * This will take some time - it runs 500,000 iterations of pbkdf2.
     */
    saveWalletToFile(filename, password) {
    }
    /**
     * Downloads blocks from the daemon and stores them in `this.blocksToProcess`
     * for later processing. Checks if we are synced and fires the sync/desync
     * event.
     */
    fetchAndStoreBlocks() {
        return __awaiter(this, void 0, void 0, function* () {
            const walletHeight = this.walletSynchronizer.getHeight();
            const networkHeight = this.daemon.getNetworkBlockCount();
            if (walletHeight >= networkHeight) {
                /* Yay, synced with the network */
                if (!this.synced) {
                    this.emit('sync', walletHeight, networkHeight);
                    this.synced = true;
                }
                const lockedTransactionHashes = this.subWallets.getLockedTransactionHashes();
                const cancelledTransactions = yield this.walletSynchronizer.findCancelledTransactions(lockedTransactionHashes);
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
            const daemonInfo = this.daemon.updateDaemonInfo();
            this.blocksToProcess = yield this.walletSynchronizer.getBlocks();
            yield daemonInfo;
            /* Sleep for a second (not blocking the event loop) before
               continuing processing */
            yield Utilities_1.delay(Config_1.default.blockFetchInterval);
        });
    }
    /**
     * Stores any transactions, inputs, and spend keys images
     */
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
            Logger_1.logger.log('Adding input ' + input.key, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            this.subWallets.storeTransactionInput(publicKey, input);
        }
        /* Mark any spent key images */
        for (const [publicKey, keyImage] of txData.keyImagesToMarkSpent) {
            this.subWallets.markInputAsSpent(publicKey, keyImage, blockHeight);
        }
    }
    /**
     * Process config.blocksPerTick stored blocks, finding transactions and
     * inputs that belong to us
     */
    processBlocks() {
        return __awaiter(this, void 0, void 0, function* () {
            /* Take the blocks to process for this tick */
            const blocks = _.take(this.blocksToProcess, Config_1.default.blocksPerTick);
            for (const block of blocks) {
                Logger_1.logger.log('Processing block ' + block.blockHeight, Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
                /* Forked chain, remove old data */
                if (this.walletSynchronizer.getHeight() >= block.blockHeight) {
                    Logger_1.logger.log('Removing forked transactions', Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
                    this.subWallets.removeForkedTransactions(block.blockHeight);
                }
                let txData = new Types_1.TransactionData();
                /* Process the coinbase tx if we're not skipping them for speed */
                if (Config_1.default.scanCoinbaseTransactions) {
                    txData = yield this.walletSynchronizer.processCoinbaseTransaction(block.coinbaseTransaction, block.blockTimestamp, block.blockHeight, txData);
                }
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
                Logger_1.logger.log('Finished processing block ' + block.blockHeight, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            }
        });
    }
    /**
     * Main loop. Download blocks, process them.
     */
    mainLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            /* No blocks. Get some more from the daemon. */
            if (_.isEmpty(this.blocksToProcess)) {
                try {
                    yield this.fetchAndStoreBlocks();
                }
                catch (err) {
                    Logger_1.logger.log('Error fetching blocks: ' + err.toString(), Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
                }
                return;
            }
            try {
                yield this.processBlocks();
            }
            catch (err) {
                Logger_1.logger.log('Error processing blocks: ' + err.toString(), Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.SYNC);
            }
        });
    }
    /**
     * Converts recursively to JSON. Should be used in conjuction with JSON.stringify.
     * Usage:
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
    initAfterLoad(daemon) {
        this.daemon = daemon;
        this.walletSynchronizer.initAfterLoad(this.subWallets, daemon);
    }
}
exports.WalletBackend = WalletBackend;
