// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import deepEqual = require('deep-equal');
import {EventEmitter} from 'events';
import * as _ from 'lodash';

import config from './Config';

import { CryptoUtils } from './CnUtils';
import { WALLET_FILE_FORMAT_VERSION } from './Constants';
import { IDaemon } from './IDaemon';
import { WalletBackendJSON } from './JsonSerialization';
import { LogCategory, logger, LogLevel } from './Logger';
import { Metronome } from './Metronome';
import { openWallet } from './OpenWallet';
import { SubWallets } from './SubWallets';
import { Block, Transaction, TransactionData } from './Types';
import { addressToKeys, delay, getCurrentTimestampAdjusted, isHex64 } from './Utilities';
import { validateAddresses } from './ValidateParameters';
import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';
import { WalletSynchronizer } from './WalletSynchronizer';

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
     * const wallet = WalletBackend.openWalletFromFile('mywallet.wallet', 'hunter2');
     *
     * if (wallet instanceof WalletError) {
     *      console.log('Failed to open wallet: ' + wallet.toString());
     * }
     * ```
     */
    public static openWalletFromFile(
        daemon: IDaemon,
        filename: string,
        password: string): WalletBackend | WalletError {

        const walletJSON = openWallet(filename, password);

        if (walletJSON instanceof WalletError) {
            return walletJSON as WalletError;
        }

        return WalletBackend.loadWalletFromJSON(daemon, walletJSON as string);
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
    public static loadWalletFromJSON(daemon: IDaemon, json: string): WalletBackend | WalletError {
        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.initAfterLoad(daemon);
            return wallet;
        } catch (err) {
            return new WalletError(WalletErrorCode.WALLET_FILE_CORRUPTED);
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
    public static importWalletFromSeed(
        daemon: IDaemon,
        scanHeight: number,
        mnemonicSeed: string): WalletBackend | WalletError {

        let keys;

        try {
            keys = CryptoUtils.createAddressFromMnemonic(mnemonicSeed);
        } catch (err) {
            return new WalletError(WalletErrorCode.INVALID_MNEMONIC, err.toString());
        }

        if (scanHeight < 0) {
            return new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }

        /* Can't sync from the current scan height, not newly created */
        const newWallet: boolean = false;

        const wallet = new WalletBackend(
            daemon, keys.address, scanHeight, newWallet, keys.view.privateKey,
            keys.spend.privateKey,
        );

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
    public static importWalletFromKeys(
        daemon: IDaemon,
        scanHeight: number,
        privateViewKey: string,
        privateSpendKey: string): WalletBackend | WalletError {

        if (!isHex64(privateViewKey) || !isHex64(privateSpendKey)) {
            return new WalletError(WalletErrorCode.INVALID_KEY_FORMAT);
        }

        let keys;

        try {
            keys = CryptoUtils.createAddressFromKeys(privateSpendKey, privateViewKey);
        } catch (err) {
            return new WalletError(WalletErrorCode.INVALID_KEY_FORMAT, err.toString());
        }

        if (scanHeight < 0) {
            return new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }

        /* Can't sync from the current scan height, not newly created */
        const newWallet: boolean = false;

        const wallet = new WalletBackend(
            daemon, keys.address, scanHeight, newWallet, keys.view.privateKey,
            keys.spend.privateKey,
        );

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
    public static importViewWallet(
        daemon: IDaemon,
        scanHeight: number,
        privateViewKey: string,
        address: string): WalletBackend | WalletError {

        if (!isHex64(privateViewKey)) {
            return new WalletError(WalletErrorCode.INVALID_KEY_FORMAT);
        }

        const integratedAddressesAllowed: boolean = false;

        const err: WalletError = validateAddresses(
            new Array(address), integratedAddressesAllowed,
        );

        if (!deepEqual(err, SUCCESS)) {
            return err;
        }

        if (scanHeight < 0) {
            return new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }

        /* Can't sync from the current scan height, not newly created */
        const newWallet: boolean = false;

        const wallet = new WalletBackend(
            daemon, address, scanHeight, newWallet, privateViewKey,
            undefined, /* No private spend key */
        );

        return wallet;
    }

    /**
     * This method creates a new wallet instance with a random key pair.
     *
     * The created addresses view key will be derived in terms of the spend key,
     * i.e. it will have a mnemonic seed.
     */
    public static createWallet(daemon: IDaemon): WalletBackend {
        const newWallet: boolean = true;

        const scanHeight: number = 0;

        const keys = CryptoUtils.createNewAddress();

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

        return Object.assign(wallet, json, {
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
    private mainLoopExecutor: Metronome;

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

        this.mainLoopExecutor = new Metronome(
            this.mainLoop.bind(this), config.mainLoopInterval,
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
        config.scanCoinbaseTransactions = shouldScan;
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
     * Initializes and starts the wallet sync process. You should call this
     * function before enquiring about daemon info or fee info. The wallet will
     * not process blocks until you call this method.
     */
    public async start(): Promise<void> {
        await this.daemon.init();
        this.mainLoopExecutor.start();
    }

    /**
     * The inverse of the start() method, this pauses the blockchain sync
     * process.
     */
    public stop(): void {
        this.mainLoopExecutor.stop();
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
     * @return Returns either the public and private spend key, or a WalletError
     *         if the address doesn't exist or is invalid
     */
    public getSpendKeys(address: string): WalletError | [string, string] {
        const integratedAddressesAllowed: boolean = false;

        const err: WalletError = validateAddresses(
            new Array(address), integratedAddressesAllowed,
        );

        if (!deepEqual(err, SUCCESS)) {
            return err;
        }

        const [publicViewKey, publicSpendKey] = addressToKeys(address);

        const [err2, privateSpendKey] = this.subWallets.getPrivateSpendKey(publicSpendKey);

        if (!deepEqual(err2, SUCCESS)) {
            return err2;
        }

        return [publicSpendKey, privateSpendKey];
    }

    /**
     * Get the private spend and private view for the primary address.
     * The primary address is the first created wallet in the container.
     */
    public getPrimaryAddressPrivateKeys(): [string, string] {
        return [this.subWallets.getPrimaryPrivateSpendKey(), this.getPrivateViewKey()];
    }

    /**
     * Get the primary address mnemonic seed. If the primary address isn't
     * a deterministic wallet, it will return a WalletError.
     */
    public getMnemonicSeed(): WalletError | string {
        return this.getMnemonicSeedForAddress(this.subWallets.getPrimaryAddress());
    }

    /**
     * Get the mnemonic seed for the specified address. If the specified address
     * is invalid or the address isn't a deterministic wallet, it will return
     * a WalletError.
     */
    public getMnemonicSeedForAddress(address: string): WalletError | string {
        const privateViewKey: string = this.getPrivateViewKey();

        const spendKeys = this.getSpendKeys(address);

        if (spendKeys instanceof WalletError) {
            return spendKeys as WalletError;
        }

        const parsedAddr = CryptoUtils.createAddressFromKeys(spendKeys[1], privateViewKey);

        if (!parsedAddr.mnemonic) {
            return new WalletError(WalletErrorCode.KEYS_NOT_DETERMINISTIC);
        }

        return parsedAddr.mnemonic;
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
     */
    public saveWalletToFile(filename: string, password: string) {
    }

    /**
     * Downloads blocks from the daemon and stores them in `this.blocksToProcess`
     * for later processing. Checks if we are synced and fires the sync/desync
     * event.
     */
    private async fetchAndStoreBlocks(): Promise<void> {

        const walletHeight: number = this.walletSynchronizer.getHeight();
        const networkHeight: number = this.daemon.getNetworkBlockCount();

        if (walletHeight >= networkHeight) {

            /* Yay, synced with the network */
            if (!this.synced) {
                this.emit('sync', walletHeight, networkHeight);
                this.synced = true;
            }

            const lockedTransactionHashes: string[] = this.subWallets.getLockedTransactionHashes();

            const cancelledTransactions: string[]
                = await this.walletSynchronizer.findCancelledTransactions(lockedTransactionHashes);

            for (const cancelledTX of cancelledTransactions) {
                this.subWallets.removeCancelledTransaction(cancelledTX);
            }

        } else {

            /* We are no longer synced :( */
            if (this.synced) {
                this.emit('desync', walletHeight, networkHeight);
                this.synced = false;
            }
        }

        const daemonInfo: Promise<void> = this.daemon.updateDaemonInfo();

        this.blocksToProcess = await this.walletSynchronizer.getBlocks();

        await daemonInfo;

        /* Sleep for a second (not blocking the event loop) before
           continuing processing */
        await delay(config.blockFetchInterval);
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
     * Process config.blocksPerTick stored blocks, finding transactions and
     * inputs that belong to us
     */
    private async processBlocks(): Promise<void> {
        /* Take the blocks to process for this tick */
        const blocks: Block[] = _.take(this.blocksToProcess, config.blocksPerTick);

        for (const block of blocks) {

            logger.log(
                'Processing block ' + block.blockHeight,
                LogLevel.INFO,
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

            let txData: TransactionData = new TransactionData();

            /* Process the coinbase tx if we're not skipping them for speed */
            if (config.scanCoinbaseTransactions) {
                txData = await this.walletSynchronizer.processCoinbaseTransaction(
                    block.coinbaseTransaction, block.blockTimestamp, block.blockHeight,
                    txData,
                );
            }

            /* Process the normal txs */
            for (const tx of block.transactions) {
                txData = await this.walletSynchronizer.processTransaction(
                    tx, block.blockTimestamp, block.blockHeight, txData,
                );
            }

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
    private async mainLoop(): Promise<void> {
        /* No blocks. Get some more from the daemon. */
        if (_.isEmpty(this.blocksToProcess)) {
            try {
                await this.fetchAndStoreBlocks();
            } catch (err) {
                logger.log(
                    'Error fetching blocks: ' + err.toString(),
                    LogLevel.DEBUG,
                    LogCategory.SYNC,
                );
            }

            return;
        }

        try {
            await this.processBlocks();
        } catch (err) {
            logger.log(
                'Error processing blocks: ' + err.toString(),
                LogLevel.DEBUG,
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
    }
}
