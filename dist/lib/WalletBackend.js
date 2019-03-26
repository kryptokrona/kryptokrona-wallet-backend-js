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
const crypto = require("crypto");
const fs = require("fs");
const _ = require("lodash");
const pbkdf2 = require("pbkdf2");
const Metronome_1 = require("./Metronome");
const SubWallets_1 = require("./SubWallets");
const OpenWallet_1 = require("./OpenWallet");
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
    constructor(daemon, address, scanHeight, newWallet, privateViewKey, privateSpendKey) {
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
        this.subWallets = new SubWallets_1.SubWallets(address, scanHeight, newWallet, privateViewKey, privateSpendKey);
        let timestamp = 0;
        if (newWallet) {
            timestamp = Utilities_1.getCurrentTimestampAdjusted();
        }
        this.walletSynchronizer = new WalletSynchronizer_1.WalletSynchronizer(daemon, this.subWallets, timestamp, scanHeight, privateViewKey);
        this.daemon = daemon;
        this.syncThread = new Metronome_1.Metronome(() => this.sync(true), Config_1.Config.syncThreadInterval);
        this.daemonUpdateThread = new Metronome_1.Metronome(() => this.updateDaemonInfo(), Config_1.Config.daemonUpdateInterval);
        this.lockedTransactionsCheckThread = new Metronome_1.Metronome(() => this.checkLockedTransactions(), Config_1.Config.lockedTransactionsCheckInterval);
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
     * const [wallet, error] = WalletBackend.openWalletFromFile('mywallet.wallet', 'hunter2');
     *
     * if (error) {
     *      console.log('Failed to open wallet: ' + error.toString());
     * }
     * ```
     */
    static openWalletFromFile(daemon, filename, password, config) {
        Config_1.MergeConfig(config);
        const [walletJSON, error] = OpenWallet_1.openWallet(filename, password);
        if (error) {
            return [undefined, error];
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
     * const [wallet, error] = WalletBackend.loadWalletFromJSON(daemon, json);
     *
     * if (error) {
     *      console.log('Failed to load wallet: ' + error.toString());
     * }
     * ```
     *
     */
    static loadWalletFromJSON(daemon, json, config) {
        Config_1.MergeConfig(config);
        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.initAfterLoad(daemon);
            return [wallet, undefined];
        }
        catch (err) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WALLET_FILE_CORRUPTED)];
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
     * const [wallet, error] = WalletBackend.importWalletFromSeed(daemon, 100000, seed);
     *
     * if (error) {
     *      console.log('Failed to load wallet: ' + error.toString());
     * }
     * ```
     */
    static importWalletFromSeed(daemon, scanHeight, mnemonicSeed, config) {
        Config_1.MergeConfig(config);
        let keys;
        try {
            keys = CnUtils_1.CryptoUtils().createAddressFromMnemonic(mnemonicSeed);
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
        const wallet = new WalletBackend(daemon, keys.address, scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
        return [wallet, undefined];
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
     * const [wallet, error] = WalletBackend.importWalletFromSeed(daemon, 100000, privateViewKey, privateSpendKey);
     *
     * if (error) {
     *      console.log('Failed to load wallet: ' + error.toString());
     * }
     * ```
     *
     */
    static importWalletFromKeys(daemon, scanHeight, privateViewKey, privateSpendKey, config) {
        Config_1.MergeConfig(config);
        if (!Utilities_1.isHex64(privateViewKey) || !Utilities_1.isHex64(privateSpendKey)) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT)];
        }
        let keys;
        try {
            keys = CnUtils_1.CryptoUtils().createAddressFromKeys(privateSpendKey, privateViewKey);
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
        const wallet = new WalletBackend(daemon, keys.address, scanHeight, newWallet, keys.view.privateKey, keys.spend.privateKey);
        return [wallet, undefined];
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
    static importViewWallet(daemon, scanHeight, privateViewKey, address, config) {
        Config_1.MergeConfig(config);
        if (!Utilities_1.isHex64(privateViewKey)) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.INVALID_KEY_FORMAT)];
        }
        const integratedAddressesAllowed = false;
        const err = ValidateParameters_1.validateAddresses(new Array(address), integratedAddressesAllowed);
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
        const wallet = new WalletBackend(daemon, address, scanHeight, newWallet, privateViewKey, undefined);
        return [wallet, undefined];
    }
    /**
     * This method creates a new wallet instance with a random key pair.
     *
     * The created addresses view key will be derived in terms of the spend key,
     * i.e. it will have a mnemonic seed.
     */
    static createWallet(daemon, config) {
        Config_1.MergeConfig(config);
        const newWallet = true;
        const scanHeight = 0;
        const keys = CnUtils_1.CryptoUtils().createNewAddress();
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
        return Object.assign(wallet, {
            subWallets: SubWallets_1.SubWallets.fromJSON(json.subWallets),
            walletSynchronizer: WalletSynchronizer_1.WalletSynchronizer.fromJSON(json.walletSynchronizer),
        });
    }
    /**
     * Performs the same operation as reset(), but uses the initial scan height
     * or timestamp. For example, if you created your wallet at block 800,000,
     * this method would start rescanning from then.
     */
    rescan() {
        const [scanHeight, scanTimestamp] = this.walletSynchronizer.getScanHeights();
        this.reset(scanHeight, scanTimestamp);
    }
    /**
     * Discard all transaction data, and begin scanning the wallet again
     * from the scanHeight or timestamp given. Defaults to a height of zero,
     * if not given.
     */
    reset(scanHeight = 0, scanTimestamp = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const shouldRestart = this.started;
            yield this.stop();
            yield this.walletSynchronizer.reset(scanHeight, scanTimestamp);
            yield this.subWallets.reset(scanHeight, scanTimestamp);
            if (shouldRestart) {
                this.start();
            }
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
        Config_1.Config.scanCoinbaseTransactions = shouldScan;
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
     * Provide a function to process blocks instead of the inbuilt one. The
     * only use for this is to leverage native code to provide quicker
     * cryptography functions - the default JavaScript is not that speedy.
     *
     * If you don't know what you're doing,
     * DO NOT TOUCH THIS - YOU WILL BREAK WALLET SYNCING
     *
     * Note you don't have to set the globalIndex properties on returned inputs.
     * We will fetch them from the daemon if needed. However, if you have them,
     * return them, to save us a daemon call.
     *
     * @param spendKeys An array of [publicSpendKey, privateSpendKey]
     * @param processCoinbaseTransactions Whether you should process coinbase transactions or not
     *
     */
    setBlockOutputProcessFunc(func) {
        this.externalBlockProcessFunction = func;
    }
    /**
     * Initializes and starts the wallet sync process. You should call this
     * function before enquiring about daemon info or fee info. The wallet will
     * not process blocks until you call this method.
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
     * The inverse of the start() method, this pauses the blockchain sync
     * process.
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
     * Exposes some internal functions for those who know what they're doing...
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
     * Note: secret key will be 00000... (64 zeros) if view wallet.
     *
     * Usage:
     * ```
     * const [publicSpendKey, privateSpendKey, error] = getSpendKeys('TRTLxyz...');
     * if (error) {
     *      console.log(error);
     * }
     * ```
     *
     * @return Returns either the public and private spend key, or a WalletError
     *         if the address doesn't exist or is invalid
     */
    getSpendKeys(address) {
        const integratedAddressesAllowed = false;
        const err = ValidateParameters_1.validateAddresses(new Array(address), integratedAddressesAllowed);
        if (!_.isEqual(err, WalletError_1.SUCCESS)) {
            return ['', '', err];
        }
        const [publicViewKey, publicSpendKey] = Utilities_1.addressToKeys(address);
        const [err2, privateSpendKey] = this.subWallets.getPrivateSpendKey(publicSpendKey);
        if (!_.isEqual(err2, WalletError_1.SUCCESS)) {
            return ['', '', err2];
        }
        return [publicSpendKey, privateSpendKey, undefined];
    }
    /**
     * Get the private spend and private view for the primary address.
     * The primary address is the first created wallet in the container.
     *
     * @return Returns [privateSpendKey, privateViewKey]
     */
    getPrimaryAddressPrivateKeys() {
        return [this.subWallets.getPrimaryPrivateSpendKey(), this.getPrivateViewKey()];
    }
    /**
     * Get the primary address mnemonic seed. If the primary address isn't
     * a deterministic wallet, it will return a WalletError.
     *
     * Usage:
     * ```
     * const [seed, error] = wallet.getMnemonicSeed();
     * if (error) {
     *      console.log('Wallet is not a deterministic wallet');
     * }
     * ```
     *
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
        const [publicSpendKey, privateSpendKey, error] = this.getSpendKeys(address);
        if (error) {
            return [undefined, error];
        }
        const parsedAddr = CnUtils_1.CryptoUtils().createAddressFromKeys(privateSpendKey, privateViewKey);
        if (!parsedAddr.mnemonic) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.KEYS_NOT_DETERMINISTIC)];
        }
        return [parsedAddr.mnemonic, undefined];
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
     *
     * @return Returns a boolean indicating success.
     */
    saveWalletToFile(filename, password) {
        /* Serialize wallet to JSON */
        const walletJson = JSON.stringify(this);
        /* Append the identifier so we can verify the password is correct */
        const data = Buffer.concat([
            Constants_1.IS_CORRECT_PASSWORD_IDENTIFIER,
            Buffer.from(walletJson),
        ]);
        /* Random salt */
        const salt = crypto.randomBytes(16);
        /* PBKDF2 key for our encryption */
        const key = pbkdf2.pbkdf2Sync(password, salt, Constants_1.PBKDF2_ITERATIONS, 16, 'sha256');
        /* Encrypt with AES */
        const cipher = crypto.createCipheriv('aes-128-cbc', key, salt);
        /* Perform the encryption */
        const encryptedData = Buffer.concat([
            cipher.update(data),
            cipher.final(),
        ]);
        /* Write the wallet identifier to the file so we know it's a wallet file.
           Write the salt so it can be decrypted again */
        const fileData = Buffer.concat([
            Constants_1.IS_A_WALLET_IDENTIFIER,
            salt,
            encryptedData,
        ]);
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
     * Sends a transaction of amount to the address destination, using the
     * given payment ID, if specified.
     *
     * Network fee is set to default, mixin is set to default, all subwallets
     * are taken from, primary address is used as change address.
     *
     * If you need more control, use `sendTransactionAdvanced()`
     *
     * @param destination   The address to send the funds to
     * @param amount        The amount to send, in ATOMIC units
     * @param paymentID     The payment ID to include with this transaction. Optional.
     *
     * @return Returns either an error, or the transaction hash.
     */
    sendTransactionBasic(destination, amount, paymentID) {
        return __awaiter(this, void 0, void 0, function* () {
            const [transaction, hash, error] = yield Transfer_1.sendTransactionBasic(this.daemon, this.subWallets, destination, amount, paymentID);
            if (transaction) {
                this.emit('createdtx', transaction);
            }
            return [hash, error];
        });
    }
    /**
     * Sends a transaction, which permits multiple amounts to different destinations,
     * specifying the mixin, fee, subwallets to draw funds from, and change address.
     *
     * All parameters are optional aside from destinations.
     *
     * @param destinations          An array of destinations, and amounts to send to that
     *                              destination.
     * @param mixin                 The amount of input keys to hide your input with.
     *                              Your network may enforce a static mixin.
     * @param fee                   The network fee to use with this transaction. In ATOMIC units.
     * @param paymentID             The payment ID to include with this transaction.
     * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
     * @param changeAddress         The address to send any returned change to.
     */
    sendTransactionAdvanced(destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const [transaction, hash, error] = yield Transfer_1.sendTransactionAdvanced(this.daemon, this.subWallets, destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress);
            if (transaction) {
                this.emit('createdtx', transaction);
            }
            return [hash, error];
        });
    }
    /**
     * Get the unlocked and locked balance for the wallet container.
     *
     * @param subWalletsToTakeFrom The addresses to check the balance of. If
     *                             not given, defaults to all addresses.
     *
     * @return Returns [unlockedBalance, lockedBalance]
     */
    getBalance(subWalletsToTakeFrom) {
        return this.subWallets.getBalance(this.daemon.getNetworkBlockCount(), subWalletsToTakeFrom);
    }
    /**
     * Get all transactions in a wallet container
     *
     * Newer transactions are at the front of the array - Unconfirmed transactions
     * come at the very front.
     */
    getTransactions() {
        /* Clone the array and reverse it, newer txs first */
        const unconfirmed = this.subWallets.getUnconfirmedTransactions().slice().reverse();
        /* Clone the array and reverse it, newer txs first */
        const confirmed = this.subWallets.getTransactions().slice().reverse();
        return unconfirmed.concat(confirmed);
    }
    /**
     * Gets the specified transaction, if it exists.
     */
    getTransaction(hash) {
        const txs = this.getTransactions();
        return txs.find((tx) => tx.hash === hash);
    }
    /**
     * Get the number of transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
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
     * Process Config.blocksPerTick stored blocks, finding transactions and
     * inputs that belong to us
     */
    processBlocks(sleep) {
        return __awaiter(this, void 0, void 0, function* () {
            /* Take the blocks to process for this tick */
            const blocks = yield this.walletSynchronizer.fetchBlocks(Config_1.Config.blocksPerTick);
            if (blocks.length === 0) {
                if (sleep) {
                    yield Utilities_1.delay(1000);
                }
                return;
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
                const blockInputs = yield processFunction(block, this.getPrivateViewKey(), this.subWallets.getAllSpendKeys(), this.subWallets.isViewWallet, Config_1.Config.scanCoinbaseTransactions);
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
        });
    }
    /**
     * Main loop. Download blocks, process them.
     */
    sync(sleep) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.processBlocks(sleep);
            }
            catch (err) {
                Logger_1.logger.log('Error processing blocks: ' + err.toString(), Logger_1.LogLevel.INFO, Logger_1.LogCategory.SYNC);
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
        this.syncThread = new Metronome_1.Metronome(() => this.sync(true), Config_1.Config.syncThreadInterval);
        this.daemonUpdateThread = new Metronome_1.Metronome(() => this.updateDaemonInfo(), Config_1.Config.daemonUpdateInterval);
        this.lockedTransactionsCheckThread = new Metronome_1.Metronome(() => this.checkLockedTransactions(), Config_1.Config.lockedTransactionsCheckInterval);
    }
}
exports.WalletBackend = WalletBackend;
