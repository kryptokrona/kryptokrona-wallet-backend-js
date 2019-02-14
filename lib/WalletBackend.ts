// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import deepEqual = require('deep-equal');

import { EventEmitter } from 'events';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as pbkdf2 from 'pbkdf2';

import { IDaemon } from './IDaemon';
import { Metronome } from './Metronome';
import { SubWallets } from './SubWallets';
import { openWallet } from './OpenWallet';
import { CryptoUtils} from './CnUtils';
import { WalletBackendJSON } from './JsonSerialization';
import { validateAddresses } from './ValidateParameters';
import { WalletSynchronizer } from './WalletSynchronizer';
import { Config, MergeConfig, IConfig } from './Config';
import { LogCategory, logger, LogLevel } from './Logger';
import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';
import { sendTransactionAdvanced, sendTransactionBasic } from './Transfer';
import { Block, Transaction, TransactionData, TransactionInput } from './Types';

import {
    IS_A_WALLET_IDENTIFIER, IS_CORRECT_PASSWORD_IDENTIFIER,
    PBKDF2_ITERATIONS, WALLET_FILE_FORMAT_VERSION,
    GLOBAL_INDEXES_OBSCURITY,
} from './Constants';

import {
    addressToKeys, delay, getCurrentTimestampAdjusted, isHex64,
    getLowerBound, getUpperBound,
} from './Utilities';

export declare interface WalletBackend {

