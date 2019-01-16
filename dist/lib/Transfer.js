"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const deepEqual = require("deep-equal");
const _ = require("lodash");
const CnUtils_1 = require("./CnUtils");
const ValidateParameters_1 = require("./ValidateParameters");
const WalletError_1 = require("./WalletError");
const Config_1 = require("./Config");
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
function sendTransactionBasic(daemon, subWallets, destination, amount, paymentID) {
    return sendTransactionAdvanced(daemon, subWallets, [[destination, amount]], undefined, undefined, paymentID);
}
exports.sendTransactionBasic = sendTransactionBasic;
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
function sendTransactionAdvanced(daemon, subWallets, addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress) {
    if (mixin === undefined) {
        mixin = Config_1.default.mixinLimits.getDefaultMixinByHeight(daemon.getNetworkBlockCount());
    }
    if (fee === undefined) {
        fee = Config_1.default.minimumFee;
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
    const error = validateTransaction(addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, daemon.getNetworkBlockCount(), subWallets);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    const tmp = [];
    /* convert integrated addresses to standard address + payment ID */
    for (const [address, amount] of addressesAndAmounts) {
        if (address.length !== Config_1.default.integratedAddressLength) {
            tmp.push([address, amount]);
            continue;
        }
        const decoded = CnUtils_1.CryptoUtils.decodeAddress(address);
        paymentID = decoded.paymentId;
        tmp.push([CnUtils_1.CryptoUtils.encodeRawAddress(decoded.rawAddress), amount]);
    }
    addressesAndAmounts = tmp;
    const totalAmount = _.sumBy(addressesAndAmounts, ([address, amount]) => amount) + fee;
    return 'TODO';
}
exports.sendTransactionAdvanced = sendTransactionAdvanced;
/**
 * Validate the given transaction parameters are valid.
 *
 * @return Returns either SUCCESS or an error representing the issue
 */
function validateTransaction(destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, currentHeight, subWallets) {
    /* Validate the destinations are valid */
    let error = ValidateParameters_1.validateDestinations(destinations);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Validate stored payment ID's in integrated addresses don't conflict */
    error = ValidateParameters_1.validateIntegratedAddresses(destinations, paymentID);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Verify the subwallets to take from exist */
    error = ValidateParameters_1.validateOurAddresses(subWalletsToTakeFrom, subWallets);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Verify we have enough money for the transaction */
    error = ValidateParameters_1.validateAmount(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Validate mixin is within the bounds for the current height */
    error = ValidateParameters_1.validateMixin(mixin, currentHeight);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    error = ValidateParameters_1.validatePaymentID(paymentID);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    error = ValidateParameters_1.validateOurAddresses([changeAddress], subWallets);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    return WalletError_1.SUCCESS;
}
