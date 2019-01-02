// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';
import { WalletError, WalletErrorCode } from './WalletError';
import { IDaemon } from './IDaemon';
import { SubWallets } from './SubWallets';
import { isHex64 } from './Utilities';
import { openWallet } from './OpenWallet';
import { WALLET_FILE_FORMAT_VERSION } from './Constants';
import { WalletSynchronizer } from './WalletSynchronizer';
import { WalletBackendJSON } from './JsonSerialization';
import { validateAddresses } from './ValidateParameters';

export class WalletBackend {
    constructor(
        daemon: IDaemon,
        address: string,
        scanHeight: number,
        newWallet: boolean,
        privateViewKey: string,
        privateSpendKey?: string) {

        this.subWallets = new SubWallets(
            address, scanHeight, newWallet, privateViewKey, privateSpendKey
        );

        let timestamp = 0;

        if (newWallet) {
            timestamp = new Date().valueOf();
        }

        this.walletSynchronizer = new WalletSynchronizer(
            daemon, timestamp, scanHeight, privateViewKey
        );

        this.daemon = daemon;
    }

    static openWalletFromFile(
        daemon: IDaemon,
        filename: string,
        password: string): WalletBackend | WalletError {

        const walletJSON = openWallet(filename, password)

        if (walletJSON instanceof WalletError) {
            return walletJSON as WalletError;
        }

        return WalletBackend.loadWalletFromJSON(daemon, walletJSON as string);
    }

    static loadWalletFromJSON(daemon: IDaemon, json: string): WalletBackend | WalletError {
        try {
            const wallet = JSON.parse(json, WalletBackend.reviver);
            wallet.setDaemon(daemon);
            return wallet;
        } catch (err) {
            return new WalletError(WalletErrorCode.WALLET_FILE_CORRUPTED);
        }
    }

    static fromJSON(json: WalletBackendJSON): WalletBackend {
        let wallet = Object.create(WalletBackend.prototype);

        const version = json.walletFileFormatVersion;

        if (version !== WALLET_FILE_FORMAT_VERSION) {
            throw new Error('Unsupported wallet file format version!');
        }

        return Object.assign(wallet, json, {
            subWallets: SubWallets.fromJSON(json.subWallets),
            walletSynchronizer: WalletSynchronizer.fromJSON(json.walletSynchronizer)
        });
    }

    static reviver(key: string, value: any): any {
        return key === "" ? WalletBackend.fromJSON(value) : value;
    }

    toJSON(): WalletBackendJSON {
        return {
            walletFileFormatVersion: WALLET_FILE_FORMAT_VERSION,
            subWallets: this.subWallets.toJSON(),
            walletSynchronizer: this.walletSynchronizer.toJSON()
        };
    }

    static importWalletFromSeed(
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
            keys.spend.privateKey
        );

        return wallet;
    }

    static importWalletFromKeys(
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
            keys.spend.privateKey
        );

        return wallet;
    }

    static importViewWallet(
        daemon: IDaemon,
        scanHeight: number,
        privateViewKey: string,
        address: string): WalletBackend | WalletError {

        if (!isHex64(privateViewKey)) {
            return new WalletError(WalletErrorCode.INVALID_KEY_FORMAT);
        }

        const integratedAddressesAllowed: boolean = false;

        const err: WalletError = validateAddresses(
            new Array(address), integratedAddressesAllowed
        );

        if (err.errorCode !== WalletErrorCode.SUCCESS) {
            return err;
        }

        if (scanHeight < 0) {
            return new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }

        /* Can't sync from the current scan height, not newly created */
        const newWallet: boolean = false;

        const wallet = new WalletBackend(
            daemon, address, scanHeight, newWallet, privateViewKey,
            undefined /* No private spend key */
        );

        return wallet;
    }

    static createWallet(daemon: IDaemon): WalletBackend {
        const newWallet: boolean = true;

        const scanHeight: number = 0;

        const keys = CryptoUtils.createNewAddress();

        const wallet = new WalletBackend(
            daemon, keys.address, scanHeight, newWallet, keys.view.privateKey,
            keys.spend.privateKey
        );

        return wallet;
    }

    setDaemon(daemon: IDaemon): void {
        this.daemon = daemon;
    }

    /* Contains private keys, transactions, inputs, etc */
    private readonly subWallets: SubWallets;

    /* Interface to either a regular daemon or a blockchain cache api */
    private daemon: IDaemon;

    private walletSynchronizer: WalletSynchronizer;
}
