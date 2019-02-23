"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const CnUtils_1 = require("./CnUtils");
const WalletError_1 = require("./WalletError");
const Config_1 = require("./Config");
/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
function validateAddresses(addresses, integratedAddressesAllowed) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    for (const address of addresses) {
        try {
            /* Verify address lengths are correct */
            if (address.length !== Config_1.Config.standardAddressLength
                && address.length !== Config_1.Config.integratedAddressLength) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_WRONG_LENGTH);
            }
            /* Verify every address character is in the base58 set */
            if (![...address].every((x) => alphabet.includes(x))) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_BASE58);
            }
            /* Verify checksum */
            const parsed = CnUtils_1.CryptoUtils().decodeAddress(address);
            /* Verify the prefix is correct */
            if (parsed.prefix !== Config_1.Config.addressPrefix) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_WRONG_PREFIX);
            }
            /* Verify it's not an integrated, if those aren't allowed */
            if (parsed.paymentId.length !== 0 && !integratedAddressesAllowed) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_IS_INTEGRATED);
            }
        }
        catch (err) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_VALID, err.toString());
        }
    }
    return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.SUCCESS);
}
exports.validateAddresses = validateAddresses;
/**
 * Validate the amounts being sent are valid, and the addresses are valid.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
function validateDestinations(destinations) {
    if (destinations.length === 0) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NO_DESTINATIONS_GIVEN);
    }
    const destinationAddresses = [];
    for (const [destination, amount] of destinations) {
        if (amount === 0) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.AMOUNT_IS_ZERO);
        }
        if (amount < 0) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }
        if (!Number.isInteger(amount)) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NON_INTEGER_GIVEN);
        }
        destinationAddresses.push(destination);
    }
    /* Validate the addresses, integrated addresses allowed */
    return validateAddresses(destinationAddresses, true);
}
exports.validateDestinations = validateDestinations;
/**
 * Validate that the payment ID's included in integrated addresses are valid.
 *
 * You should have already called validateAddresses() before this function
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
function validateIntegratedAddresses(destinations, paymentID) {
    for (const [destination, amount] of destinations) {
        if (destination.length !== Config_1.Config.integratedAddressLength) {
            continue;
        }
        /* Extract the payment ID */
        const parsedAddress = CnUtils_1.CryptoUtils().decodeAddress(destination);
        if (paymentID === '') {
            paymentID = parsedAddress.paymentId;
        }
        else if (paymentID !== parsedAddress.paymentId) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.CONFLICTING_PAYMENT_IDS);
        }
    }
    return WalletError_1.SUCCESS;
}
exports.validateIntegratedAddresses = validateIntegratedAddresses;
/**
 * Validate the the addresses given are both valid, and exist in the subwallet
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
function validateOurAddresses(addresses, subWallets) {
    const error = validateAddresses(addresses, false);
    if (!_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    for (const address of addresses) {
        const parsedAddress = CnUtils_1.CryptoUtils().decodeAddress(address);
        const keys = subWallets.getPublicSpendKeys();
        if (!keys.includes(parsedAddress.publicSpendKey)) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_IN_WALLET, `The address given (${address}) does not exist in the wallet ` +
                `container, but it is required to exist for this operation.`);
        }
    }
    return WalletError_1.SUCCESS;
}
exports.validateOurAddresses = validateOurAddresses;
/**
 * Validate that the transfer amount + fee is valid, and we have enough balance
 * Note: Does not verify amounts are positive / integer, validateDestinations
 * handles that.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
function validateAmount(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight) {
    if (fee < Config_1.Config.minimumFee) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.FEE_TOO_SMALL);
    }
    if (!Number.isInteger(fee)) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NON_INTEGER_GIVEN);
    }
    /* Get available balance, given the source addresses */
    const [availableBalance, lockedBalance] = subWallets.getBalance(currentHeight, subWalletsToTakeFrom);
    /* Get the sum of the transaction */
    const totalAmount = _.sumBy(destinations, ([destination, amount]) => amount) + fee;
    if (totalAmount > availableBalance) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_BALANCE);
    }
    /* Can't send more than 2^64 (Granted, that is larger than the entire
       supply, but you can still try ;) */
    if (totalAmount >= Math.pow(2, 64)) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WILL_OVERFLOW);
    }
    return WalletError_1.SUCCESS;
}
exports.validateAmount = validateAmount;
/**
 * Validates mixin is valid and in allowed range
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
function validateMixin(mixin, height) {
    if (mixin < 0) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN);
    }
    if (!Number.isInteger(mixin)) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NON_INTEGER_GIVEN);
    }
    const [minMixin, maxMixin] = Config_1.Config.mixinLimits.getMixinLimitsByHeight(height);
    if (mixin < minMixin) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.MIXIN_TOO_SMALL, `The mixin value given (${mixin}) is lower than the minimum mixin ` +
            `allowed (${minMixin})`);
    }
    if (mixin > maxMixin) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.MIXIN_TOO_BIG, `The mixin value given (${mixin}) is greater than the maximum mixin ` +
            `allowed (${maxMixin})`);
    }
    return WalletError_1.SUCCESS;
}
exports.validateMixin = validateMixin;
/**
 * Validates the payment ID is valid (or an empty string)
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
function validatePaymentID(paymentID) {
    if (paymentID === '') {
        return WalletError_1.SUCCESS;
    }
    if (paymentID.length !== 64) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.PAYMENT_ID_WRONG_LENGTH);
    }
    if (paymentID.match(new RegExp(/[a-zA-Z0-9]{64}/)) === null) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.PAYMENT_ID_INVALID);
    }
    return WalletError_1.SUCCESS;
}
exports.validatePaymentID = validatePaymentID;
