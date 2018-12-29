// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import { TransactionInput, UnconfirmedInput } from './Types';

export class SubWallet {
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
        this.isPrimaryAddress = true;
    }

    /* A vector of the stored transaction input data, to be used for
       sending transactions later */
    private unspentInputs: TransactionInput[] = new Array();

    /* Inputs which have been used in a transaction, and are waiting to
       either be put into a block, or return to our wallet */
    private lockedInputs: TransactionInput[] = new Array();

    /* Inputs which have been spent in a transaction */
    private spentInputs: TransactionInput[] = new Array();

    /* Inputs which have come in from a transaction we sent - either from
       change or from sending to ourself - we use this to display unlocked
       balance correctly */
    private unconfirmedIncomingAmounts: UnconfirmedInput[] = new Array();

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
    private readonly isPrimaryAddress: boolean;
}