    /**
     * This is emitted whenever the wallet finds a new transaction.
     *
     * See the incomingtx and outgoingtx events if you need more fine grained control.
     *
     * Usage:
     *
     * ```
     * wallet.on('transaction', (transaction) => {
     *     console.log(`Transaction of ${transaction.totalAmount()} received!`);
     * }
     * ```
     *
     * @event
     */
    on(event: 'transaction', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet finds an incoming transaction.
     *
     * Usage:
     *
     * ```
     * wallet.on('incomingtx', (transaction) => {
     *     console.log(`Incoming transaction of ${transaction.totalAmount()} received!`);
     * }
     * ```
     *
     * @event
     */
    on(event: 'incomingtx', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet finds an outgoing transaction.
     *
     * Usage:
     *
     * ```
     * wallet.on('outgoingtx', (transaction) => {
     *     console.log(`Outgoing transaction of ${transaction.totalAmount()} received!`);
     * }
     * ```
     *
     * @event
     */
    on(event: 'outgoingtx', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet finds a fusion transaction.
     *
     * Usage:
     *
     * ```
     * wallet.on('fusiontx', (transaction) => {
     *     console.log('Fusion transaction found!');
     * }
     * ```
     *
     * @event
     */
    on(event: 'fusiontx', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet first syncs with the network. It will
     * also be fired if the wallet unsyncs from the network, then resyncs.
     *
     * Usage:
     *
     * ```
     * wallet.on('sync', (walletHeight, networkHeight) => {
     *     console.log(`Wallet synced! Wallet height: ${walletHeight}, Network height: ${networkHeight}`);
     * }
     * ```
     *
     * @event
     */
    on(event: 'sync', callback: (walletHeight: number, networkHeight: number) => void): this;

    /**
     * This is emitted whenever the wallet first desyncs with the network. It will
     * only be fired after the wallet has initially fired the sync event.
     *
     * Usage:
     *
     * ```
     * wallet.on('desync', (walletHeight, networkHeight) => {
     *     console.log(`Wallet is no longer synced! Wallet height: ${walletHeight}, Network height: ${networkHeight}`);
     * }
     * ```
     *
     * @event
     */
    on(event: 'desync', callback: (walletHeight: number, networkHeight: number) => void): this;
}

/**
 * The WalletBackend provides an interface that allows you to synchronize
 * with a daemon, download blocks, process them, and pick out transactions that
 * belong to you.
 * It also allows you to inspect these transactions, view your balance,
 * send transactions, and more.
 * @noInheritDoc
 */
export class WalletBackend extends EventEmitter {

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
    public static openWalletFromFile(
        daemon: IDaemon,
        filename: string,
        password: string,
        config?: IConfig): [WalletBackend | undefined, WalletError | undefined] {

        MergeConfig(config);

        const [walletJSON, error] = openWallet(filename, password);

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
    public static loadWalletFromJSON(
        daemon: IDaemon,
        json: string,
        config?: IConfig): [WalletBackend | undefined, WalletError | undefined] {

        MergeConfig(config);

        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.initAfterLoad(daemon);
            return [wallet, undefined];
        } catch (err) {
            return [undefined, new WalletError(WalletErrorCode.WALLET_FILE_CORRUPTED)];
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
    public static importWalletFromSeed(
        daemon: IDaemon,
        scanHeight: number,
        mnemonicSeed: string,
        config?: IConfig): [WalletBackend | undefined, WalletError | undefined] {

        MergeConfig(config);

        let keys;

        try {
            keys = CryptoUtils().createAddressFromMnemonic(mnemonicSeed);
        } catch (err) {
            return [undefined, new WalletError(WalletErrorCode.INVALID_MNEMONIC, err.toString())];
        }

        if (scanHeight < 0) {
            return [undefined, new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN)];
        }

        if (!Number.isInteger(scanHeight)) {
            return [undefined, new WalletError(WalletErrorCode.NON_INTEGER_GIVEN)];
        }

        /* Can't sync from the current scan height, not newly created */
        const newWallet: boolean = false;

        const wallet = new WalletBackend(
            daemon, keys.address, scanHeight, newWallet, keys.view.privateKey,
            keys.spend.privateKey,
        );

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
    public static importWalletFromKeys(
        daemon: IDaemon,
        scanHeight: number,
        privateViewKey: string,
        privateSpendKey: string,
        config?: IConfig): [WalletBackend | undefined, WalletError | undefined] {

        MergeConfig(config);

        if (!isHex64(privateViewKey) || !isHex64(privateSpendKey)) {
            return [undefined, new WalletError(WalletErrorCode.INVALID_KEY_FORMAT)];
        }

        let keys;

        try {
            keys = CryptoUtils().createAddressFromKeys(privateSpendKey, privateViewKey);
        } catch (err) {
            return [undefined, new WalletError(WalletErrorCode.INVALID_KEY_FORMAT, err.toString())];
        }

        if (scanHeight < 0) {
            return [undefined, new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN)];
        }

        if (!Number.isInteger(scanHeight)) {
            return [undefined, new WalletError(WalletErrorCode.NON_INTEGER_GIVEN)];
        }

        /* Can't sync from the current scan height, not newly created */
        const newWallet: boolean = false;

        const wallet = new WalletBackend(
            daemon, keys.address, scanHeight, newWallet, keys.view.privateKey,
            keys.spend.privateKey,
        );

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
    public static importViewWallet(
        daemon: IDaemon,
        scanHeight: number,
        privateViewKey: string,
        address: string,
        config?: IConfig): [WalletBackend | undefined, WalletError | undefined] {

        MergeConfig(config);

        if (!isHex64(privateViewKey)) {
            return [undefined, new WalletError(WalletErrorCode.INVALID_KEY_FORMAT)];
        }

        const integratedAddressesAllowed: boolean = false;

        const err: WalletError = validateAddresses(
            new Array(address), integratedAddressesAllowed,
        );

        if (!deepEqual(err, SUCCESS)) {
            return [undefined, err];
        }

        if (scanHeight < 0) {
            return [undefined, new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN)];
        }

        if (!Number.isInteger(scanHeight)) {
            return [undefined, new WalletError(WalletErrorCode.NON_INTEGER_GIVEN)];
        }

        /* Can't sync from the current scan height, not newly created */
        const newWallet: boolean = false;

        const wallet = new WalletBackend(
            daemon, address, scanHeight, newWallet, privateViewKey,
            undefined, /* No private spend key */
        );

        return [wallet, undefined];
    }

    /**
     * This method creates a new wallet instance with a random key pair.
     *
     * The created addresses view key will be derived in terms of the spend key,
     * i.e. it will have a mnemonic seed.
     */
    public static createWallet(
        daemon: IDaemon,
        config?: IConfig): WalletBackend {

        MergeConfig(config);

        const newWallet: boolean = true;

        const scanHeight: number = 0;

        const keys = CryptoUtils().createNewAddress();

        const wallet = new WalletBackend(
            daemon, keys.address, scanHeight, newWallet, keys.view.privateKey,
            keys.spend.privateKey,
        );

        return wallet;
    }

    /* Utility function for nicer JSON parsing function */
    private static reviver(key: string, value: any): any {
        return key === '' ? WalletBackend.fromJSON(value) : value;
    }

    /* Loads a wallet from a WalletBackendJSON */
    private static fromJSON(json: WalletBackendJSON): WalletBackend {
        const wallet = Object.create(WalletBackend.prototype);

        const version = json.walletFileFormatVersion;

        if (version !== WALLET_FILE_FORMAT_VERSION) {
            throw new Error('Unsupported wallet file format version!');
        }

        return Object.assign(wallet, {
            subWallets: SubWallets.fromJSON(json.subWallets),
            walletSynchronizer: WalletSynchronizer.fromJSON(json.walletSynchronizer),
        });
    }

    /**
     *  Contains private keys, transactions, inputs, etc
     */
    private readonly subWallets: SubWallets;

    /**
     * Interface to either a regular daemon or a blockchain cache api
     */
    private daemon: IDaemon;

    /**
     * Wallet synchronization state
     */
    private walletSynchronizer: WalletSynchronizer;

    /**
     * Executes the main loop every n seconds for us
     */
    private syncThread: Metronome;

    /**
     * Update daemon info every n seconds
     */
    private daemonUpdateThread: Metronome;

    /**
     * Check on locked tx status every n seconds
     */
    private lockedTransactionsCheckThread: Metronome;

    /**
     * Whether our wallet is synced. Used for selectively firing the sync/desync
     * event.
     */
    private synced: boolean = false;

    /**
     * Blocks previously downloaded that we need to process
     */
    private blocksToProcess: Block[] = [];

    /**
     * Have we started the mainloop
     */
    private started: boolean = false;

    /**
     * External function to process a blocks outputs.
     */
    private externalBlockProcessFunction?: (
        block: Block,
        privateViewKey: string,
        spendKeys: Array<[string, string]>,
        isViewWallet: boolean,
        processCoinbaseTransactions: boolean,
    ) => Array<[string, TransactionInput]>;

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
    private constructor(
        daemon: IDaemon,
        address: string,
        scanHeight: number,
        newWallet: boolean,
        privateViewKey: string,
        privateSpendKey?: string) {

        super();

        this.subWallets = new SubWallets(
            address, scanHeight, newWallet, privateViewKey, privateSpendKey,
        );

        let timestamp = 0;

        if (newWallet) {
            timestamp = getCurrentTimestampAdjusted();
        }

        this.walletSynchronizer = new WalletSynchronizer(
            daemon, this.subWallets, timestamp, scanHeight, privateViewKey,
        );

        this.daemon = daemon;

        this.syncThread = new Metronome(
            () => this.sync(),
            Config.syncThreadInterval,
        );

        this.daemonUpdateThread = new Metronome(
            () => this.updateDaemonInfo(),
            Config.daemonUpdateInterval,
        );

        this.lockedTransactionsCheckThread = new Metronome(
            () => this.checkLockedTransactions(),
            Config.lockedTransactionsCheckInterval,
        );
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
    public getSyncStatus(): [number, number, number] {
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
    public scanCoinbaseTransactions(shouldScan: boolean) {
        Config.scanCoinbaseTransactions = shouldScan;
    }

    /**
     * Converts the wallet into a JSON string. This can be used to later restore
     * the wallet with `loadWalletFromJSON`.
     */
    public toJSONString(): string {
        return JSON.stringify(this, null, 4);
    }

    /**
     * Sets the log level. Log messages below this level are not shown.
     */
    public setLogLevel(logLevel: LogLevel): void {
        logger.setLogLevel(logLevel);
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
    public setLoggerCallback(
        callback: (prettyMessage: string,
                   message: string,
                   level: LogLevel,
                   categories: LogCategory[]) => any): void {

        logger.setLoggerCallback(callback);
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
    public setBlockOutputProcessFunc(func: (
            block: Block,
            privateViewKey: string,
            spendKeys: Array<[string, string]>,
            isViewWallet: boolean,
            processCoinbaseTransactions: boolean,
        ) => Array<[string, TransactionInput]>) {
        this.externalBlockProcessFunction = func;
    }

    /**
     * Initializes and starts the wallet sync process. You should call this
     * function before enquiring about daemon info or fee info. The wallet will
     * not process blocks until you call this method.
     */
    public async start(): Promise<void> {
        if (!this.started) {
            await this.daemon.init();

            this.syncThread.start();
            this.daemonUpdateThread.start();
            this.lockedTransactionsCheckThread.start();

            this.started = true;
        }
    }

    /**
     * The inverse of the start() method, this pauses the blockchain sync
     * process.
     */
    public stop(): void {
        this.syncThread.stop();
        this.daemonUpdateThread.stop();
        this.lockedTransactionsCheckThread.stop();
    }

    /**
     * Get the node fee the daemon you are connected to is charging for
     * transactions. If the daemon charges no fee, this will return `['', 0]`
     *
     * @returns Returns the node fee address, and the node fee amount, in
     *          atomic units
     */
    public getNodeFee(): [string, number] {
        return this.daemon.nodeFee();
    }

    /**
     * Gets the shared private view key for this wallet container.
     */
    public getPrivateViewKey(): string {
        return this.subWallets.getPrivateViewKey();
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
    public getSpendKeys(address: string): [string, string, WalletError | undefined] {
        const integratedAddressesAllowed: boolean = false;

        const err: WalletError = validateAddresses(
            new Array(address), integratedAddressesAllowed,
        );

        if (!deepEqual(err, SUCCESS)) {
            return ['', '', err];
        }

        const [publicViewKey, publicSpendKey] = addressToKeys(address);

        const [err2, privateSpendKey] = this.subWallets.getPrivateSpendKey(publicSpendKey);

        if (!deepEqual(err2, SUCCESS)) {
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
    public getPrimaryAddressPrivateKeys(): [string, string] {
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
    public getMnemonicSeed(): [string | undefined, WalletError | undefined] {
        return this.getMnemonicSeedForAddress(this.subWallets.getPrimaryAddress());
    }

    /**
     * Get the mnemonic seed for the specified address. If the specified address
     * is invalid or the address isn't a deterministic wallet, it will return
     * a WalletError.
     */
    public getMnemonicSeedForAddress(address: string): [string | undefined, WalletError | undefined] {
        const privateViewKey: string = this.getPrivateViewKey();

        const [publicSpendKey, privateSpendKey, error] = this.getSpendKeys(address);

        if (error) {
            return [undefined, error];
        }

        const parsedAddr = CryptoUtils().createAddressFromKeys(privateSpendKey, privateViewKey);

        if (!parsedAddr.mnemonic) {
            return [undefined, new WalletError(WalletErrorCode.KEYS_NOT_DETERMINISTIC)];
        }

        return [parsedAddr.mnemonic, undefined];
    }

    /**
     * Gets the primary address of a wallet container.
     * The primary address is the address that was created first in the wallet
     * container.
     */
    public getPrimaryAddress(): string {
        return this.subWallets.getPrimaryAddress();
    }

    /**
     * Save the wallet to the given filename. Password may be empty, but
     * filename must not be.
     * This will take some time - it runs 500,000 iterations of pbkdf2.
     *
     * @return Returns a boolean indicating success.
     */
    public saveWalletToFile(filename: string, password: string): boolean {
        /* Serialize wallet to JSON */
        const walletJson: string = JSON.stringify(this);

        /* Append the identifier so we can verify the password is correct */
        const data: Buffer = Buffer.concat([
            IS_CORRECT_PASSWORD_IDENTIFIER,
            Buffer.from(walletJson),
        ]);

        /* Random salt */
        const salt: Buffer = crypto.randomBytes(16);

        /* PBKDF2 key for our encryption */
        const key: Buffer = pbkdf2.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 16, 'sha256');

        /* Encrypt with AES */
        const cipher = crypto.createCipheriv('aes-128-cbc', key, salt);

        /* Perform the encryption */
        const encryptedData: Buffer = Buffer.concat([
            cipher.update(data),
            cipher.final(),
        ]);

        /* Write the wallet identifier to the file so we know it's a wallet file.
           Write the salt so it can be decrypted again */
        const fileData: Buffer = Buffer.concat([
            IS_A_WALLET_IDENTIFIER,
            salt,
            encryptedData,
        ]);

        try {
            fs.writeFileSync(filename, fileData);
            return true;
        } catch (err) {
            logger.log(
                'Failed to write file: ' + err.toString(),
                LogLevel.ERROR,
                [LogCategory.FILESYSTEM, LogCategory.SAVE],
            );

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
    public async sendTransactionBasic(
        destination: string,
        amount: number,
        paymentID?: string): Promise<[string | undefined, WalletError | undefined]> {

        return sendTransactionBasic(
            this.daemon, this.subWallets, destination, amount, paymentID,
        );
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
    public sendTransactionAdvanced(
        destinations: Array<[string, number]>,
        mixin?: number,
        fee?: number,
        paymentID?: string,
        subWalletsToTakeFrom?: string[],
        changeAddress?: string): Promise<[string | undefined, WalletError | undefined]> {

        return sendTransactionAdvanced(
            this.daemon, this.subWallets, destinations, mixin, fee, paymentID,
            subWalletsToTakeFrom, changeAddress,
        );
    }

    /**
     * Get the unlocked and locked balance for the wallet container.
     *
     * @param subWalletsToTakeFrom The addresses to check the balance of. If
     *                             not given, defaults to all addresses.
     *
     * @return Returns [unlockedBalance, lockedBalance]
     */
    public getBalance(subWalletsToTakeFrom?: string[]): [number, number] {
        return this.subWallets.getBalance(
            this.daemon.getNetworkBlockCount(),
            subWalletsToTakeFrom,
        );
    }

    /**
     * Get all transactions in a wallet container
     */
    public getTransactions(): Transaction[] {
        return this.subWallets.getUnconfirmedTransactions().concat(
               this.subWallets.getTransactions(),
        );
    }

    /**
     * Get the number of transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
     */
    public getNumTransactions(): number {
        return this.subWallets.getNumTransactions()
             + this.subWallets.getNumUnconfirmedTransactions();
    }

    /**
     * Remove any transactions that have been cancelled
     */
    private async checkLockedTransactions(): Promise<void> {
        logger.log(
            'Checking locked transactions...',
            LogLevel.DEBUG,
            [LogCategory.SYNC, LogCategory.TRANSACTIONS],
        );

        const lockedTransactionHashes: string[] = this.subWallets.getLockedTransactionHashes();

        const cancelledTransactions: string[]
            = await this.walletSynchronizer.findCancelledTransactions(lockedTransactionHashes);

        for (const cancelledTX of cancelledTransactions) {
            this.subWallets.removeCancelledTransaction(cancelledTX);
        }
    }

    /**
     * Update daemon status
     */
    private async updateDaemonInfo(): Promise<void> {
        logger.log(
            'Updating daemon info...',
            LogLevel.DEBUG,
            LogCategory.DAEMON,
        );

        this.daemon.updateDaemonInfo();

        const walletHeight: number = this.walletSynchronizer.getHeight();
        const networkHeight: number = this.daemon.getNetworkBlockCount();

        if (walletHeight >= networkHeight) {

            /* Yay, synced with the network */
            if (!this.synced) {
                this.emit('sync', walletHeight, networkHeight);
                this.synced = true;
            }
        } else {

            /* We are no longer synced :( */
            if (this.synced) {
                this.emit('desync', walletHeight, networkHeight);
                this.synced = false;
            }
        }
    }

    /**
     * Downloads blocks from the daemon and stores them in `this.blocksToProcess`
     * for later processing. Checks if we are synced and fires the sync/desync
     * event.
     */
    private async fetchAndStoreBlocks(): Promise<void> {
        /* Don't get blocks if we're synced already */
        const walletHeight: number = this.walletSynchronizer.getHeight();
        const networkHeight: number = this.daemon.getNetworkBlockCount();

        if (walletHeight >= networkHeight) {
            logger.log(
                `Wallet fully synced (${walletHeight} / ${networkHeight}). Not fetching blocks.`,
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            return;
        }

        this.blocksToProcess = await this.walletSynchronizer.getBlocks();
    }

    /**
     * Stores any transactions, inputs, and spend keys images
     */
    private storeTxData(txData: TransactionData, blockHeight: number): void {
        /* Store any transactions */
        for (const transaction of txData.transactionsToAdd) {

            logger.log(
                'Adding transaction ' + transaction.hash,
                LogLevel.INFO,
                [LogCategory.SYNC, LogCategory.TRANSACTIONS],
            );

            this.subWallets.addTransaction(transaction);

            /* Alert listeners we've got a transaction */
            this.emit('transaction', transaction);

            if (transaction.totalAmount() > 0) {
                this.emit('incomingtx', transaction);
            } else if (transaction.totalAmount() < 0) {
                this.emit('outgoingtx', transaction);
            } else {
                this.emit('fusiontx', transaction);
            }
        }

        /* Store any corresponding inputs */
        for (const [publicKey, input] of txData.inputsToAdd) {

            logger.log(
                'Adding input ' + input.key,
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

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
    private async getGlobalIndexes(blockHeight: number): Promise<Map<string, number[]>> {
        const startHeight: number = getLowerBound(blockHeight, GLOBAL_INDEXES_OBSCURITY);
        const endHeight: number = getUpperBound(blockHeight, GLOBAL_INDEXES_OBSCURITY);

        return this.daemon.getGlobalIndexesForRange(
            startHeight, endHeight,
        );
    }

    /**
     * Process Config.blocksPerTick stored blocks, finding transactions and
     * inputs that belong to us
     */
    private async processBlocks(): Promise<void> {
        /* Take the blocks to process for this tick */
        const blocks: Block[] = _.take(this.blocksToProcess, Config.blocksPerTick);

        for (const block of blocks) {

            logger.log(
                'Processing block ' + block.blockHeight,
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            /* Forked chain, remove old data */
            if (this.walletSynchronizer.getHeight() >= block.blockHeight) {

                logger.log(
                    'Removing forked transactions',
                    LogLevel.INFO,
                    LogCategory.SYNC,
                );

                this.subWallets.removeForkedTransactions(block.blockHeight);
            }

            /* User can supply us a function to do the processing, possibly
               utilizing native code for moar speed */
            const processFunction = this.externalBlockProcessFunction
                                 || this.walletSynchronizer.processBlockOutputs.bind(this.walletSynchronizer);

            const blockInputs: Array<[string, TransactionInput]> = await processFunction(
                block,
                this.getPrivateViewKey(),
                this.subWallets.getAllSpendKeys(),
                this.subWallets.isViewWallet,
                Config.scanCoinbaseTransactions,
            );

            let globalIndexes: Map<string, number[]> = new Map();

            /* Fill in output indexes if not returned from daemon */
            for (const [publicKey, input] of blockInputs) {
                /* Using a daemon type which doesn't provide output indexes,
                   and not in a view wallet */
                if (!this.subWallets.isViewWallet && input.globalOutputIndex === undefined) {
                    /* Fetch the indexes if we don't have them already */
                    if (_.isEmpty(globalIndexes)) {
                        globalIndexes = await this.getGlobalIndexes(block.blockHeight);
                    }

                    /* If the indexes returned doesn't include our array, the daemon is
                       faulty. If we can't connect to the daemon, it will throw instead,
                       which we will catch further up */
                    const ourIndexes: number[] | undefined = globalIndexes.get(
                        input.parentTransactionHash,
                    );

                    if (!ourIndexes) {
                        throw new Error('Could not get global indexes from daemon! ' +
                                        'Possibly faulty/malicious daemon.');
                    }

                    input.globalOutputIndex = ourIndexes[input.transactionIndex];
                }
            }

            const txData: TransactionData = this.walletSynchronizer.processBlock(
                block, blockInputs,
            );

            /* Store the data */
            this.storeTxData(txData, block.blockHeight);

            /* Store the block hash we just processed */
            this.walletSynchronizer.storeBlockHash(block.blockHeight, block.blockHash);

            /* Remove the block we just processed */
            this.blocksToProcess = _.drop(this.blocksToProcess);

            logger.log(
                'Finished processing block ' + block.blockHeight,
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );
        }
    }

    /**
     * Main loop. Download blocks, process them.
     */
    private async sync(): Promise<void> {
        /* No blocks. Get some more from the daemon. */
        if (_.isEmpty(this.blocksToProcess)) {
            logger.log(
                'No blocks to process. Attempting to fetch more.',
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            try {
                await this.fetchAndStoreBlocks();
            } catch (err) {
                logger.log(
                    'Error fetching blocks: ' + err.toString(),
                    LogLevel.INFO,
                    LogCategory.SYNC,
                );
            }
        }

        try {
            await this.processBlocks();
        } catch (err) {
            logger.log(
                'Error processing blocks: ' + err.toString(),
                LogLevel.INFO,
                LogCategory.SYNC,
            );
        }
    }

    /**
     * Converts recursively to JSON. Should be used in conjuction with JSON.stringify.
     * Usage:
     *
     * ```
     * JSON.stringify(wallet, null, 4);
     * ```
     */
    private toJSON(): WalletBackendJSON {
        return {
            subWallets: this.subWallets.toJSON(),
            walletFileFormatVersion: WALLET_FILE_FORMAT_VERSION,
            walletSynchronizer: this.walletSynchronizer.toJSON(),
        };
    }

    /**
     * Initialize stuff not stored in the JSON.
     */
    private initAfterLoad(daemon: IDaemon): void {
        this.daemon = daemon;

        this.walletSynchronizer.initAfterLoad(this.subWallets, daemon);

        this.syncThread = new Metronome(
            () => this.sync(),
            Config.syncThreadInterval,
        );

        this.daemonUpdateThread = new Metronome(
            () => this.updateDaemonInfo(),
            Config.daemonUpdateInterval,
        );

        this.lockedTransactionsCheckThread = new Metronome(
            () => this.checkLockedTransactions(),
            Config.lockedTransactionsCheckInterval,
        );
    }
}
