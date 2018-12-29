// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

const CryptoUtils = require('./CnUtils');

import { WalletError, WalletErrorCode } from './WalletError';
import { IDaemon } from './IDaemon';
import { SubWallets } from './SubWallets';

export function importWalletFromSeed(
    mnemonicSeed: string,
    scanHeight: number,
    daemon: IDaemon): WalletBackend | WalletError {

    var keys;

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

class WalletBackend {
    constructor(
        daemon: IDaemon,
        address: string,
        scanHeight: number,
        newWallet: boolean,
        privateViewKey: string,
        privateSpendKey: string) {

        this.subWallets = new SubWallets(
            address, scanHeight, newWallet, privateViewKey, privateSpendKey
        );

        this.daemon = daemon;
    }

    /* Contains private keys, transactions, inputs, etc */
    private readonly subWallets: SubWallets;

    /* Interface to either a regular daemon or a blockchain cache api */
    private daemon: IDaemon;
}
