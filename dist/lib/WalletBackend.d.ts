/// <reference types="node" />
import { EventEmitter } from 'events';
import { Block as UtilsBlock, Transaction as UtilsTransaction } from 'kryptokrona-utils';
import { FeeType } from './FeeType';
import { Daemon } from './Daemon';
import { IConfig } from './Config';
import { LogCategory, LogLevel } from './Logger';
import { WalletError } from './WalletError';
import { Block, DaemonConnection, PreparedTransaction, SendTransactionResult, Transaction, TransactionInput } from './Types';
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
     * @event This is emitted whenever the wallet finds a new transaction.
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
     * @event This is emitted whenever the wallet finds an incoming transaction.
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
     *
     * @event This is emitted whenever the wallet finds an outgoing transaction.
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
     * @event This is emitted whenever the wallet finds a fusion transaction.
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
     * @event This is emitted whenever the wallet creates and sends a transaction.
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
     * @event This is emitted whenever the wallet creates and sends a fusion transaction.
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
     * @event This is emitted whenever the wallet first syncs with the network.
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
     * @event This is emitted whenever the wallet first desyncs with the network.
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
     * @event This is emitted whenever the wallet fails to contact the underlying daemon.
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
     * @event This is emitted whenever the wallet previously failed to contact the underlying daemon, and has now reconnected.
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
     * @event This is emitted whenever the walletBlockCount, localDaemonBlockCount, or networkBlockCount changes.
     */
    on(event: 'heightchange', callback: (walletBlockCount: number, localDaemonBlockCount: number, networkBlockCount: number) => void): this;
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
     * @event This is emitted when we consider the node to no longer be online.
     */
    on(event: 'deadnode', callback: () => void): this;
    /**
     * This is emitted when an unconfirmed incoming transaction is in the mempool.
     *
     * Example:
     * ```javascript
     * wallet.on('unconfirmedtx', (amount, hash) => {
     *     console.log('Incoming unconfimed amount: ', amount);
     *     console.log('Incoming unconfimed hash: ', hash);
     * }
     *
     * @event This is emitted when an unconfirmed incoming transaction is in the mempool
     */
    on(event: 'unconfirmedtx', callback: (amount: number, hash: string) => void): this;
    /**
     * This is emitted every time we download a block from the daemon. Will
     * only be emitted if the daemon is using /getrawblocks (All non blockchain
     * cache daemons should support this).
     *
     * This block object is an instance of the [Block turtlecoin-utils class](https://utils.turtlecoin.dev/classes/block.html).
     * See the Utils docs for further info on using this value.
     *
     * Note that a block emitted after a previous one could potentially have a lower
     * height, if a blockchain fork took place.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('rawblock', (block) => {
     *      console.log(`Downloaded new block ${block.hash}`);
     * });
     * ```
     *
     * @event This is emitted every time we download a block from the daemon.
     */
    on(event: 'rawblock', callback: (block: UtilsBlock) => void): this;
    /**
     * This is emitted every time we download a transaction from the daemon. Will
     * only be emitted if the daemon is using /getrawblocks (All non blockchain
     * cache daemons should support this).
     *
     * This transaction object is an instance of the [Transaction turtlecoin-utils class](https://utils.turtlecoin.dev/classes/transaction.html).
     * See the Utils docs for further info on using this value.
     *
     * Note that a transaction emitted after a previous one could potentially have a lower
     * height in the chain, if a blockchain fork took place.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('rawtransaction', (block) => {
     *      console.log(`Downloaded new transaction ${transaction.hash}`);
     * });
     * ```
     *
     * @event This is emitted every time we download a transaction from the daemon.
     */
    on(event: 'rawtransaction', callback: (transaction: UtilsTransaction) => void): this;
    /**
     * This is emitted when an error occurs during auto optimization
     *
     * Example:
     * ```javascript
     * wallet.on('autooptimizeError', (error) => {
     *     console.error('Error: ', error);
     * }
     *
     * @event This is emitted when an error occurs during auto optimization
     */
    on(event: 'autoOptimizeError', callback: (error: Error) => void): this;
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
    static openWalletFromFile(daemon: Daemon, filename: string, password: string, config?: IConfig): Promise<[WalletBackend, undefined] | [undefined, WalletError]>;
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
    static openWalletFromEncryptedString(daemon: Daemon, data: string, password: string, config?: IConfig): Promise<[WalletBackend, undefined] | [undefined, WalletError]>;
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
    static loadWalletFromJSON(daemon: Daemon, json: string, config?: IConfig): Promise<[WalletBackend, undefined] | [undefined, WalletError]>;
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
    static importWalletFromSeed(daemon: Daemon, scanHeight: number, mnemonicSeed: string, config?: IConfig): Promise<[WalletBackend, undefined] | [undefined, WalletError]>;
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
    static importWalletFromKeys(daemon: Daemon, scanHeight: number, privateViewKey: string, privateSpendKey: string, config?: IConfig): Promise<[WalletBackend, undefined] | [undefined, WalletError]>;
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
    static importViewWallet(daemon: Daemon, scanHeight: number, privateViewKey: string, address: string, config?: IConfig): Promise<[WalletBackend, undefined] | [undefined, WalletError]>;
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
    static createWallet(daemon: Daemon, config?: IConfig): Promise<WalletBackend>;
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
     * Should we perform auto optimization when next synced
     */
    private shouldPerformAutoOptimize;
    /**
     * Are we in the middle of an optimization?
     */
    private currentlyOptimizing;
    /**
     * Are we in the middle of a transaction?
     */
    private currentlyTransacting;
    private config;
    /**
     * We only want to submit dead node once, then reset the flag when we
     * swap node or the node comes back online.
     */
    private haveEmittedDeadNode;
    /**
     * Previously prepared transactions for later sending.
     */
    private preparedTransactions;
    private constructor();
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
    private static init;
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
    swapNode(newDaemon: Daemon): Promise<void>;
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
    getDaemonConnectionInfo(): DaemonConnection;
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
     * @param scanTimestamp The timestamp to being scanning transactions from
     */
    reset(scanHeight?: number, scanTimestamp?: number): Promise<void>;
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
    rewind(scanHeight?: number): Promise<void>;
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
    addSubWallet(): Promise<([string, undefined] | [undefined, WalletError])>;
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
    importSubWallet(privateSpendKey: string, scanHeight?: number): Promise<([string, undefined] | [undefined, WalletError])>;
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
    importViewSubWallet(publicSpendKey: string, scanHeight?: number): Promise<([string, undefined] | [undefined, WalletError])>;
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
    deleteSubWallet(address: string): Promise<WalletError>;
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
    getWalletCount(): number;
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
     * Only some applications need to scan pool transactions.
     * Make it easy to turn it on/off.
     * Example:
     * ```javascript
     * wallet.scanPoolTransactions(false);
     * ```
     *
     * @param shouldScan Should we scan for pool transactions?
     */
    scanPoolTransactions(shouldScan: boolean): void;
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
     * Returns a string indicating the type of cryptographic functions being used.
     *
     * Example:
     * ```javascript
     * const cryptoType = wallet.getCryptoType();
     *
     * console.log(`Wallet is using the ${cryptoType} cryptographic library.`);
     * ```
     */
    getCryptoType(): string;
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
    usingNativeCrypto(): boolean;
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
    setBlockOutputProcessFunc(func: (block: Block, privateViewKey: string, spendKeys: [string, string][], isViewWallet: boolean, processCoinbaseTransactions: boolean) => [string, TransactionInput][]): void;
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
    stop(): Promise<void>;
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
     * const [publicSpendKey, privateSpendKey, err] = await wallet.getSpendKeys('TRTLxyz...');
     *
     * if (err) {
     *      console.log('Failed to get spend keys for address: ' + err.toString());
     * }
     * ```
     *
     * @param address A valid address in this container, to get the spend keys of
     */
    getSpendKeys(address: string): Promise<([string, string, undefined] | [undefined, undefined, WalletError])>;
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
     * const [seed, err] = await wallet.getMnemonicSeed();
     *
     * if (err) {
     *      console.log('Wallet is not a deterministic wallet: ' + err.toString());
     * }
     * ```
     */
    getMnemonicSeed(): Promise<([string, undefined] | [undefined, WalletError])>;
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
    getMnemonicSeedForAddress(address: string): Promise<([string, undefined] | [undefined, WalletError])>;
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
    encryptWalletToString(password: string): string;
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
     * const result = await wallet.sendFusionTransactionBasic();
     *
     * if (result.success) {
     *      console.log(`Sent transaction, hash ${result.transactionHash}`);
     * } else {
     *      console.log(`Failed to send transaction: ${result.error.toString()}`);
     * }
     * ```
     */
    sendFusionTransactionBasic(): Promise<SendTransactionResult>;
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
    sendFusionTransactionAdvanced(mixin?: number, subWalletsToTakeFrom?: string[], destination?: string, extraData?: string): Promise<SendTransactionResult>;
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
    sendTransactionBasic(destination: string, amount: number, paymentID?: string): Promise<SendTransactionResult>;
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
    sendTransactionAdvanced(destinations: [string, number][], mixin?: number, fee?: FeeType, paymentID?: string, subWalletsToTakeFrom?: string[], changeAddress?: string, relayToNetwork?: boolean, sendAll?: boolean, extraData?: string): Promise<SendTransactionResult>;
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
    sendPreparedTransaction(transactionHash: string): Promise<SendTransactionResult>;
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
    sendRawPreparedTransaction(rawTransaction: PreparedTransaction): Promise<SendTransactionResult>;
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
    deletePreparedTransaction(transactionHash: string): boolean;
    /**
     * Deletes all prepared transactions.
     *
     * Example:
     * ```javascript
     * wallet.deletePreparedTransactions();
     * ```
     *
     */
    deletePreparedTransactions(): void;
    /**
     * Gets all prepared transactions.
     *
     * Example:
     * ```javascript
     * const preparedTransactions = wallet.getPreparedTransactions();
     * ```
     *
     */
    getPreparedTransactions(): PreparedTransaction[];
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
    getBalance(subWalletsToTakeFrom?: string[]): Promise<[number, number]>;
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
    getTransactions(startIndex?: number, numTransactions?: number, includeFusions?: boolean, subWallet?: string): Promise<Transaction[]>;
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
    getTransaction(hash: string): Promise<Transaction | undefined>;
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
    getNumTransactions(subWallet?: string, includeFusions?: boolean): Promise<number>;
    private sendTransactionInternal;
    private discardStoredBlocks;
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
    checkPoolTransactions(): Promise<void>;
    /**
     * Process config.blocksPerTick stored blocks, finding transactions and
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
    private setupMetronomes;
    private setupEventHandlers;
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
