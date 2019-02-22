// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils} from './CnUtils';
import { SubWalletJSON } from './JsonSerialization';
import { TransactionInput, TxInputAndOwner, UnconfirmedInput } from './Types';
import { isInputUnlocked } from './Utilities';
import { generateKeyImagePrimitive } from './CryptoWrapper';

import * as _ from 'lodash';

export class SubWallet {

    public static fromJSON(json: SubWalletJSON): SubWallet {
        const subWallet = Object.create(SubWallet.prototype);

        return Object.assign(subWallet, {
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

    /**
     * A vector of the stored transaction input data, to be used for
     * sending transactions later
     */
    private unspentInputs: TransactionInput[] = [];

    /**
     * Inputs which have been used in a transaction, and are waiting to
     * either be put into a block, or return to our wallet
     */
    private lockedInputs: TransactionInput[] = [];

    /**
     * Inputs which have been spent in a transaction
     */
    private spentInputs: TransactionInput[] = [];

    /**
     * Inputs which have come in from a transaction we sent - either from
     * change or from sending to ourself - we use this to display unlocked
     * balance correctly
     */
    private unconfirmedIncomingAmounts: UnconfirmedInput[] = [];

    /**
     * This subwallet's public spend key
     */
    private readonly publicSpendKey: string;

    /**
     * The subwallet's private spend key (undefined if view wallet)
     */
    private readonly privateSpendKey?: string;

    /**
     * The timestamp to begin syncing the wallet at
     * (usually creation time or zero)
     */
    private syncStartTimestamp: number = 0;

    /**
     * The height to begin syncing the wallet at
     */
    private syncStartHeight: number = 0;

    /**
     * This subwallet's public address
     */
    private readonly address: string;

    /**
     * The wallet has one 'main' address which we will use by default
     * when treating it as a single user wallet
     */
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

    /**
     * Get the private spend key, or null key if view wallet
     */
    public getPrivateSpendKey(): string {
        return this.privateSpendKey || '0'.repeat(64);
    }

    /**
     * Whether this address is the primary wallet address
     */
    public isPrimaryAddress(): boolean {
        return this.primaryAddress;
    }

    /**
     * Get this wallets address
     */
    public getAddress(): string {
        return this.address;
    }

    /**
     * Store an unspent input
     */
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

    /**
     * Move input from unspent/locked to spend container
     */
    public markInputAsSpent(keyImage: string, spendHeight: number): void {
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

    /**
     * Move an input from the unspent container to the locked container
     */
    public markInputAsLocked(keyImage: string): void {
        /* Remove input from unspent */
        const [removedInput] = _.remove(this.unspentInputs, (input) => {
            return input.keyImage === keyImage;
        });

        if (!removedInput) {
            throw new Error('Could not find key image to lock!');
        }

        /* Add to locked */
        this.lockedInputs.push(removedInput);
    }

    /**
     * Remove inputs belonging to a cancelled transaction and mark them as
     * unspent
     */
    public removeCancelledTransaction(transactionHash: string): void {
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

    /**
     * Remove transactions and inputs that occured after a fork height
     */
    public removeForkedTransactions(forkHeight: number): void {
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

    /**
     * Convert a timestamp to a height
     */
    public convertSyncTimestampToHeight(startTimestamp: number, startHeight: number): void {
        /* If we don't have a start timestamp then we don't need to convert */
        if (this.syncStartTimestamp !== 0) {
            this.syncStartTimestamp = startTimestamp;
            this.syncStartHeight = startHeight;
        }
    }

    /**
     * Whether the container includes this key image
     */
    public hasKeyImage(keyImage: string): boolean {
        if (this.unspentInputs.some((input) => input.keyImage === keyImage)) {
            return true;
        }

        if (this.lockedInputs.some((input) => input.keyImage === keyImage)) {
            return true;
        }

        return false;
    }

    /**
     * Generate the key image for this input
     */
    public async getTxInputKeyImage(
        derivation: string,
        outputIndex: number): Promise<string> {

        const [keyImage] = await generateKeyImagePrimitive(
            this.publicSpendKey, this.privateSpendKey as string, outputIndex,
            derivation,
        );

        return keyImage;
    }

    /**
     * Get the unlocked/locked balance at a given height
     */
    public getBalance(currentHeight: number): [number, number] {
        let unlockedBalance: number = 0;
        let lockedBalance: number = 0;

        for (const input of this.unspentInputs) {
            if (isInputUnlocked(input.unlockTime, currentHeight)) {
                unlockedBalance += input.amount;
            } else {
                lockedBalance += input.amount;
            }
        }

        lockedBalance += _.sumBy(this.unconfirmedIncomingAmounts, 'amount');

        return [unlockedBalance, lockedBalance];
    }

    /**
     * Get inputs that are available to be spent, and their keys
     */
    public getSpendableInputs(currentHeight: number): TxInputAndOwner[] {
        const inputs: TxInputAndOwner[] = [];

        for (const input of this.unspentInputs) {
            if (isInputUnlocked(input.unlockTime, currentHeight)) {
                inputs.push(
                    new TxInputAndOwner(
                        input, this.privateSpendKey as string, this.publicSpendKey,
                    ),
                );
            }
        }

        return inputs;
    }

    public storeUnconfirmedIncomingInput(input: UnconfirmedInput): void {
        this.unconfirmedIncomingAmounts.push(input);
    }
}
