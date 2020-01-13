// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

// tslint:disable: max-line-length

import { EventEmitter } from 'events';
import { CreatedTransaction } from 'turtlecoin-utils';

import * as fs from 'fs';
import * as _ from 'lodash';

import { FeeType } from './FeeType';
import { IDaemon } from './IDaemon';
import { Metronome } from './Metronome';
import { SubWallets } from './SubWallets';
import { openWallet } from './OpenWallet';
import { WalletEncryption } from './WalletEncryption';
import { CryptoUtils} from './CnUtils';
import { WalletBackendJSON } from './JsonSerialization';
import { validateAddresses } from './ValidateParameters';
import { WalletSynchronizer } from './WalletSynchronizer';
import { Config, MergeConfig, IConfig } from './Config';
import { LogCategory, logger, LogLevel } from './Logger';
import { SynchronizationStatus } from './SynchronizationStatus';
import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';

import {
    Block, Transaction, TransactionData, TransactionInput, DaemonConnection,
    SendTransactionResult, PreparedTransaction, PreparedTransactionInfo,
    TxInputAndOwner,
} from './Types';

import {
    sendTransactionAdvanced, sendTransactionBasic,
    sendFusionTransactionAdvanced, sendFusionTransactionBasic,
    sendPreparedTransaction,
} from './Transfer';

import { WALLET_FILE_FORMAT_VERSION, GLOBAL_INDEXES_OBSCURITY } from './Constants';

import {
    addressToKeys, delay, getCurrentTimestampAdjusted, isHex64,
    getLowerBound, getUpperBound,
} from './Utilities';

import {
    assertStringOrUndefined, assertString, assertNumberOrUndefined, assertNumber,
    assertBooleanOrUndefined, assertBoolean, assertArrayOrUndefined, assertArray,
    assertObjectOrUndefined, assertObject,
} from './Assert';

export declare interface WalletBackend {

