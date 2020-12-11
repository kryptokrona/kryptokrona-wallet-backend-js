// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils} from './CnUtils';
import { SubWalletJSON } from './JsonSerialization';
import { logger, LogLevel, LogCategory } from './Logger';
import { TransactionInput, TxInputAndOwner, UnconfirmedInput } from './Types';
import { isInputUnlocked } from './Utilities';
import { generateKeyImagePrimitive } from './CryptoWrapper';
import { Config } from './Config';

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

    private config: Config = new Config();

    constructor(
        config: Config,
        address: string,
        scanHeight: number,
        timestamp: number,
        publicSpendKey: string,
        privateSpendKey?: string,
        primaryAddress: boolean = true) {

        this.address = address;
        this.syncStartHeight = scanHeight;
        this.syncStartTimestamp = timestamp;
        this.publicSpendKey = publicSpendKey;
        this.privateSpendKey = privateSpendKey;
        this.primaryAddress = primaryAddress;
        this.config = config;
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

    public pruneSpentInputs(pruneHeight: number) {
        const lenBeforePrune: number = this.spentInputs.length;

        /* Remove all spent inputs that are older than 5000 blocks old.
           It is assumed the blockchain cannot fork more than this, and this
           frees up a lot of disk space with large, old wallets. */
        _.remove(this.spentInputs, (input) => input.spendHeight > pruneHeight);

        const lenAfterPrune: number = this.spentInputs.length;

        const difference: number = lenBeforePrune - lenAfterPrune;

        if (difference !== 0) {
            logger.log(
                'Pruned ' + difference + ' spent inputs',
                LogLevel.DEBUG,
                LogCategory.SYNC,
            );
        }
    }

    public reset(scanHeight: number, scanTimestamp: number) {
        this.syncStartHeight = scanHeight;
        this.syncStartTimestamp = scanTimestamp;

        this.spentInputs = [];
        this.lockedInputs = [];
        this.unconfirmedIncomingAmounts = [];
        this.unspentInputs = [];
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
                return storedInput.key === input.key;
            });
        }

        const existingInput = this.unspentInputs.find((x) => x.key === input.key);

        if (existingInput !== undefined) {
            logger.log(
                `Input ${input.key} was added to the wallet twice!`,
                LogLevel.ERROR,
                LogCategory.SYNC,
            );

            return;
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
            logger.log(
                'Could not find key image to remove!',
                LogLevel.ERROR,
                LogCategory.SYNC,
            );

            return;
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
            logger.log(
                'Could not find key image to lock!',
                LogLevel.ERROR,
                LogCategory.SYNC,
            );

            return;
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
        }).map((input) => {
            input.spendHeight = 0;
            return input;
        });

        /* Add them to the unspent vector */
        this.unspentInputs = this.unspentInputs.concat(removed);

        /* Remove unconfirmed amounts we used to correctly calculate incoming
           change */
        _.remove(this.unconfirmedIncomingAmounts, (input) => {
            return input.parentTransactionHash === transactionHash;
        });
    }

    /**
     * Remove transactions and inputs that occured after a fork height
     */
    public removeForkedTransactions(forkHeight: number): string[] {
        /* This will get resolved by the wallet in time */
        this.unconfirmedIncomingAmounts = [];

        const removedLocked = _.remove(this.lockedInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });

        /* Remove unspent inputs which arrived after this height */
        const removedUnspent = _.remove(this.unspentInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });

        /* Remove spent inputs which arrived after this height */
        const removedSpent = _.remove(this.spentInputs, (input) => {
            return input.blockHeight >= forkHeight;
        });

        /* This input arrived before the fork height, but was spent after the
           fork height. So, we move them back into the unspent inputs vector. */
        const nowUnspent = _.remove(this.spentInputs, (input) => {
            return input.spendHeight >= forkHeight;
        });

        this.unspentInputs = this.unspentInputs.concat(
            nowUnspent.map((input) => { input.spendHeight = 0; return input; }),
        );

        /* Could do this with concat+map.. but i think this is a little more
           readable */
        const keyImagesToRemove: string[] = [];

        for (const input of removedLocked) {
            keyImagesToRemove.push(input.keyImage);
        }

        for (const input of removedUnspent) {
            keyImagesToRemove.push(input.keyImage);
        }

        for (const input of removedSpent) {
            keyImagesToRemove.push(input.keyImage);
        }

        return keyImagesToRemove;
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
     * Gets every stored key image
     */
    public getKeyImages(): string[] {
        let keyImages: string[] = [];

        keyImages = keyImages.concat(this.unspentInputs.map((x) => x.keyImage));
        keyImages = keyImages.concat(this.lockedInputs.map((x) => x.keyImage));
        keyImages = keyImages.concat(this.spentInputs.map((x) => x.keyImage));

        return keyImages;
    }

    /**
     * Generate the key image for this input
     */
    public async getTxInputKeyImage(
        derivation: string,
        outputIndex: number): Promise<[string, string]> {

        return generateKeyImagePrimitive(
            this.publicSpendKey, this.privateSpendKey as string, outputIndex,
            derivation, this.config,
        );
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
     * Gets the amount of funds returning to us as change from outgoing
     * unconfirmed transactions
     */
    public getUnconfirmedChange(): number {
        return _.sumBy(this.unconfirmedIncomingAmounts, 'amount');
    }

    public haveSpendableInput(input: TransactionInput, currentHeight: number): boolean {
        for (const i of this.unspentInputs) {
            if (input.key == i.key) {
                return isInputUnlocked(i.unlockTime, currentHeight);
            }
        }

        return false;
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

    public initAfterLoad(config: Config): void {
        this.config = config;
    }
}
