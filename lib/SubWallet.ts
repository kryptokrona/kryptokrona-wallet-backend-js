// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { SubWalletJSON } from './JsonSerialization';
import { TransactionInput, UnconfirmedInput } from './Types';

import * as _ from 'lodash';

export class SubWallet {

    public static fromJSON(json: SubWalletJSON): SubWallet {
        const subWallet = Object.create(SubWallet.prototype);

        return Object.assign(subWallet, json, {
            unspentInputs: json.unspentInputs.map((x) => TransactionInput.fromJSON(x)),

            lockedInputs: json.lockedInputs.map((x) => TransactionInput.fromJSON(x)),

            spentInputs: json.spentInputs.map((x) => TransactionInput.fromJSON(x)),

            unconfirmedIncomingAmounts: json.unconfirmedIncomingAmounts.map(
                (x) => UnconfirmedInput.fromJSON(x),
            ),

            publicSpendKey: json.publicSpendKey,

            privateSpendKey: json.privateSpendKey === '0'.repeat(64) ? undefined : json.privateSpendKey,

            syncStartTimestamp: json.syncStartTimestamp,

            syncStartHeight: json.syncStartHeight,

            address: json.address,

            primaryAddress: json.isPrimaryAddress,
        });
    }

    /* A vector of the stored transaction input data, to be used for
       sending transactions later */
    private unspentInputs: TransactionInput[] = [];

    /* Inputs which have been used in a transaction, and are waiting to
       either be put into a block, or return to our wallet */
    private lockedInputs: TransactionInput[] = [];

    /* Inputs which have been spent in a transaction */
    private spentInputs: TransactionInput[] = [];

    /* Inputs which have come in from a transaction we sent - either from
       change or from sending to ourself - we use this to display unlocked
       balance correctly */
    private unconfirmedIncomingAmounts: UnconfirmedInput[] = [];

    /* This subwallet's public spend key */
    private readonly publicSpendKey: string;

    /* The subwallet's private spend key (undefined if view wallet) */
    private readonly privateSpendKey?: string;

    /* The timestamp to begin syncing the wallet at
       (usually creation time or zero) */
    private syncStartTimestamp: number = 0;

    /* The height to begin syncing the wallet at */
    private syncStartHeight: number = 0;

    /* This subwallet's public address */
    private readonly address: string;

    /* The wallet has one 'main' address which we will use by default
       when treating it as a single user wallet */
    private readonly primaryAddress: boolean;
    constructor(
        address: string,
        scanHeight: number,
        timestamp: number,
        publicSpendKey: string,
        privateSpendKey?: string) {

        this.address = address;
        this.syncStartHeight = scanHeight;
        this.syncStartTimestamp = timestamp;
        this.publicSpendKey = publicSpendKey;
        this.privateSpendKey = privateSpendKey;
        this.primaryAddress = true;
    }

    public toJSON(): SubWalletJSON {
        return {
            unspentInputs: this.unspentInputs.map((x) => x.toJSON()),

            lockedInputs: this.lockedInputs.map((x) => x.toJSON()),

            spentInputs: this.spentInputs.map((x) => x.toJSON()),

            unconfirmedIncomingAmounts: this.unconfirmedIncomingAmounts.map((x) => x.toJSON()),

            publicSpendKey: this.publicSpendKey,

            /* Null secret key if view wallet */
            privateSpendKey: this.privateSpendKey ? this.privateSpendKey : '0'.repeat(64),

            syncStartTimestamp: this.syncStartTimestamp,

            syncStartHeight: this.syncStartHeight,

            address: this.address,

            isPrimaryAddress: this.primaryAddress,
        };
    }

    public getPrivateSpendKey(): string {
        return this.privateSpendKey || '0'.repeat(64);
    }

    public isPrimaryAddress(): boolean {
        return this.primaryAddress;
    }

    public getAddress(): string {
        return this.address;
    }

    public storeTransactionInput(input: TransactionInput, isViewWallet: boolean): void {
        if (!isViewWallet) {
            /* Find the input in the unconfirmed incoming amounts - inputs we
               sent ourselves, that are now returning as change. Remove from
               vector if found. */
            _.remove(this.unconfirmedIncomingAmounts, (storedInput) => {
                return storedInput.key !== input.key;
            });
        }

        this.unspentInputs.push(input);
    }

    public markInputAsSpent(keyImage: string, spendHeight: number) {
        /* Remove from unspent if exists */
        let [removedInput] = _.remove(this.unspentInputs, (input) => {
            return input.keyImage === keyImage;
        });

        if (!removedInput) {
            /* Not in unspent, check locked */
            [removedInput] = _.remove(this.lockedInputs, (input) => {
                return input.keyImage === keyImage;
            });
        }

        if (!removedInput) {
            throw new Error('Could not find key image to remove!');
        }

        removedInput.spendHeight = spendHeight;

        this.spentInputs.push(removedInput);
    }

    public removeCancelledTransaction(transactionHash: string) {
        /* Find inputs used in the cancelled transaction, and remove them from
           the locked inputs */
        const removed: TransactionInput[] = _.remove(this.lockedInputs, (input) => {
            return input.parentTransactionHash === transactionHash;
        });

        /* Add them to the unspent vector */
        this.unspentInputs = this.unspentInputs.concat(
            /* Mark them as no longer spent */
            removed.map((input) => {
                input.spendHeight = 0;
                return input;
            }),
        );

        /* Remove unconfirmed amounts we used to correctly calculate incoming
           change */
        _.remove(this.unconfirmedIncomingAmounts, (input) => {
            return input.parentTransactionHash === transactionHash;
        });
    }

    public removeForkedTransactions(forkHeight: number) {
        this.lockedInputs = [];
        this.unconfirmedIncomingAmounts = [];

        _.remove(this.unspentInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });

        /* unspent, formerly spent */
        const unspent = _.remove(this.spentInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });

        unspent.map((input) => input.spendHeight = 0);

        /* Add to unspent vector */
        this.unspentInputs.concat(
            /* Mark as no longer spent */
            unspent.map((input) => {
                input.spendHeight = 0;
                return input;
            }),
        );
    }

    public convertSyncTimestampToHeight(startTimestamp: number, startHeight: number) {
        /* If we don't have a start timestamp then we don't need to convert */
        if (this.syncStartTimestamp !== 0) {
            this.syncStartTimestamp = startTimestamp;
            this.syncStartHeight = startHeight;
        }
    }
}
