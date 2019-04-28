/// <reference types="node" />
import { EventEmitter } from 'events';
import { IDaemon } from './IDaemon';
import { IConfig } from './Config';
import { LogCategory, LogLevel } from './Logger';
import { WalletError } from './WalletError';
import { Block, Transaction, TransactionInput } from './Types';
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
     * This is emitted whenever the wallet creates and sends a transaction.
     *
     * This is distinct from the outgoingtx event, as this event is fired when
     * we send a transaction, while outgoingtx is fired when the tx is included
     * in a block, and scanned by the wallet.
     *
     * Usage:
     *
     * ```
     * wallet.on('createdtx', (transaction) => {
     *      console.log('Transaction created!');
     * }
     * ```
     *
     * @event
     */
    on(event: 'createdtx', callback: (transaction: Transaction) => void): this;
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
export declare class WalletBackend extends EventEmitter {
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
     * const daemon = new ConventionalDaemon('127.0.0.1', 11898);
     *
     * const [wallet, error] = WalletBackend.openWalletFromFile(daemon, 'mywallet.wallet', 'hunter2');
     *
     * if (error) {
     *      console.log('Failed to open wallet: ' + error.toString());
     * }
     * ```
     */
    static openWalletFromFile(daemon: IDaemon, filename: string, password: string, config?: IConfig): [WalletBackend | undefined, WalletError | undefined];
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
    static loadWalletFromJSON(daemon: IDaemon, json: string, config?: IConfig): [WalletBackend | undefined, WalletError | undefined];
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
    static importWalletFromSeed(daemon: IDaemon, scanHeight: number, mnemonicSeed: string, config?: IConfig): [WalletBackend | undefined, WalletError | undefined];
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
    static importWalletFromKeys(daemon: IDaemon, scanHeight: number, privateViewKey: string, privateSpendKey: string, config?: IConfig): [WalletBackend | undefined, WalletError | undefined];
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
     *
     * Usage:
     * ```
     * const daemon = new ConventionalDaemon('127.0.0.1', 11898);
     *
     * const privateViewKey = 'ce4c27d5b135dc5310669b35e53efc9d50d92438f00c76442adf8c85f73f1a01';
     * const address = 'TRTLv2Fyavy8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyoBh4wW';
     *
     * const [wallet, error] = WalletBackend.importViewWallet(daemon, 100000, privateViewKey, address);
     *
     * if (error) {
     *      console.log('Failed to load wallet: ' + error.toString());
     * }
     * ```
     */
    static importViewWallet(daemon: IDaemon, scanHeight: number, privateViewKey: string, address: string, config?: IConfig): [WalletBackend | undefined, WalletError | undefined];
    /**
     * This method creates a new wallet instance with a random key pair.
     *
     * The created addresses view key will be derived in terms of the spend key,
     * i.e. it will have a mnemonic seed.
     *
     * Usage:
     * ```
     * const daemon = new ConventionalDaemon('127.0.0.1', 11898);
     * const wallet = WalletBackend.createWallet(daemon);
     * ```
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
     */
    rescan(): void;
    /**
     * Discard all transaction data, and begin scanning the wallet again
     * from the scanHeight or timestamp given. Defaults to a height of zero,
     * if not given.
     */
    reset(scanHeight?: number, scanTimestamp?: number): Promise<void>;
    /**
     * Gets the wallet, local daemon, and network block count
     *
     * Usage:
     * ```
     * let [walletBlockCount, localDaemonBlockCount, networkBlockCount] =
     *      wallet.getSyncStatus();
     * ```
     */
    getSyncStatus(): [number, number, number];
    /**
     * Most people don't mine blocks, so by default we don't scan them. If
     * you want to scan them, flip it on/off here.
     */
    scanCoinbaseTransactions(shouldScan: boolean): void;
    /**
     * Converts the wallet into a JSON string. This can be used to later restore
     * the wallet with `loadWalletFromJSON`.
     */
    toJSONString(): string;
    /**
     * Sets the log level. Log messages below this level are not shown.
     */
    setLogLevel(logLevel: LogLevel): void;
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
    setLoggerCallback(callback: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any): void;
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
    setBlockOutputProcessFunc(func: (block: Block, privateViewKey: string, spendKeys: Array<[string, string]>, isViewWallet: boolean, processCoinbaseTransactions: boolean) => Array<[string, TransactionInput]>): void;
    /**
     * Initializes and starts the wallet sync process. You should call this
     * function before enquiring about daemon info or fee info. The wallet will
     * not process blocks until you call this method.
     */
    start(): Promise<void>;
    /**
     * The inverse of the start() method, this pauses the blockchain sync
     * process.
     */
    stop(): void;
    /**
     * Get the node fee the daemon you are connected to is charging for
     * transactions. If the daemon charges no fee, this will return `['', 0]`
     *
     * @returns Returns the node fee address, and the node fee amount, in
     *          atomic units
     */
    getNodeFee(): [string, number];
    /**
     * Gets the shared private view key for this wallet container.
     */
    getPrivateViewKey(): string;
    /**
     * Exposes some internal functions for those who know what they're doing...
     */
    internal(): {
        sync: (sleep: boolean) => Promise<boolean>;
        updateDaemonInfo: () => Promise<void>;
    };
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
    getSpendKeys(address: string): [string, string, WalletError | undefined];
    /**
     * Get the private spend and private view for the primary address.
     * The primary address is the first created wallet in the container.
     *
     * @return Returns [privateSpendKey, privateViewKey]
     */
    getPrimaryAddressPrivateKeys(): [string, string];
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
    getMnemonicSeed(): [string | undefined, WalletError | undefined];
    /**
     * Get the mnemonic seed for the specified address. If the specified address
     * is invalid or the address isn't a deterministic wallet, it will return
     * a WalletError.
     */
    getMnemonicSeedForAddress(address: string): [string | undefined, WalletError | undefined];
    /**
     * Gets the primary address of a wallet container.
     * The primary address is the address that was created first in the wallet
     * container.
     */
    getPrimaryAddress(): string;
    /**
     * Save the wallet to the given filename. Password may be empty, but
     * filename must not be.
     * This will take some time - it runs 500,000 iterations of pbkdf2.
     *
     * @return Returns a boolean indicating success.
     */
    saveWalletToFile(filename: string, password: string): boolean;
    /**
     * Sends a fusion transaction, if possible.
     * Fusion transactions are zero fee, and optimize your wallet
     * for sending larger amounts. You may (probably will) need to perform
     * multiple fusion transactions.
     *
     * Usage:
     * ```
     * const [hash, error] = await sendFusionTransactionBasic()
     * if (error) {
     *     // etc
     * }
     * ```
     *
     * @return Returns either an error, or the transaction hash.
     */
    sendFusionTransactionBasic(): Promise<([string, undefined]) | ([undefined, WalletError])>;
    /**
     * Sends a fusion transaction, if possible.
     * Fusion transactions are zero fee, and optimize your wallet
     * for sending larger amounts. You may (probably will) need to perform
     * multiple fusion transactions.
     *
     * All parameters are optional.
     *
     * Usage:
     * ```
     * const [hash, error] = await sendFusionTransactionAdvanced(3, undefined, 'TRTLxyz..')
     * if (error) {
     *     // etc
     * }
     * ```
     * @param mixin                 The amount of input keys to hide your input with.
     *                              Your network may enforce a static mixin.
     * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
     * @param destination           The destination for the fusion transaction to be sent to.
     * @param                       Must be a subwallet in this container.
     *
     * @return Returns either an error, or the transaction hash.
     */
    sendFusionTransactionAdvanced(mixin?: number, subWalletsToTakeFrom?: string[], destination?: string): Promise<([string, undefined]) | ([undefined, WalletError])>;
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
    sendTransactionBasic(destination: string, amount: number, paymentID?: string): Promise<([string, undefined]) | ([undefined, WalletError])>;
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
    sendTransactionAdvanced(destinations: Array<[string, number]>, mixin?: number, fee?: number, paymentID?: string, subWalletsToTakeFrom?: string[], changeAddress?: string): Promise<([string, undefined]) | ([undefined, WalletError])>;
    /**
     * Get the unlocked and locked balance for the wallet container.
     *
     * @param subWalletsToTakeFrom The addresses to check the balance of. If
     *                             not given, defaults to all addresses.
     *
     * @return Returns [unlockedBalance, lockedBalance]
     */
    getBalance(subWalletsToTakeFrom?: string[]): [number, number];
    /**
     * Get all transactions in a wallet container
     *
     * Newer transactions are at the front of the array - Unconfirmed transactions
     * come at the very front.
     *
     * @param startIndex Index to start taking transactions from
     * @param numTransactions Number of transactions to take
     * @param includeFusions Should we include fusion transactions?
     */
    getTransactions(startIndex?: number, numTransactions?: number, includeFusions?: boolean): Transaction[];
    /**
     * Gets the specified transaction, if it exists.
     */
    getTransaction(hash: string): Transaction | undefined;
    /**
     * Get the number of transactions in the wallet container. Can be used
     * if you want to avoid fetching every transactions repeatedly when nothing
     * has changed.
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
     * Usage:
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
}
