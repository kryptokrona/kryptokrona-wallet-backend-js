// Copyright (C) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { SubWallet } from './SubWallet';
import { Transaction, UnconfirmedInput } from './Types';

export interface WalletBackendJSON {
    walletFileFormatVersion: number;

    subWallets: SubWalletsJSON;

    walletSynchronizer: WalletSynchronizerJSON;
}

export interface WalletSynchronizerJSON {
    startTimestamp: number;

    startHeight: number;

    privateViewKey: string;

    transactionSynchronizerStatus: SynchronizationStatusJSON;
}

export interface SubWalletJSON {
    unspentInputs: TransactionInputJSON[];

    lockedInputs: TransactionInputJSON[];

    spentInputs: TransactionInputJSON[];

    unconfirmedIncomingAmounts: UnconfirmedInputJSON[];

    publicSpendKey: string;

    /* NULL_SECRET_KEY if view wallet */
    privateSpendKey: string;

    syncStartTimestamp: number;

    syncStartHeight: number;

    address: string;

    isPrimaryAddress: boolean;
}

export interface TransactionJSON {
    transfers: TransfersJSON[];

    hash: string;

    fee: number;

    blockHeight: number;

    timestamp: number;

    paymentID: string;

    unlockTime: number;

    isCoinbaseTransaction: boolean;
}

export interface SubWalletsJSON {
    publicSpendKeys: string[];

    subWallet: SubWalletJSON[];

    transactions: TransactionJSON[];

    lockedTransactions: TransactionJSON[];

    privateViewKey: string;

    isViewWallet: boolean;

    txPrivateKeys: TxPrivateKeysJSON[];
}

export interface TxPrivateKeysJSON {
    transactionHash: string;

    txPrivateKey: string;
}

export function txPrivateKeysToVector(txPrivateKeys: Map<string, string>): TxPrivateKeysJSON[] {
    const arr: TxPrivateKeysJSON[] = [];

    for (const [hash, privateKey] of txPrivateKeys) {
        arr.push({transactionHash: hash, txPrivateKey: privateKey});
    }

    return arr;
}

export interface TransfersJSON {
    amount: number;

    publicKey: string;
}

export function transfersToVector(transfers: Map<string, number>): TransfersJSON[] {
    const arr: TransfersJSON[] = [];

    for (const [publicKey, amount] of transfers) {
        arr.push({amount, publicKey});
    }

    return arr;
}

export interface TransactionInputJSON {
    keyImage: string;

    amount: number;

    blockHeight: number;

    transactionPublicKey: string;

    transactionIndex: number;

    globalOutputIndex: number;

    key: string;

    spendHeight: number;

    unlockTime: number;

    parentTransactionHash: string;

    privateEphemeral?: string;
}

export interface UnconfirmedInputJSON {
    amount: number;

    key: string;

    parentTransactionHash: string;
}

export interface SynchronizationStatusJSON {
    blockHashCheckpoints: string[];

    lastKnownBlockHashes: string[];

    lastKnownBlockHeight: number;
}
