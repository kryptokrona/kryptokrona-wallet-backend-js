/// <reference types="node" />
import { EventEmitter } from 'events';
import { IDaemon } from './IDaemon';
import { IConfig } from './Config';
import { LogCategory, LogLevel } from './Logger';
import { WalletError } from './WalletError';
import { Block, Transaction, TransactionInput } from './Types';
declare type TransactionHash = [string, undefined];
declare type TransactionError = [undefined, WalletError];
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
}
/**
 * The WalletBackend provides an interface that allows you to synchronize
 * with a daemon, download blocks, process them, and pick out transactions that
 * belong to you.
 * It also allows you to inspect these transactions, view your balance,
 * send transactions, and more.
 * @noInheritDoc
 */
export declare class WalletBackend extends EventEmitter {
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
    static openWalletFromFile(daemon: IDaemon, filename: string, password: string, config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError];
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
    static openWalletFromEncryptedString(deamon: IDaemon, data: string, password: string, config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError];
    /**
     * Encrypt the wallet using the given password. Note that an empty password does not mean an
     * unencrypted wallet - simply a wallet encrypted with the empty string.
     *
     * This will take some time (Roughly a second on a modern PC) - it runs 500,000 iterations of pbkdf2.
     *
     * Example:
     * ```javascript
     * const dataJson = wallet.encryptWallet('hunter2');
     *
     * ```
     *
     * @param password The password to encrypt the wallet with
     *
     * @return Returns a JSON string containing the encrypted fileData.
     */
    static encryptWallet(password: string): Buffer;
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
    static loadWalletFromJSON(daemon: IDaemon, json: string, config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError];
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
    static importWalletFromSeed(daemon: IDaemon, scanHeight: number | undefined, mnemonicSeed: string, config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError];
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
    static importWalletFromKeys(daemon: IDaemon, scanHeight: number | undefined, privateViewKey: string, privateSpendKey: string, config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError];
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
    static importViewWallet(daemon: IDaemon, scanHeight: number | undefined, privateViewKey: string, address: string, config?: IConfig): [WalletBackend, undefined] | [undefined, WalletError];
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
    static createWallet(daemon: IDaemon, config?: IConfig): WalletBackend;
    private static reviver;
    private static fromJSON;
    /**
     *  Contains private keys, transactions, inputs, etc
     */
    private readonly subWallets;
    /**
     * Interface to either a regular daemon or a blockchain cache api
     */
    private daemon;
    /**
     * Wallet synchronization state
     */
    private walletSynchronizer;
    /**
     * Executes the main loop every n seconds for us
     */
    private syncThread;
    /**
     * Update daemon info every n seconds
     */
    private daemonUpdateThread;
    /**
     * Check on locked tx status every n seconds
     */
    private lockedTransactionsCheckThread;
    /**
     * Whether our wallet is synced. Used for selectively firing the sync/desync
     * event.
     */
    private synced;
    /**
     * Have we started the mainloop
     */
    private started;
    /**
     * External function to process a blocks outputs.
     */
    private externalBlockProcessFunction?;
    /**
     * Whether we should automatically keep the wallet optimized
     */
    private autoOptimize;
    /**
     * Are we in the middle of an optimization?
     */
    private currentlyOptimizing;
    /**
     * Are we in the middle of a transaction?
     */
    private currentlyTransacting;
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
    private constructor();
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
    rescan(): Promise<void>;
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
    reset(scanHeight?: number, scanTimestamp?: number): Promise<void>;
    /**
     * Gets the wallet, local daemon, and network block count
     *
     * Example:
     * ```javascript
     * const [walletBlockCount, localDaemonBlockCount, networkBlockCount] =
     *      wallet.getSyncStatus();
     * ```
     */
    getSyncStatus(): [number, number, number];
    /**
     * Converts the wallet into a JSON string. This can be used to later restore
     * the wallet with [[loadWalletFromJSON]].
     *
     * Example:
     * ```javascript
     * const walletData = wallet.toJSONString();
     * ```
     */
    toJSONString(): string;
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
    scanCoinbaseTransactions(shouldScan: boolean): void;
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
    setLogLevel(logLevel: LogLevel): void;
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
    enableAutoOptimization(shouldAutoOptimize: boolean): void;
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
    setLoggerCallback(callback: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any): void;
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
    setBlockOutputProcessFunc(func: (block: Block, privateViewKey: string, spendKeys: Array<[string, string]>, isViewWallet: boolean, processCoinbaseTransactions: boolean) => Array<[string, TransactionInput]>): void;
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
    start(): Promise<void>;
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
    stop(): void;
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
    getNodeFee(): [string, number];
    /**
     * Gets the shared private view key for this wallet container.
     *
     * Example:
     * ```javascript
     * const privateViewKey = wallet.getPrivateViewKey();
     * ```
     */
    getPrivateViewKey(): string;
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
    internal(): {
        sync: (sleep: boolean) => Promise<boolean>;
        updateDaemonInfo: () => Promise<void>;
    };
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
    getSpendKeys(address: string): ([string, string, undefined] | [undefined, undefined, WalletError]);
    /**
     * Gets the private spend and private view for the primary address.
     * The primary address is the first created wallet in the container.
     *
     * Example:
     * ```javascript
     * const [privateSpendKey, privateViewKey] = wallet.getPrimaryAddressPrivateKeys();
     * ```
     */
    getPrimaryAddressPrivateKeys(): [string, string];
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
    getMnemonicSeed(): ([string, undefined] | [undefined, WalletError]);
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
    getMnemonicSeedForAddress(address: string): ([string, undefined] | [undefined, WalletError]);
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
    getPrimaryAddress(): string;
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
    saveWalletToFile(filename: string, password: string): boolean;
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
    getAddresses(): string[];
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
    optimize(): Promise<[number, string[]]>;
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
    sendFusionTransactionBasic(): Promise<(TransactionHash | TransactionError)>;
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
    sendFusionTransactionAdvanced(mixin?: number, subWalletsToTakeFrom?: string[], destination?: string): Promise<(TransactionHash | TransactionError)>;
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
    sendTransactionBasic(destination: string, amount: number, paymentID?: string): Promise<(TransactionHash | TransactionError)>;
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
    sendTransactionAdvanced(destinations: Array<[string, number]>, mixin?: number, fee?: number, paymentID?: string, subWalletsToTakeFrom?: string[], changeAddress?: string): Promise<(TransactionHash | TransactionError)>;
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
    getBalance(subWalletsToTakeFrom?: string[]): [number, number];
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
    getTransactions(startIndex?: number, numTransactions?: number, includeFusions?: boolean): Transaction[];
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
    getTransaction(hash: string): Transaction | undefined;
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
    getNumTransactions(): number;
    /**
     * Remove any transactions that have been cancelled
     */
    private checkLockedTransactions;
    /**
     * Update daemon status
     */
    private updateDaemonInfo;
    /**
     * Stores any transactions, inputs, and spend keys images
     */
    private storeTxData;
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
    private getGlobalIndexes;
    /**
     * Process Config.blocksPerTick stored blocks, finding transactions and
     * inputs that belong to us
     */
    private processBlocks;
    /**
     * Main loop. Download blocks, process them.
     */
    private sync;
    /**
     * Converts recursively to JSON. Should be used in conjuction with JSON.stringify.
     * Example:
     *
     * ```
     * JSON.stringify(wallet, null, 4);
     * ```
     */
    private toJSON;
    /**
     * Initialize stuff not stored in the JSON.
     */
    private initAfterLoad;
    /**
     * Since we're going to use optimize() with auto optimizing, and auto
     * optimizing is enabled by default, we have to ensure we only optimize
     * a single wallet at once. Otherwise, we'll end up with everyones balance
     * in the primary wallet.
     */
    private optimizeAddress;
    private performAutoOptimize;
}
export {};
