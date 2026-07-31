"use strict";
// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePaymentID = exports.validateMixin = exports.validateAmount = exports.validateOurAddresses = exports.validateIntegratedAddresses = exports.validateDestinations = exports.validateAddress = exports.validateAddresses = void 0;
const _ = require("lodash");
const kryptokrona_utils_1 = require("kryptokrona-utils");
const WalletError_1 = require("./WalletError");
const Config_1 = require("./Config");
const Assert_1 = require("./Assert");
/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 * @param config
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
function validateAddresses(addresses, integratedAddressesAllowed, config = new Config_1.Config()) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, Assert_1.assertArray)(addresses, 'addresses');
        (0, Assert_1.assertBoolean)(integratedAddressesAllowed, 'integratedAddressesAllowed');
        const tempConfig = (0, Config_1.MergeConfig)(config);
        const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        for (const address of addresses) {
            try {
                /* Verify address lengths are correct. Addresses under the alternate
                   prefix (see Config.addressPrefix / standardAddressLengthAlt) are a
                   character shorter/longer, so we accept those lengths too. */
                if (address.length !== tempConfig.standardAddressLength
                    && address.length !== tempConfig.integratedAddressLength
                    && address.length !== tempConfig.standardAddressLengthAlt
                    && address.length !== tempConfig.integratedAddressLengthAlt) {
                    return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_WRONG_LENGTH);
                }
                /* Verify every address character is in the base58 set */
                if (![...address].every((x) => alphabet.includes(x))) {
                    return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_BASE58);
                }
                const parsed = yield kryptokrona_utils_1.Address.fromAddress(address, tempConfig.addressPrefix);
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
    });
}
exports.validateAddresses = validateAddresses;
/**
 * Verifies that the address given is valid.
 * @param address The address to validate.
 * @param integratedAddressAllowed Should an integrated address be allowed?
 * @param config
 *
 * @returns Returns true if the address is valid, otherwise returns false
 *
 */
function validateAddress(address, integratedAddressAllowed, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const err = yield validateAddresses(new Array(address), integratedAddressAllowed, (0, Config_1.MergeConfig)(config));
        return err.errorCode === WalletError_1.WalletErrorCode.SUCCESS;
    });
}
exports.validateAddress = validateAddress;
/**
 * Validate the amounts being sent are valid, and the addresses are valid.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
function validateDestinations(destinations, config = new Config_1.Config()) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempConfig = (0, Config_1.MergeConfig)(config);
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
        return validateAddresses(destinationAddresses, true, tempConfig);
    });
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
function validateIntegratedAddresses(destinations, paymentID, config = new Config_1.Config()) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempConfig = (0, Config_1.MergeConfig)(config);
        for (const [destination] of destinations) {
            /* Skip non-integrated addresses. Accept both prefix forms, whose
               integrated addresses differ in length by a character (see
               Config.integratedAddressLengthAlt) -- otherwise an integrated address
               under the alternate prefix would have its payment ID silently
               ignored. */
            if (destination.length !== tempConfig.integratedAddressLength
                && destination.length !== tempConfig.integratedAddressLengthAlt) {
                continue;
            }
            /* Extract the payment ID */
            const parsedAddress = yield kryptokrona_utils_1.Address.fromAddress(destination, tempConfig.addressPrefix);
            if (paymentID === '') {
                paymentID = parsedAddress.paymentId;
            }
            else if (paymentID !== parsedAddress.paymentId) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.CONFLICTING_PAYMENT_IDS);
            }
        }
        return WalletError_1.SUCCESS;
    });
}
exports.validateIntegratedAddresses = validateIntegratedAddresses;
/**
 * Validate the the addresses given are both valid, and exist in the subwallet
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
function validateOurAddresses(addresses, subWallets, config = new Config_1.Config()) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempConfig = (0, Config_1.MergeConfig)(config);
        const error = yield validateAddresses(addresses, false, tempConfig);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        for (const address of addresses) {
            const parsedAddress = yield kryptokrona_utils_1.Address.fromAddress(address, tempConfig.addressPrefix);
            const keys = subWallets.getPublicSpendKeys();
            if (!keys.includes(parsedAddress.spend.publicKey)) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_IN_WALLET, `The address given (${address}) does not exist in the wallet ` +
                    `container, but it is required to exist for this operation.`);
            }
        }
        return WalletError_1.SUCCESS;
    });
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
function validateAmount(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight, config = new Config_1.Config()) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempConfig = (0, Config_1.MergeConfig)(config);
        if (!fee.isFeePerByte && !fee.isFixedFee) {
            throw new Error('Programmer error: Fee type not specified!');
        }
        /* Using a fee per byte, and doesn't meet the min fee per byte requirement. */
        if (fee.isFeePerByte && fee.feePerByte < tempConfig.minimumFeePerByte) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.FEE_TOO_SMALL);
        }
        /* Cannot have a non integer fixed fee */
        if (fee.isFixedFee && !Number.isInteger(fee.fixedFee)) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NON_INTEGER_GIVEN);
        }
        /* Get available balance, given the source addresses */
        const [availableBalance] = yield subWallets.getBalance(currentHeight, subWalletsToTakeFrom);
        /* Get the sum of the transaction */
        let totalAmount = _.sumBy(destinations, ([, amount]) => amount);
        /* Can only accurately calculate if we've got enough funds for the tx if
         * using a fixed fee. If using a fee per byte, we'll verify when constructing
         * the transaction. */
        if (fee.isFixedFee) {
            totalAmount += fee.fixedFee;
        }
        if (totalAmount > availableBalance) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_BALANCE);
        }
        /* Can't send more than 2^64 (Granted, that is larger than the entire
           supply, but you can still try ;) */
        if (totalAmount >= Math.pow(2, 64)) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WILL_OVERFLOW);
        }
        return WalletError_1.SUCCESS;
    });
}
exports.validateAmount = validateAmount;
/**
 * Validates mixin is valid and in allowed range
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
function validateMixin(mixin, height, config = new Config_1.Config()) {
    const tempConfig = (0, Config_1.MergeConfig)(config);
    if (mixin < 0) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NEGATIVE_VALUE_GIVEN);
    }
    if (!Number.isInteger(mixin)) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NON_INTEGER_GIVEN);
    }
    const [minMixin, maxMixin] = tempConfig.mixinLimits.getMixinLimitsByHeight(height);
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
function validatePaymentID(paymentID, allowEmptyString = true) {
    (0, Assert_1.assertString)(paymentID, 'paymentID');
    (0, Assert_1.assertBoolean)(allowEmptyString, 'allowEmptyString');
    if (paymentID === '' && allowEmptyString) {
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