    /**
     * This is emitted whenever the wallet finds a new transaction.
     *
     * See the incomingtx and outgoingtx events if you need more fine grained control.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('transaction', (transaction) => {
     *     console.log(`Transaction of ${transaction.totalAmount()} received!`);
     * });
     * ```
     *
     * @event
     */
    on(event: 'transaction', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet finds an incoming transaction.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('incomingtx', (transaction) => {
     *     console.log(`Incoming transaction of ${transaction.totalAmount()} received!`);
     * });
     * ```
     *
     * @event
     */
    on(event: 'incomingtx', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet finds an outgoing transaction.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('outgoingtx', (transaction) => {
     *     console.log(`Outgoing transaction of ${transaction.totalAmount()} received!`);
     * });
     * ```
     *
     * @event
     */
    on(event: 'outgoingtx', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet finds a fusion transaction.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('fusiontx', (transaction) => {
     *     console.log('Fusion transaction found!');
     * });
     * ```
     *
     * @event
     */
    on(event: 'fusiontx', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet creates and sends a transaction.
     *
     * This is distinct from the outgoingtx event, as this event is fired when
     * we send a transaction, while outgoingtx is fired when the tx is included
     * in a block, and scanned by the wallet.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('createdtx', (transaction) => {
     *      console.log('Transaction created!');
     * });
     * ```
     *
     * @event
     */
    on(event: 'createdtx', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet creates and sends a fusion transaction.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('createdfusiontx', (transaction) => {
     *      console.log('Fusion transaction created!');
     * });
     * ```
     *
     * @event
     */
    on(event: 'createdfusiontx', callback: (transaction: Transaction) => void): this;

    /**
     * This is emitted whenever the wallet first syncs with the network. It will
     * also be fired if the wallet unsyncs from the network, then resyncs.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('sync', (walletHeight, networkHeight) => {
     *     console.log(`Wallet synced! Wallet height: ${walletHeight}, Network height: ${networkHeight}`);
     * });
     * ```
     *
     * @event
     */
    on(event: 'sync', callback: (walletHeight: number, networkHeight: number) => void): this;

    /**
     * This is emitted whenever the wallet first desyncs with the network. It will
     * only be fired after the wallet has initially fired the sync event.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('desync', (walletHeight, networkHeight) => {
     *     console.log(`Wallet is no longer synced! Wallet height: ${walletHeight}, Network height: ${networkHeight}`);
     * });
     * ```
     *
     * @event
     */
    on(event: 'desync', callback: (walletHeight: number, networkHeight: number) => void): this;

    /**
     * This is emitted whenever the wallet fails to contact the underlying daemon.
     * This event will only be emitted on the first disconnection. It will not
     * be emitted again, until the daemon connects, and then disconnects again.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('disconnect', (error) => {
     *     console.log('Possibly lost connection to daemon: ' + error.toString());
     * });
     * ```
     *
     * Note that these events will only be emitted if using the Daemon daemon
     * type, as the other daemon types are considered legacy and are not having
     * new features added.
     *
     * @event
     */
    on(event: 'disconnect', callback: (error: Error) => void): this;

    /**
     * This is emitted whenever the wallet previously failed to contact the
     * underlying daemon, and has now reconnected.
     * This event will only be emitted on the first connection. It will not
     * be emitted again, until the daemon disconnects, and then reconnects again.
     *
     * Example:
     *
     * ```javascript
     * wallet.on('connect', () => {
     *     console.log('Regained connection to daemon!');
     * });
     * ```
     *
     * Note that these events will only be emitted if using the Daemon daemon
     * type, as the other daemon types are considered legacy and are not having
     * new features added.
     *
     * @event
     */
    on(event: 'connect', callback: () => void): this;

    /**
     * This is emitted whenever the walletBlockCount (Amount of blocks the wallet has synced),
     * localDaemonBlockCount (Amount of blocks the daemon you're connected to has synced),
     * or networkBlockCount (Amount of blocks the network has) changes.
     *
     * This can be used in place of repeatedly polling [[getSyncStatus]]
     *
     * Example:
     *
     * ```javascript
     *
     * wallet.on('heightchange', (walletBlockCount, localDaemonBlockCount, networkBlockCount) => {
     *     console.log(`New sync status: ${walletBlockCount} / ${localDaemonBlockCount}`);
     * });
     * ```
     *
     * @event
     */
    on(event: 'heightchange', callback: (
        walletBlockCount: number,
        localDaemonBlockCount: number,
        networkBlockCount: number) => void): this;

    /**
     * This is emitted when we consider the node to no longer be online. There
     * are a few categories we use to determine this.
     *
     * 1) We have not recieved any data from /getwalletsyncdata since the
     *    configured timeout. (Default 3 mins)
     *
     * 2) The network height has not changed since the configured timeout
     *   (Default 3 mins)
     *
     * 3) The local daemon height has not changed since the configured timeout
     *   (Default 3 mins)
     *
     * Example:
     *
     * ```javascript
     * wallet.on('deadnode', () => {
     *     console.log('Ruh roh, looks like the daemon is dead.. maybe you want to swapNode()?');
     * });
     * ```
     *
     * @event
     */
    on(event: 'deadnode', callback: () => void): this;
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
    public static openWalletFromFile(
        daemon: IDaemon,
        filename: string,
        password: string,
        config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError] {

        logger.log(
            'Function openWalletFromFile called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(filename, 'filename');
        assertString(password, 'password');

        const [walletJSON, error] = openWallet(filename, password);

        if (error) {
            return [undefined, error];
        }

        return WalletBackend.loadWalletFromJSON(
            daemon,
            walletJSON,
            config,
        );
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
    public static openWalletFromEncryptedString(
        deamon: IDaemon,
        data: string,
        password: string,
        config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError] {

        logger.log(
            'Function openWalletFromEncryptedString called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(data, 'data');
        assertString(password, 'password');

        const [walletJSON, error] = WalletEncryption.decryptWalletFromString(data, password);

        if (error) {
            return [undefined, error];
        }

        return WalletBackend.loadWalletFromJSON(
            deamon,
            walletJSON,
            config,
        );
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
     * const [wallet, err] = WB.WalletBackend.loadWalletFromJSON(daemon, json);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface.
     *
     * @param json          Wallet info encoded as a JSON encoded string. Note
     *                      that this should be a *string*, NOT a JSON object.
     *                      This function will call `JSON.parse()`, so you should
     *                      not do that yourself.
     */
    public static loadWalletFromJSON(
        daemon: IDaemon,
        json: string,
        config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError] {

        logger.log(
            'Function loadWalletFromJSON called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(json, 'json');

        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.initAfterLoad(daemon, MergeConfig(config));
            return [wallet, undefined];
        } catch (err) {
            return [undefined, new WalletError(WalletErrorCode.WALLET_FILE_CORRUPTED)];
        }
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
     * const [wallet, err] = WB.WalletBackend.importWalletFromSeed(daemon, 100000, seed);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero if not given.
     *
     * @param mnemonicSeed  The mnemonic seed to import. Should be a 25 word string.
     */
    public static importWalletFromSeed(
        daemon: IDaemon,
        scanHeight: number = 0,
        mnemonicSeed: string,
        config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError] {

        logger.log(
            'Function importWalletFromSeed called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertNumber(scanHeight, 'scanHeight');
        assertString(mnemonicSeed, 'mnemonicSeed');

        let keys;

        try {
            keys = CryptoUtils(MergeConfig(config)).createAddressFromMnemonic(mnemonicSeed);
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
            MergeConfig(config), daemon, keys.address, scanHeight, newWallet,
            keys.view.privateKey, keys.spend.privateKey,
        );

        return [wallet, undefined];
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
     * const [wallet, err] = WB.WalletBackend.importWalletFromSeed(daemon, 100000, privateViewKey, privateSpendKey);
     *
     * if (err) {
     *      console.log('Failed to load wallet: ' + err.toString());
     * }
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     *
     * @param privateViewKey    The private view key to import. Should be a 64 char hex string.
     *
     * @param privateSpendKey   The private spend key to import. Should be a 64 char hex string.
     */
    public static importWalletFromKeys(
        daemon: IDaemon,
        scanHeight: number = 0,
        privateViewKey: string,
        privateSpendKey: string,
        config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError] {

        logger.log(
            'Function importWalletFromKeys called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertNumber(scanHeight, 'scanHeight');
        assertString(privateViewKey, 'privateViewKey');
        assertString(privateSpendKey, 'privateSpendKey');

        if (!isHex64(privateViewKey) || !isHex64(privateSpendKey)) {
            return [undefined, new WalletError(WalletErrorCode.INVALID_KEY_FORMAT)];
        }

        let keys;

        try {
            keys = CryptoUtils(MergeConfig(config)).createAddressFromKeys(privateSpendKey, privateViewKey);
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
            MergeConfig(config), daemon, keys.address, scanHeight, newWallet,
            keys.view.privateKey, keys.spend.privateKey,
        );

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
     * const daemon = new WB.Daemon('127.0.0.1', 11898);
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
     * @param daemon        An implementation of the IDaemon interface.
     *
     * @param scanHeight    The height to begin scanning the blockchain from.
     *                      This can greatly increase sync speeds if given.
     *                      Defaults to zero.
     * @param privateViewKey    The private view key of this view wallet. Should be a 64 char hex string.
     *
     * @param address       The public address of this view wallet.
     */
    public static importViewWallet(
        daemon: IDaemon,
        scanHeight: number = 0,
        privateViewKey: string,
        address: string,
        config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError] {

        logger.log(
            'Function importViewWallet called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertNumber(scanHeight, 'scanHeight');
        assertString(privateViewKey, 'privateViewKey');
        assertString(address, 'address');

        if (!isHex64(privateViewKey)) {
            return [undefined, new WalletError(WalletErrorCode.INVALID_KEY_FORMAT)];
        }

        const integratedAddressesAllowed: boolean = false;

        const err: WalletError = validateAddresses(
            new Array(address), integratedAddressesAllowed, MergeConfig(config),
        );

        if (!_.isEqual(err, SUCCESS)) {
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
            MergeConfig(config), daemon, address, scanHeight, newWallet,
            privateViewKey,
        );

        return [wallet, undefined];
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
     * const wallet = WB.WalletBackend.createWallet(daemon);
     * ```
     *
     * @param daemon        An implementation of the IDaemon interface.
     */
    public static createWallet(
        daemon: IDaemon,
        config?: IConfig): WalletBackend {

        logger.log(
            'Function createWallet called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        const newWallet: boolean = true;

        const scanHeight: number = 0;

        const keys = CryptoUtils(MergeConfig(config)).createNewAddress();

        const wallet = new WalletBackend(
            MergeConfig(config), daemon, keys.address, scanHeight, newWallet,
            keys.view.privateKey, keys.spend.privateKey,
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
    private syncThread!: Metronome;

    /**
     * Update daemon info every n seconds
     */
    private daemonUpdateThread!: Metronome;

    /**
     * Check on locked tx status every n seconds
     */
    private lockedTransactionsCheckThread!: Metronome;

    /**
     * Whether our wallet is synced. Used for selectively firing the sync/desync
     * event.
     */
    private synced: boolean = false;

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
     * Whether we should automatically keep the wallet optimized
     */
    private autoOptimize: boolean = true;

    /**
     * Should we perform auto optimization when next synced
     */
    private shouldPerformAutoOptimize: boolean = true;

    /**
     * Are we in the middle of an optimization?
     */
    private currentlyOptimizing: boolean = false;

    /**
     * Are we in the middle of a transaction?
     */
    private currentlyTransacting: boolean = false;

    private config: Config;

    /**
     * We only want to submit dead node once, then reset the flag when we
     * swap node or the node comes back online.
     */
    private haveEmittedDeadNode: boolean = false;

    /**
     * Previously prepared transactions for later sending.
     */
    private preparedTransactions: Map<string, PreparedTransaction> = new Map();

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
        config: Config,
        daemon: IDaemon,
        address: string,
        scanHeight: number,
        newWallet: boolean,
        privateViewKey: string,
        privateSpendKey?: string) {

        super();

        this.config = config;

        daemon.updateConfig(config);

        this.subWallets = new SubWallets(
            config, address, scanHeight, newWallet, privateViewKey,
            privateSpendKey,
        );

        let timestamp = 0;

        if (newWallet) {
            timestamp = getCurrentTimestampAdjusted(this.config.blockTargetTime);
        }

        this.daemon = daemon;

        this.walletSynchronizer = new WalletSynchronizer(
            daemon, this.subWallets, timestamp, scanHeight,
            privateViewKey, this.config,
        );

        this.setupEventHandlers();

        this.setupMetronomes();
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
    public async swapNode(newDaemon: IDaemon): Promise<void> {
        logger.log(
            'Function swapNode called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        logger.log(
            `Swapping node from ${this.daemon.getConnectionString()} to ${newDaemon.getConnectionString()}`,
            LogLevel.DEBUG,
            LogCategory.DAEMON,
        );

        const shouldRestart: boolean = this.started;

        await this.stop();

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
            await this.start();
        }
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
    public getDaemonConnectionInfo(): DaemonConnection {
        logger.log(
            'Function getDaemonConnectionInfo called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public rescan(): Promise<void> {
        logger.log(
            'Function rescan called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public async reset(scanHeight: number = 0, scanTimestamp: number = 0): Promise<void> {
        logger.log(
            'Function reset called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertNumber(scanHeight, 'scanHeight');
        assertNumber(scanTimestamp, 'scanTimestamp');

        const shouldRestart: boolean = this.started;

        await this.stop();

        await this.walletSynchronizer.reset(scanHeight, scanTimestamp);

        await this.subWallets.reset(scanHeight, scanTimestamp);

        if (shouldRestart) {
            await this.start();
        }

        this.emit(
            'heightchange',
            this.walletSynchronizer.getHeight(),
            this.daemon.getLocalDaemonBlockCount(),
            this.daemon.getNetworkBlockCount(),
        );
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
    public async rewind(scanHeight: number = 0): Promise<void> {
        logger.log(
            'Function rewind called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertNumber(scanHeight, 'scanHeight');

        const shouldRestart: boolean = this.started;

        await this.stop();

        await this.walletSynchronizer.rewind(scanHeight);

        await this.subWallets.rewind(scanHeight);

        if (shouldRestart) {
            await this.start();
        }

        this.emit(
            'heightchange',
            this.walletSynchronizer.getHeight(),
            this.daemon.getLocalDaemonBlockCount(),
            this.daemon.getNetworkBlockCount(),
        );
    }

    /**
     * Adds a subwallet to the wallet container. Must not be used on a view
     * only wallet. For more information on subwallets, see https://docs.turtlecoin.lol/developer/subwallets
     *
     * Example:
     * ```javascript
     * const [address, error] = wallet.addSubWallet();
     *
     * if (!error) {
     *      console.log(`Created subwallet with address of ${address}`);
     * }
     * ```
     *
     * @returns Returns the newly created address or an error.
     */
    public addSubWallet(): ([string, undefined] | [undefined, WalletError]) {
        logger.log(
            'Function addSubWallet called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        const currentHeight: number = this.walletSynchronizer.getHeight();

        return this.subWallets.addSubWallet(currentHeight);
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
    public async importSubWallet(
        privateSpendKey: string,
        scanHeight?: number): Promise<([string, undefined] | [undefined, WalletError])> {

        logger.log(
            'Function importSubWallet called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        const currentHeight: number = this.walletSynchronizer.getHeight();

        if (scanHeight === undefined) {
            scanHeight = currentHeight;
        }

        assertString(privateSpendKey, 'privateSpendKey');
        assertNumber(scanHeight, 'scanHeight');

        if (!isHex64(privateSpendKey)) {
            return [undefined, new WalletError(WalletErrorCode.INVALID_KEY_FORMAT)];
        }

        const [error, address] = this.subWallets.importSubWallet(privateSpendKey, scanHeight);

        /* If the import height is lower than the current height then we need
         * to go back and rescan those blocks with the new subwallet. */
        if (!error) {
            if (currentHeight > scanHeight) {
                await this.rewind(scanHeight);
            }
        }

        /* Since we destructured the components, compiler can no longer figure
         * out it's either [string, undefined], or [undefined, WalletError] -
         * it could possibly be [string, WalletError] */
        return [error, address] as [string, undefined] | [undefined, WalletError];
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

    public async importViewSubWallet(
        publicSpendKey: string,
        scanHeight?: number): Promise<([string, undefined] | [undefined, WalletError])> {

        logger.log(
            'Function importViewSubWallet called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        const currentHeight: number = this.walletSynchronizer.getHeight();

        if (scanHeight === undefined) {
            scanHeight = currentHeight;
        }

        assertString(publicSpendKey, 'publicSpendKey');
        assertNumber(scanHeight, 'scanHeight');

        if (!isHex64(publicSpendKey)) {
            return [undefined, new WalletError(WalletErrorCode.INVALID_KEY_FORMAT)];
        }

        const [error, address] = this.subWallets.importViewSubWallet(publicSpendKey, scanHeight);

        /* If the import height is lower than the current height then we need
         * to go back and rescan those blocks with the new subwallet. */
        if (!error) {
            if (currentHeight > scanHeight) {
                await this.rewind(scanHeight);
            }
        }

        /* Since we destructured the components, compiler can no longer figure
         * out it's either [string, undefined], or [undefined, WalletError] -
         * it could possibly be [string, WalletError] */
        return [error, address] as [string, undefined] | [undefined, WalletError];
    }

    /**
     * Removes the subwallet specified from the wallet container. If you have
     * not backed up the private keys for this subwallet, all funds in it
     * will be lost.
     *
     * Example:
     * ```javascript
     * const error = wallet.deleteSubWallet('TRTLv2txGW8daTunmAVV6dauJgEv1LezM2Hse7EUD5c11yKHsNDrzQ5UWNRmu2ToQVhDcr82ZPVXy4mU5D7w9RmfR747KeXD3UF');
     *
     * if (error) {
     *      console.log(`Failed to delete subwallet: ${error.toString()}`);
     * }
     * ```
     *
     * @param address The subwallet address to remove
     */
    public deleteSubWallet(address: string): WalletError {
        logger.log(
            'Function deleteSubWallet called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(address, 'address');

        const err: WalletError = validateAddresses(
            new Array(address), false, this.config,
        );

        if (!_.isEqual(err, SUCCESS)) {
            return err;
        }

        return this.subWallets.deleteSubWallet(address);
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
    public getWalletCount(): number {
        logger.log(
            'Function getWalletCount called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public getSyncStatus(): [number, number, number] {
        logger.log(
            'Function getSyncStatus called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public toJSONString(): string {
        logger.log(
            'Function toJSONString called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public scanCoinbaseTransactions(shouldScan: boolean): void {
        logger.log(
            'Function scanCoinbaseTransactions called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertBoolean(shouldScan, 'shouldScan');

        /* We are not currently scanning coinbase transactions, and the caller
         * just turned it on. So, we need to discard stored blocks that don't
         * have the coinbase transaction property. */
        if (!this.config.scanCoinbaseTransactions && shouldScan) {
            this.discardStoredBlocks();
        }

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
    public setLogLevel(logLevel: LogLevel): void {
        logger.log(
            'Function setLogLevel called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        logger.setLogLevel(logLevel);
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
    public enableAutoOptimization(shouldAutoOptimize: boolean): void {
        logger.log(
            'Function enableAutoOptimization called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertBoolean(shouldAutoOptimize, 'shouldAutoOptimize');

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
    public setLoggerCallback(
        callback: (prettyMessage: string,
                   message: string,
                   level: LogLevel,
                   categories: LogCategory[]) => any): void {

        logger.log(
            'Function setLoggerCallback called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        logger.setLoggerCallback(callback);
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
    public setBlockOutputProcessFunc(func: (
            block: Block,
            privateViewKey: string,
            spendKeys: Array<[string, string]>,
            isViewWallet: boolean,
            processCoinbaseTransactions: boolean,
        ) => Array<[string, TransactionInput]>): void {

        logger.log(
            'Function setBlockOutputProcessFunc called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public async start(): Promise<void> {
        logger.log(
            'Function start called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        if (!this.started) {
            this.started = true;

            await this.daemon.init();

            this.syncThread.start();
            this.daemonUpdateThread.start();
            this.lockedTransactionsCheckThread.start();
        }
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
    public async stop(): Promise<void> {
        logger.log(
            'Function stop called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        this.started = false;
        await this.syncThread.stop();
        await this.daemonUpdateThread.stop();
        await this.lockedTransactionsCheckThread.stop();
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
    public getNodeFee(): [string, number] {
        logger.log(
            'Function getNodeFee called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public getPrivateViewKey(): string {
        logger.log(
            'Function getPrivateViewKey called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public internal(): {
        sync: (sleep: boolean) => Promise<boolean>;
        updateDaemonInfo: () => Promise<void>;
    } {
        logger.log(
            'Function internal called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public getSpendKeys(address: string): ([string, string, undefined] | [undefined, undefined, WalletError]) {
        logger.log(
            'Function getSpendKeys called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(address, 'address');

        const integratedAddressesAllowed: boolean = false;

        const err: WalletError = validateAddresses(
            new Array(address), integratedAddressesAllowed, this.config,
        );

        if (!_.isEqual(err, SUCCESS)) {
            return [undefined, undefined, err];
        }

        const [publicViewKey, publicSpendKey] = addressToKeys(address, this.config);

        const [err2, privateSpendKey] = this.subWallets.getPrivateSpendKey(publicSpendKey);

        if (!_.isEqual(err2, SUCCESS)) {
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
    public getPrimaryAddressPrivateKeys(): [string, string] {
        logger.log(
            'Function getPrimaryAddressPrivateKeys called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
     * const [seed, err] = wallet.getMnemonicSeed();
     *
     * if (err) {
     *      console.log('Wallet is not a deterministic wallet: ' + err.toString());
     * }
     * ```
     */
    public getMnemonicSeed(): ([string, undefined] | [undefined, WalletError]) {
        logger.log(
            'Function getMnemonicSeed called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public getMnemonicSeedForAddress(address: string): ([string, undefined] | [undefined, WalletError]) {
        logger.log(
            'Function getMnemonicSeedForAddress called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(address, 'address');

        const privateViewKey: string = this.subWallets.getPrivateViewKey();

        const [publicSpendKey, privateSpendKey, error] = this.getSpendKeys(address);

        if (error) {
            return [undefined, error];
        }

        const parsedAddr = CryptoUtils(this.config).createAddressFromKeys(
            privateSpendKey as string, privateViewKey as string,
        );

        if (!parsedAddr.mnemonic) {
            return [undefined, new WalletError(WalletErrorCode.KEYS_NOT_DETERMINISTIC)];
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
    public getPrimaryAddress(): string {
        logger.log(
            'Function getPrimaryAddress called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public encryptWalletToString(password: string): string {
        logger.log(
            'Function encryptWalletToString called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(password, 'password');

        const walletJson: string = JSON.stringify(this);

        return WalletEncryption.encryptWalletToString(walletJson, password);
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
    public saveWalletToFile(filename: string, password: string): boolean {
        logger.log(
            'Function saveWalletToFile called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(filename, 'filename');
        assertString(password, 'password');

        const walletJson: string = JSON.stringify(this);
        const fileData = WalletEncryption.encryptWalletToBuffer(walletJson, password);

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
    public getAddresses(): string[] {
        logger.log(
            'Function getAddresses called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

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
    public async optimize(): Promise<[number, string[]]> {
        logger.log(
            'Function optimize called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        let numTransactionsSent: number = 0;
        let hashes: string[] = [];

        for (const address of this.getAddresses()) {
            const [numSent, newHashes] = await this.optimizeAddress(address);
            numTransactionsSent += numSent;
            hashes = hashes.concat(newHashes);
        }

        return [numTransactionsSent, hashes];
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
    public async sendFusionTransactionBasic(): Promise<SendTransactionResult> {
        logger.log(
            'Function sendFusionTransactionBasic called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        return this.sendTransactionInternal(
            () => {
                return sendFusionTransactionBasic(
                    this.config,
                    this.daemon,
                    this.subWallets,
                );
            },
            true,
            true,
        );
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
     */
    public async sendFusionTransactionAdvanced(
        mixin?: number,
        subWalletsToTakeFrom?: string[],
        destination?: string): Promise<SendTransactionResult> {

        logger.log(
            'Function sendFusionTransactionAdvanced called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertNumberOrUndefined(mixin, 'mixin');
        assertArrayOrUndefined(subWalletsToTakeFrom, 'subWalletsToTakeFrom');
        assertStringOrUndefined(destination, 'destination');

        return this.sendTransactionInternal(
            () => {
                return sendFusionTransactionAdvanced(
                    this.config,
                    this.daemon,
                    this.subWallets,
                    mixin,
                    subWalletsToTakeFrom,
                    destination,
                );
            },
            true,
            true,
        );
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
    public async sendTransactionBasic(
        destination: string,
        amount: number,
        paymentID?: string): Promise<SendTransactionResult> {

        logger.log(
            'Function sendTransactionBasic called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(destination, 'destination');
        assertNumber(amount, 'amount');
        assertStringOrUndefined(paymentID, 'paymentID');

        return this.sendTransactionInternal(
            () => {
                return sendTransactionBasic(
                    this.config,
                    this.daemon,
                    this.subWallets,
                    destination,
                    amount,
                    paymentID,
                );
            },
            false,
            true,
        );
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
     */
    public async sendTransactionAdvanced(
        destinations: Array<[string, number]>,
        mixin?: number,
        fee?: FeeType,
        paymentID?: string,
        subWalletsToTakeFrom?: string[],
        changeAddress?: string,
        relayToNetwork?: boolean,
        sendAll?: boolean): Promise<SendTransactionResult> {

        logger.log(
            'Function sendTransactionAdvanced called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertArray(destinations, 'destinations');
        assertNumberOrUndefined(mixin, 'mixin');
        assertObjectOrUndefined(fee, 'fee');
        assertStringOrUndefined(paymentID, 'paymentID');
        assertArrayOrUndefined(subWalletsToTakeFrom, 'subWalletsToTakeFrom');
        assertStringOrUndefined(changeAddress, 'changeAddress');
        assertBooleanOrUndefined(relayToNetwork, 'relayToNetwork');
        assertBooleanOrUndefined(sendAll, 'sendAll');

        return this.sendTransactionInternal(
            () => {
                return sendTransactionAdvanced(
                    this.config,
                    this.daemon,
                    this.subWallets,
                    destinations,
                    mixin,
                    fee,
                    paymentID,
                    subWalletsToTakeFrom,
                    changeAddress,
                    relayToNetwork,
                    sendAll,
                );
            },
            false,
            relayToNetwork,
        );
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
    public sendPreparedTransaction(transactionHash: string): Promise<SendTransactionResult> {

        logger.log(
            'Function sendPreparedTransaction called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(transactionHash, 'transactionHash');

        const tx: PreparedTransaction | undefined = this.preparedTransactions.get(transactionHash);

        if (tx === undefined) {
            return Promise.resolve({
                error: new WalletError(WalletErrorCode.PREPARED_TRANSACTION_NOT_FOUND),
                success: false,
            });
        }

        return this.sendTransactionInternal(
            async () => {
                const res = await sendPreparedTransaction(
                    tx,
                    this.subWallets,
                    this.daemon,
                    this.config,
                );

                res.transactionHash = transactionHash;

                if (res.success) {
                    this.preparedTransactions.delete(transactionHash);
                }

                return res;
            },
            false,
            true,
        );
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

    public sendRawPreparedTransaction(rawTransaction: PreparedTransaction) {
        logger.log(
            'Function sendRawPreparedTransaction called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertObject(rawTransaction, 'rawTransaction');

        return this.sendTransactionInternal(
            async () => {
                const res = await sendPreparedTransaction(
                    rawTransaction,
                    this.subWallets,
                    this.daemon,
                    this.config,
                );

                if (res.success && res.rawTransaction) {
                    res.transactionHash = res.rawTransaction.hash;
                    this.preparedTransactions.delete(res.transactionHash);
                }

                return res;
            },
            false,
            true,
        );
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
    public deletePreparedTransaction(transactionHash: string): boolean {
        logger.log(
            'Function deletePreparedTransaction called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(transactionHash, 'transactionHash');

        return this.preparedTransactions.delete(transactionHash);
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
    public getBalance(subWalletsToTakeFrom?: string[]): [number, number] {
        logger.log(
            'Function getBalance called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertArrayOrUndefined(subWalletsToTakeFrom, 'subWalletsToTakeFrom');

        return this.subWallets.getBalance(
            this.daemon.getNetworkBlockCount(),
            subWalletsToTakeFrom,
        );
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
     * for (const tx of wallet.getTransactions()) {
     *      console.log(`Transaction ${tx.hash} - ${WB.prettyPrintAmount(tx.totalAmount())} - ${tx.timestamp}`);
     * }
     * ```
     *
     * @param startIndex Index to start taking transactions from
     * @param numTransactions Number of transactions to take
     * @param includeFusions Should we include fusion transactions?
     * @param subWallet Should we only include transactions of the specified subWallet?
     */
    public getTransactions(
        startIndex?: number,
        numTransactions?: number,
        includeFusions = true,
        subWallet?: string): Transaction[] {

        logger.log(
            'Function getTransactions called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertNumberOrUndefined(startIndex, 'startIndex');
        assertNumberOrUndefined(numTransactions, 'numTransactions');
        assertBoolean(includeFusions, 'includeFusions');

        /* Clone the array and reverse it, newer txs first */
        const unconfirmed = this.subWallets.getUnconfirmedTransactions(subWallet, includeFusions).slice().reverse();
        /* Clone the array and reverse it, newer txs first */
        const confirmed = this.subWallets.getTransactions(subWallet, includeFusions).slice().reverse();

        const allTransactions: Transaction[] = unconfirmed.concat(confirmed);

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
    public getTransaction(hash: string): Transaction | undefined {
        logger.log(
            'Function getTransaction called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertString(hash, 'hash');

        const txs = this.getTransactions();

        return txs.find((tx) => tx.hash === hash);
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
     *      const tmpNumTransactions = wallet.getNumTransactions();
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
    public getNumTransactions(subWallet?: string, includeFusions: boolean = true): number {
        logger.log(
            'Function getNumTransactions called',
            LogLevel.DEBUG,
            LogCategory.GENERAL,
        );

        assertStringOrUndefined(subWallet, 'subWallet');
        assertBoolean(includeFusions, 'includeFusions');

        return this.subWallets.getNumTransactions(subWallet, includeFusions)
             + this.subWallets.getNumUnconfirmedTransactions(subWallet, includeFusions);
    }

    private async sendTransactionInternal(
        sendTransactionFunc: () => Promise<PreparedTransactionInfo>,
        fusion: boolean,
        relayToNetwork: boolean = true): Promise<SendTransactionResult> {

        this.currentlyTransacting = true;

        const result = await sendTransactionFunc();

        if (result.success) {
            if (result.prettyTransaction) {
                const eventName: string = fusion ? 'createdfusiontx' : 'createdtx';

                this.emit(eventName, result.prettyTransaction);

                logger.log(
                    'Sent transaction ' + result.transactionHash,
                    LogLevel.INFO,
                    LogCategory.TRANSACTIONS,
                );
            } else {
                logger.log(
                    'Created transaction ' + result.transactionHash,
                    LogLevel.INFO,
                    LogCategory.TRANSACTIONS,
                );
            }
        }

        const preparedTransaction: PreparedTransaction = {
            fee: result.fee as number,
            paymentID: result.paymentID as string,
            inputs: result.inputs as TxInputAndOwner[],
            changeAddress: result.changeAddress as string,
            changeRequired: result.changeRequired as number,
            rawTransaction: result.rawTransaction as CreatedTransaction,
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
    }

    private discardStoredBlocks(): void {
        const [scanHeight, scanTimestamp] = this.walletSynchronizer.getScanHeights();

        const newSynchronizationStatus: SynchronizationStatus = new SynchronizationStatus(
            this.walletSynchronizer.getHeight(),
            this.walletSynchronizer.getBlockCheckpoints(),
            this.walletSynchronizer.getRecentBlockHashes(),
        );

        this.walletSynchronizer = new WalletSynchronizer(
            this.daemon, this.subWallets, scanTimestamp, scanHeight,
            this.subWallets.getPrivateViewKey(), this.config, newSynchronizationStatus,
        );

        /* Resetup event handlers */
        this.walletSynchronizer.on('heightchange', (walletHeight) => {
            this.emit(
                'heightchange',
                walletHeight,
                this.daemon.getLocalDaemonBlockCount(),
                this.daemon.getNetworkBlockCount(),
            );

            this.haveEmittedDeadNode = false;
        });

        this.walletSynchronizer.on('deadnode', () => {
            if (!this.haveEmittedDeadNode) {
                this.haveEmittedDeadNode = true;
                this.emit('deadnode');
            }
        });
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

        await this.daemon.updateDaemonInfo();

        const walletHeight: number = this.walletSynchronizer.getHeight();
        const networkHeight: number = this.daemon.getNetworkBlockCount();

        if (walletHeight >= networkHeight) {

            /* Yay, synced with the network */
            if (!this.synced) {
                this.emit('sync', walletHeight, networkHeight);
                this.synced = true;
            }

            if (this.shouldPerformAutoOptimize) {
                this.performAutoOptimize();
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
     * Stores any transactions, inputs, and spend keys images
     */
    private storeTxData(txData: TransactionData, blockHeight: number): void {
        /* Store any corresponding inputs */
        for (const [publicKey, input] of txData.inputsToAdd) {

            logger.log(
                `Adding input ${input.key} with keyimage ${input.keyImage}`,
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            this.subWallets.storeTransactionInput(publicKey, input);
        }

        /* Mark any spent key images */
        for (const [publicKey, keyImage] of txData.keyImagesToMarkSpent) {
            logger.log(
                `Marking input with keyimage ${keyImage} as spent`,
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            this.subWallets.markInputAsSpent(publicKey, keyImage, blockHeight);
        }

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

        if (txData.transactionsToAdd.length > 0 && this.autoOptimize) {
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
    private async getGlobalIndexes(blockHeight: number): Promise<Map<string, number[]>> {
        const startHeight: number = getLowerBound(blockHeight, GLOBAL_INDEXES_OBSCURITY);
        const endHeight: number = getUpperBound(blockHeight, GLOBAL_INDEXES_OBSCURITY);

        return this.daemon.getGlobalIndexesForRange(
            startHeight, endHeight,
        );
    }

    /**
     * Process config.blocksPerTick stored blocks, finding transactions and
     * inputs that belong to us
     */
    private async processBlocks(sleep: boolean): Promise<boolean> {
        /* Take the blocks to process for this tick */
        const [blocks, shouldSleep] = await this.walletSynchronizer.fetchBlocks(this.config.blocksPerTick);

        if (blocks.length === 0) {
            if (sleep && shouldSleep) {
                await delay(1000);
            }

            return false;
        }

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

            if (block.blockHeight % 5000 === 0 && block.blockHeight !== 0) {
                this.subWallets.pruneSpentInputs(block.blockHeight - 5000);
            }

            /* User can supply us a function to do the processing, possibly
               utilizing native code for moar speed */
            const processFunction = this.externalBlockProcessFunction
                                 || this.walletSynchronizer.processBlockOutputs.bind(this.walletSynchronizer);

            const blockInputs: Array<[string, TransactionInput]> = await processFunction(
                block,
                this.subWallets.getPrivateViewKey(),
                this.subWallets.getAllSpendKeys(),
                this.subWallets.isViewWallet,
                this.config.scanCoinbaseTransactions,
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

            /* Store the block hash and remove the block we just processed */
            this.walletSynchronizer.dropBlock(block.blockHeight, block.blockHash);

            logger.log(
                'Finished processing block ' + block.blockHeight,
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );

            this.emit(
                'heightchange',
                block.blockHeight,
                this.daemon.getLocalDaemonBlockCount(),
                this.daemon.getNetworkBlockCount(),
            );
        }

        return true;
    }

    /**
     * Main loop. Download blocks, process them.
     */
    private async sync(sleep: boolean): Promise<boolean> {
        try {
            return await this.processBlocks(sleep);
        } catch (err) {
            logger.log(
                'Error processing blocks: ' + err.toString(),
                LogLevel.INFO,
                LogCategory.SYNC,
            );
        }

        return false;
    }

    /**
     * Converts recursively to JSON. Should be used in conjuction with JSON.stringify.
     * Example:
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

    private setupMetronomes() {
        this.syncThread = new Metronome(
            () => this.sync(true),
            this.config.syncThreadInterval,
        );

        this.daemonUpdateThread = new Metronome(
            () => this.updateDaemonInfo(),
            this.config.daemonUpdateInterval,
        );

        this.lockedTransactionsCheckThread = new Metronome(
            () => this.checkLockedTransactions(),
            this.config.lockedTransactionsCheckInterval,
        );
    }

    private setupEventHandlers() {
        /* Passing through events from daemon to users */
        this.daemon.on('disconnect', () => {
            this.emit('disconnect');
        });

        this.daemon.on('connect', () => {
            this.emit('connect');
        });

        this.daemon.on('heightchange', (localDaemonBlockCount, networkDaemonBlockCount) => {
            this.emit(
                'heightchange',
                this.walletSynchronizer.getHeight(),
                localDaemonBlockCount,
                networkDaemonBlockCount,
            );

            this.haveEmittedDeadNode = false;
        });

        /* Compiler being really stupid and can't figure out how to fix.. */
        this.daemon.on('deadnode' as any, () => {
            if (!this.haveEmittedDeadNode) {
                this.haveEmittedDeadNode = true;
                this.emit('deadnode');
            }
        });

        this.walletSynchronizer.initAfterLoad(this.subWallets, this.daemon, this.config);

        this.walletSynchronizer.on('heightchange', (walletHeight) => {
            this.emit(
                'heightchange',
                walletHeight,
                this.daemon.getLocalDaemonBlockCount(),
                this.daemon.getNetworkBlockCount(),
            );

            this.haveEmittedDeadNode = false;
        });

        this.walletSynchronizer.on('deadnode', () => {
            if (!this.haveEmittedDeadNode) {
                this.haveEmittedDeadNode = true;
                this.emit('deadnode');
            }
        });
    }

    /**
     * Initialize stuff not stored in the JSON.
     */
    private initAfterLoad(daemon: IDaemon, config: Config): void {
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
    private async optimizeAddress(address: string): Promise<[number, string[]]> {
        let failCount: number = 0;
        let sentTransactions: number = 0;
        const hashes: string[] = [];

        /* Since input selection is random, lets let it fail a few times before
           stopping */
        while (failCount < 5) {
            /* Draw from address, and return funds to address */
            const result = await this.sendFusionTransactionAdvanced(
                undefined,
                [ address ],
                address,
            );

            if (!result.success) {
                failCount++;
            } else if (result.transactionHash) {
                failCount = 0;
                sentTransactions++;
                hashes.push(result.transactionHash);
            }
        }

        return [sentTransactions, hashes];
    }

    private async performAutoOptimize() {
        this.shouldPerformAutoOptimize = false;

        /* Already optimizing, don't optimize again */
        if (this.currentlyOptimizing) {
            return;
        } else {
            this.currentlyOptimizing = true;
        }

        const f = async () => {
            /* In a transaction, don't optimize as it may possibly break things */
            if (this.currentlyTransacting) {
                return;
            }

            logger.log(
                'Performing auto optimization',
                LogLevel.INFO,
                LogCategory.TRANSACTIONS,
            );

            /* Do the optimize! */
            await this.optimize();

            logger.log(
                'Auto optimization complete',
                LogLevel.INFO,
                LogCategory.TRANSACTIONS,
            );
        };

        await f();

        /* We're done. */
        this.currentlyOptimizing = false;
    }
}
