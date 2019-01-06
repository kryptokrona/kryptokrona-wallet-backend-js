// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import deepEqual = require('deep-equal');

import config from './Config';

import { CryptoUtils } from './CnUtils';
import { WALLET_FILE_FORMAT_VERSION } from './Constants';
import { IDaemon } from './IDaemon';
import { WalletBackendJSON } from './JsonSerialization';
import { Metronome } from './Metronome';
import { openWallet } from './OpenWallet';
import { SubWallets } from './SubWallets';
import { Block, TransactionData } from './Types';
import { addressToKeys, isHex64 } from './Utilities';
import { validateAddresses } from './ValidateParameters';
import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';
import { WalletSynchronizer } from './WalletSynchronizer';

export class WalletBackend {

    /* Opens a wallet given a filepath and a password */
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

    /* Opens a wallet from a valid wallet JSON string (unencrypted) */
    public static loadWalletFromJSON(daemon: IDaemon, json: string): WalletBackend | WalletError {
        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.setDaemon(daemon);
            return wallet;
        } catch (err) {
            console.log(err);
            return new WalletError(WalletErrorCode.WALLET_FILE_CORRUPTED);
        }
    }

    /* Loads a wallet from a WalletBackendJSON */
    public static fromJSON(json: WalletBackendJSON): WalletBackend {
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

    /* Utility function for nicer JSON parsing function */
    public static reviver(key: string, value: any): any {
        return key === '' ? WalletBackend.fromJSON(value) : value;
    }

    /* Imports a wallet from a mnemonic seed */
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

    /* Imports a wallet from a spend and view key */
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

    /* Imports a view only wallet */
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

    /* Creates a wallet with a random key pair (it will be a determinstic/
       mnemonic wallet, however */
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

    /* Contains private keys, transactions, inputs, etc */
    private readonly subWallets: SubWallets;

    /* Interface to either a regular daemon or a blockchain cache api */
    private daemon: IDaemon;

    /* Wallet synchronization state */
    private walletSynchronizer: WalletSynchronizer;

    /* Executes the main loop every n seconds for us */
    private mainLoopExecutor: Metronome;

    constructor(
        daemon: IDaemon,
        address: string,
        scanHeight: number,
        newWallet: boolean,
        privateViewKey: string,
        privateSpendKey?: string) {

        this.subWallets = new SubWallets(
            address, scanHeight, newWallet, privateViewKey, privateSpendKey,
        );

        let timestamp = 0;

        if (newWallet) {
            timestamp = new Date().valueOf();
        }

        this.walletSynchronizer = new WalletSynchronizer(
            daemon, timestamp, scanHeight, privateViewKey,
        );

        this.daemon = daemon;

        this.mainLoopExecutor = new Metronome(
            this.mainLoop.bind(this), config.mainLoopInterval,
        );
    }

    /* Fetch initial daemon info and fee. Should we do this in the constructor
       instead...? Well... not much point wasting time if they just want to
       make a wallet */
    public async init(): Promise<void> {
        await this.daemon.init();
    }

    /* Starts the main loop */
    public start(): void {
        this.mainLoopExecutor.start();
    }

    /* Stops the main loop */
    public stop(): void {
        this.mainLoopExecutor.stop();
    }

    public async mainLoop(): Promise<void> {
        this.daemon.getDaemonInfo();

        const blocks: Block[] = await this.walletSynchronizer.getBlocks();

        for (const block of blocks) {
            /* Forked chain, remove old data */
            if (this.walletSynchronizer.getHeight() >= block.blockHeight) {
                this.subWallets.removeForkedTransactions(block.blockHeight);
            }

            let txData: TransactionData = new TransactionData();

            /* Process the coinbase tx */
            txData = this.walletSynchronizer.processCoinbaseTransaction(
                block.coinbaseTransaction, txData,
            );

            /* Process the normal txs */
            for (const tx of block.transactions) {
                txData = this.walletSynchronizer.processTransaction(tx, txData);
            }

            /* Store the block hash we just processed */
            this.walletSynchronizer.storeBlockHash(block.blockHeight, block.blockHash);

            /* Store any transactions */
            for (const transaction of txData.transactionsToAdd) {
                this.subWallets.addTransaction(transaction);
            }

            /* Store any corresponding inputs */
            for (const [publicKey, input] of txData.inputsToAdd) {
                this.subWallets.storeTransactionInput(publicKey, input);
            }

            /* Mark any spent key images */
            for (const [publicKey, keyImage] of txData.keyImagesToMarkSpent) {
                this.subWallets.markInputAsSpent(publicKey, keyImage, block.blockHeight);
            }
        }

        if (this.walletSynchronizer.getHeight() >= this.daemon.getNetworkBlockCount()) {
            const lockedTransactionHashes: string[] = this.subWallets.getLockedTransactionHashes();

            const cancelledTransactions: string[]
                = await this.walletSynchronizer.checkLockedTransactions(lockedTransactionHashes);

            for (const cancelledTX of cancelledTransactions) {
                this.subWallets.removeCancelledTransaction(cancelledTX);
            }
        }
    }

    /* Converts recursively from typescript to JSON data. Can be dumped to file */
    public toJSON(): WalletBackendJSON {
        return {
            subWallets: this.subWallets.toJSON(),
            walletFileFormatVersion: WALLET_FILE_FORMAT_VERSION,
            walletSynchronizer: this.walletSynchronizer.toJSON(),
        };
    }

    /* Assign the daemon, if you created the object from JSON for example */
    public setDaemon(daemon: IDaemon): void {
        this.daemon = daemon;
    }

    public getNodeFee(): [string, number] {
        return this.daemon.nodeFee();
    }

    /* Gets the shared private view key */
    public getPrivateViewKey(): string {
        return this.subWallets.getPrivateViewKey();
    }

    /* Gets the [publicSpendKey, privateSpendKey] for the given address, if
       possible. Note: secret key will be 00000... if view wallet */
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

    /* Get the private spend and private view for the primary address */
    public getPrimaryAddressPrivateKeys(): [string, string] {
        return [this.subWallets.getPrimaryPrivateSpendKey(), this.getPrivateViewKey()];
    }

    /* Get the primary address mnemonic seed, if possible */
    public getMnemonicSeed(): WalletError | string {
        return this.getMnemonicSeedForAddress(this.subWallets.getPrimaryAddress());
    }

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
}
