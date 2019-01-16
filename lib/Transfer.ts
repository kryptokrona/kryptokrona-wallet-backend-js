// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import deepEqual = require('deep-equal');

import * as _ from 'lodash';

import { CryptoUtils } from './CnUtils';
import { IDaemon } from './IDaemon';
import { SubWallets } from './SubWallets';

import {
    validateAddresses, validateAmount, validateDestinations,
    validateIntegratedAddresses, validateMixin, validateOurAddresses,
    validatePaymentID,
} from './ValidateParameters';

import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';

import config from './Config';

/**
 * Sends a transaction of amount to the address destination, using the
 * given payment ID, if specified.
 *
 * Network fee is set to default, mixin is set to default, all subwallets
 * are taken from, primary address is used as change address.
 *
 * If you need more control, use `sendTransactionAdvanced()`
 *
 * @param destination   The address to send the funds to
 * @param amount        The amount to send, in ATOMIC units
 * @param paymentID     The payment ID to include with this transaction. Optional.
 *
 * @return Returns either an error, or the transaction hash.
 */
export function sendTransactionBasic(
    daemon: IDaemon,
    subWallets: SubWallets,
    destination: string,
    amount: number,
    paymentID?: string): WalletError | string {

    return sendTransactionAdvanced(
        daemon,
        subWallets,
        [[destination, amount]],
        undefined,
        undefined,
        paymentID,
    );
}

/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon, subWallets, and addressesAndAmounts.
 *
 * @param addressesAndAmounts   An array of destinations, and amounts to send to that
 *                              destination.
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param fee                   The network fee to use with this transaction. In ATOMIC units.
 * @param paymentID             The payment ID to include with this transaction.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param changeAddress         The address to send any returned change to.
 */
export function sendTransactionAdvanced(
    daemon: IDaemon,
    subWallets: SubWallets,
    addressesAndAmounts: Array<[string, number]>,
    mixin?: number,
    fee?: number,
    paymentID?: string,
    subWalletsToTakeFrom?: string[],
    changeAddress?: string): WalletError | string {

    if (mixin === undefined) {
        mixin = config.mixinLimits.getDefaultMixinByHeight(
            daemon.getNetworkBlockCount(),
        );
    }

    if (fee === undefined) {
        fee = config.minimumFee;
    }

    if (paymentID === undefined) {
        paymentID = '';
    }

    if (subWalletsToTakeFrom === undefined || subWalletsToTakeFrom.length === 0) {
        subWalletsToTakeFrom = subWallets.getAddresses();
    }

    if (changeAddress === undefined || changeAddress === '') {
        changeAddress = subWallets.getPrimaryAddress();
    }

    const [feeAddress, feeAmount] = daemon.nodeFee();

    /* Add the node fee, if it exists */
    if (feeAmount !== 0) {
        addressesAndAmounts.push([feeAddress, feeAmount]);
    }

    const error: WalletError = validateTransaction(
        addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom,
        changeAddress, daemon.getNetworkBlockCount(), subWallets,
    );

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    const tmp: Array<[string, number]> = [];

    /* convert integrated addresses to standard address + payment ID */
    for (const [address, amount] of addressesAndAmounts) {
        if (address.length !== config.integratedAddressLength) {
            tmp.push([address, amount]);
            continue;
        }

        const decoded = CryptoUtils.decodeAddress(address);

        paymentID = decoded.paymentId;

        tmp.push([CryptoUtils.encodeRawAddress(decoded.rawAddress), amount]);
    }

    addressesAndAmounts = tmp;

    const totalAmount: number = _.sumBy(
        addressesAndAmounts, ([address, amount]) => amount,
    ) + fee;

    return 'TODO';
}

/**
 * Validate the given transaction parameters are valid.
 *
 * @return Returns either SUCCESS or an error representing the issue
 */
function validateTransaction(
    destinations: Array<[string, number]>,
    mixin: number,
    fee: number,
    paymentID: string,
    subWalletsToTakeFrom: string[],
    changeAddress: string,
    currentHeight: number,
    subWallets: SubWallets) {

    /* Validate the destinations are valid */
    let error: WalletError = validateDestinations(destinations);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    /* Validate stored payment ID's in integrated addresses don't conflict */
    error = validateIntegratedAddresses(destinations, paymentID);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    /* Verify the subwallets to take from exist */
    error = validateOurAddresses(subWalletsToTakeFrom, subWallets);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    /* Verify we have enough money for the transaction */
    error = validateAmount(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    /* Validate mixin is within the bounds for the current height */
    error = validateMixin(mixin, currentHeight);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    error = validatePaymentID(paymentID);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    error = validateOurAddresses([changeAddress], subWallets);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    return SUCCESS;
}
