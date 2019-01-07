// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';
import { SubWalletsJSON, txPrivateKeysToVector } from './JsonSerialization';
import { SubWallet } from './SubWallet';
import { Transaction, TransactionInput } from './Types';
import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';

import * as _ from 'lodash';

export class SubWallets {

    public static fromJSON(json: SubWalletsJSON): SubWallets {
        const subWallets = Object.create(SubWallets.prototype);

        return Object.assign(subWallets, json, {
            publicSpendKeys: json.publicSpendKeys,

            subWallets: new Map<string, SubWallet>(
                json.subWallet.map((x) => [x.publicSpendKey, SubWallet.fromJSON(x)] as [string, SubWallet]),
            ),

            transactions: json.transactions.map((x) => Transaction.fromJSON(x)),

            lockedTransactions: json.lockedTransactions.map((x) => Transaction.fromJSON(x)),

            privateViewKey: json.privateViewKey,

            isViewWallet: json.isViewWallet,

            transactionPrivateKeys: new Map<string, string>(
                json.txPrivateKeys.map((x) => [x.transactionHash, x.txPrivateKey] as [string, string]),
            ),
        });
    }

    /* The public spend keys this wallet contains. Used for verifying if a
       transaction is ours. */
    public publicSpendKeys: string[] = [];

    /* Mapping of public spend key to subwallet */
    private subWallets: Map<string, SubWallet> = new Map();

    /* Our transactions */
    private transactions: Transaction[] = [];

    private lockedTransactions: Transaction[] = [];

    /* The shared private view key */
    private readonly privateViewKey: string;

    /* Whether the wallet is a view only wallet (cannot send transactions, only can view) */
    private readonly isViewWallet: boolean;

    /* A mapping of transaction hashes, to transaction private keys */
    private transactionPrivateKeys: Map<string, string> = new Map();
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
            privateSpendKey,
        );

        this.subWallets.set(publicKeys.publicSpendKey, subWallet);
    }

    public toJSON(): SubWalletsJSON {
        return {
            publicSpendKeys: this.publicSpendKeys,

            subWallet: [...this.subWallets.values()].map((x) => x.toJSON()),

            transactions: this.transactions.map((x) => x.toJSON()),

            lockedTransactions: this.lockedTransactions.map((x) => x.toJSON()),

            privateViewKey: this.privateViewKey,

            isViewWallet: this.isViewWallet,

            txPrivateKeys: txPrivateKeysToVector(this.transactionPrivateKeys),
        };
    }

    public getPrivateViewKey(): string {
        return this.privateViewKey;
    }

    public getPrivateSpendKey(publicSpendKey: string): [WalletError, string] {
        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            return [new WalletError(WalletErrorCode.ADDRESS_NOT_IN_WALLET), ''];
        }

        return [SUCCESS, subWallet.getPrivateSpendKey()];
    }

    /* Gets the 'primary' subwallet */
    public getPrimarySubWallet(): SubWallet {
        for (const [publicKey, subWallet] of this.subWallets) {
            if (subWallet.isPrimaryAddress()) {
                return subWallet;
            }
        }

        throw new Error('Wallet has no primary address!');
    }

    public getPrimaryAddress(): string {
        return this.getPrimarySubWallet().getAddress();
    }

    public getPrimaryPrivateSpendKey(): string {
        return this.getPrimarySubWallet().getPrivateSpendKey();
    }

    public getLockedTransactionHashes(): string[] {
        return this.lockedTransactions.map((x) => x.hash);
    }

    public addTransaction(transaction: Transaction): void {
        /* Remove this transaction from the locked data structure, if we had
           added it previously as an outgoing tx */
        _.remove(this.lockedTransactions, (tx) => {
            return tx.hash === transaction.hash;
        });

        if (this.transactions.some((tx) => tx.hash === transaction.hash)) {
            throw new Error('Transaction ' + transaction.hash + ' was added to the wallet twice!');
        }

        this.transactions.push(transaction);
    }

    public storeTransactionInput(publicSpendKey: string, input: TransactionInput): void {
        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }

        subWallet.storeTransactionInput(input, this.isViewWallet);
    }

    public markInputAsSpent(publicSpendKey: string, keyImage: string, spendHeight: number): void {
        const subWallet: SubWallet | undefined = this.subWallets.get(publicSpendKey);

        if (!subWallet) {
            throw new Error('Subwallet not found!');
        }

        subWallet.markInputAsSpent(keyImage, spendHeight);
    }

    public removeCancelledTransaction(transactionHash: string): void {
        /* Remove the tx if it was locked */
        _.remove(this.lockedTransactions, (tx) => {
            return tx.hash === transactionHash;
        });

        /* Remove the corresponding inputs */
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.removeCancelledTransaction(transactionHash);
        }
    }

    public removeForkedTransactions(forkHeight: number): void {
        _.remove(this.transactions, (tx) => {
            return tx.blockHeight >= forkHeight;
        });

        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.removeForkedTransactions(forkHeight);
        }
    }

    public convertSyncTimestampToHeight(timestamp: number, height: number): void {
        for (const [publicKey, subWallet] of this.subWallets) {
            subWallet.convertSyncTimestampToHeight(timestamp, height);
        }
    }
}
