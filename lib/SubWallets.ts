// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

const CryptoUtils = require('./CnUtils');

import { Transaction } from './Types';
import { SubWallet } from './SubWallet';

export class SubWallets {
    /* Private spend key is optional if it's a view wallet */
    constructor(
        address: string,
        scanHeight: number,
        newWallet: boolean,
        privateViewKey: string,
        privateSpendKey?: string) {

        this.isViewWallet = privateSpendKey === undefined;
        this.privateViewKey = privateViewKey;

        var timestamp = 0;

        if (newWallet) {
            /* Unix timestamp */
            timestamp = new Date().valueOf();
        }

        const publicKeys = CryptoUtils.decodeAddress(address);

        this.publicSpendKeys.push(publicKeys.publicSpendKey);

        const subWallet = new SubWallet(
            address, scanHeight, timestamp, publicKeys.publicSpendKey,
            privateSpendKey
        );

        this.subWallets.set(publicKeys.publicSpendKey, subWallet);
    }

    /* The public spend keys this wallet contains. Used for verifying if a 
       transaction is ours. */
    public publicSpendKeys: string[] = [];

    /* Mapping of public spend key to subwallet */
    private subWallets: Map<string, SubWallet> = new Map();

    /* Our transactions */
    private transactions: Transaction[] = new Array();

    private lockedTransactions: Transaction[] = new Array();

    /* The shared private view key */
    private readonly privateViewKey: string;

    /* Whether the wallet is a view only wallet (cannot send transactions, only can view) */
    private readonly isViewWallet: boolean;

    /* A mapping of transaction hashes, to transaction private keys */
    private transactionPrivateKeys: Map<string, string> = new Map();
}
