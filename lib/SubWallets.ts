// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

const CryptoUtils = require('./CnUtils');

import { Transaction } from './Types';
import { SubWallet } from './SubWallet';
import { SubWalletsJSON, txPrivateKeysToVector } from './JsonSerialization';

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

        let timestamp = 0;

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

    static fromJSON(json: SubWalletsJSON): SubWallets {
        let subWallets = Object.create(SubWallets.prototype);

        return Object.assign(subWallets, json, {
            publicSpendKeys: json.publicSpendKeys,

            subWallets: new Map<string, SubWallet>(
                json.subWallet.map(x => [x.publicSpendKey, SubWallet.fromJSON(x)] as [string, SubWallet])
            ),

            transactions: json.transactions.map(x => Transaction.fromJSON(x)),

            lockedTransactions: json.lockedTransactions.map(x => Transaction.fromJSON(x)),

            privateViewKey: json.privateViewKey,

            isViewWallet: json.isViewWallet,

            transactionPrivateKeys: new Map<string, string>(
                json.txPrivateKeys.map(x => [x.transactionHash, x.txPrivateKey] as [string, string])
            )
        });
    }

    toJSON(): SubWalletsJSON {
        return {
            publicSpendKeys: this.publicSpendKeys,

            subWallet: [...this.subWallets.values()].map(x => x.toJSON()),

            transactions: this.transactions.map(x => x.toJSON()),

            lockedTransactions: this.lockedTransactions.map(x => x.toJSON()),

            privateViewKey: this.privateViewKey,

            isViewWallet: this.isViewWallet,

            txPrivateKeys: txPrivateKeysToVector(this.transactionPrivateKeys)
        };
    }

    /* The public spend keys this wallet contains. Used for verifying if a 
       transaction is ours. */
    public publicSpendKeys: string[] = new Array();

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
