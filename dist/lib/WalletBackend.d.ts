/// <reference types="node" />
import { EventEmitter } from 'events';
import { IDaemon } from './IDaemon';
import { WalletBackendJSON } from './JsonSerialization';
import { LogCategory, LogLevel } from './Logger';
import { Transaction } from './Types';
import { WalletError } from './WalletError';
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
 * Documentation for the WalletBackend class.
 * @noInheritDoc
 */
export declare class WalletBackend extends EventEmitter {
    static openWalletFromFile(daemon: IDaemon, filename: string, password: string): WalletBackend | WalletError;
    static loadWalletFromJSON(daemon: IDaemon, json: string): WalletBackend | WalletError;
    static importWalletFromSeed(daemon: IDaemon, scanHeight: number, mnemonicSeed: string): WalletBackend | WalletError;
    static importWalletFromKeys(daemon: IDaemon, scanHeight: number, privateViewKey: string, privateSpendKey: string): WalletBackend | WalletError;
    static importViewWallet(daemon: IDaemon, scanHeight: number, privateViewKey: string, address: string): WalletBackend | WalletError;
    static createWallet(daemon: IDaemon): WalletBackend;
    private static reviver;
    private static fromJSON;
    private readonly subWallets;
    private daemon;
    private walletSynchronizer;
    private mainLoopExecutor;
    private synced;
    private blocksToProcess;
    private constructor();
    setLogLevel(logLevel: LogLevel): void;
    setLoggerCallback(callback: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any): void;
    init(): Promise<void>;
    start(): void;
    stop(): void;
    mainLoop(): Promise<void>;
    toJSON(): WalletBackendJSON;
    initAfterLoad(daemon: IDaemon): void;
    getNodeFee(): [string, number];
    getPrivateViewKey(): string;
    getSpendKeys(address: string): WalletError | [string, string];
    getPrimaryAddressPrivateKeys(): [string, string];
    getMnemonicSeed(): WalletError | string;
    getMnemonicSeedForAddress(address: string): WalletError | string;
    getPrimaryAddress(): string;
    private fetchAndStoreBlocks;
    private storeTxData;
    private processBlocks;
}
