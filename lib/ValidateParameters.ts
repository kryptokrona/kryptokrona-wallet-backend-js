// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

import { FeeType } from './FeeType';
import { CryptoUtils} from './CnUtils';
import { SubWallets } from './SubWallets';
import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';

import { Config, MergeConfig, IConfig } from './Config';
import { assertString, assertArray, assertBoolean } from './Assert';

/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validateAddresses(
    addresses: string[],
    integratedAddressesAllowed: boolean,
    config: IConfig = new Config()): WalletError {

    assertArray(addresses, 'addresses');
    assertBoolean(integratedAddressesAllowed, 'integratedAddressesAllowed');

    const tempConfig: Config = MergeConfig(config);

    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    for (const address of addresses) {
        try {
            /* Verify address lengths are correct */
            if (address.length !== config.standardAddressLength
             && address.length !== config.integratedAddressLength) {
                return new WalletError(WalletErrorCode.ADDRESS_WRONG_LENGTH);
            }

            /* Verify every address character is in the base58 set */
            if (![...address].every((x) => alphabet.includes(x))) {
                return new WalletError(WalletErrorCode.ADDRESS_NOT_BASE58);
            }

            /* Verify checksum */
            const parsed = CryptoUtils(tempConfig).decodeAddress(address);

            /* Verify the prefix is correct */
            if (parsed.prefix !== tempConfig.addressPrefix) {
                return new WalletError(WalletErrorCode.ADDRESS_WRONG_PREFIX);
            }

            /* Verify it's not an integrated, if those aren't allowed */
            if (parsed.paymentId.length !== 0 && !integratedAddressesAllowed) {
                return new WalletError(WalletErrorCode.ADDRESS_IS_INTEGRATED);
            }
        } catch (err) {
            return new WalletError(WalletErrorCode.ADDRESS_NOT_VALID, err.toString());
        }
    }

    return new WalletError(WalletErrorCode.SUCCESS);
}

/**
 * Verifies that the address given is valid.
 * @param address The address to validate.
 * @param integratedAddressAllowed Should an integrated address be allowed?
 *
 * @returns Returns true if the address is valid, otherwise returns false
 *
 */
export function validateAddress(
    address: string,
    integratedAddressAllowed: boolean,
    config?: IConfig): boolean {

    const err: WalletError = validateAddresses(
        new Array(address), integratedAddressAllowed, MergeConfig(config),
    );

    return err.errorCode === WalletErrorCode.SUCCESS;
}

/**
 * Validate the amounts being sent are valid, and the addresses are valid.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export function validateDestinations(
    destinations: Array<[string, number]>,
    config: IConfig = new Config()): WalletError {

    const tempConfig: Config = MergeConfig(config);

    if (destinations.length === 0) {
        return new WalletError(WalletErrorCode.NO_DESTINATIONS_GIVEN);
    }

    const destinationAddresses: string[] = [];

    for (const [destination, amount] of destinations) {
        if (amount === 0) {
            return new WalletError(WalletErrorCode.AMOUNT_IS_ZERO);
        }

        if (amount < 0) {
            return new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }

        if (!Number.isInteger(amount)) {
            return new WalletError(WalletErrorCode.NON_INTEGER_GIVEN);
        }

        destinationAddresses.push(destination);
    }

    /* Validate the addresses, integrated addresses allowed */
    return validateAddresses(destinationAddresses, true, tempConfig);
}

/**
 * Validate that the payment ID's included in integrated addresses are valid.
 *
 * You should have already called validateAddresses() before this function
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export function validateIntegratedAddresses(
    destinations: Array<[string, number]>,
    paymentID: string,
    config: IConfig = new Config()): WalletError {

    const tempConfig: Config = MergeConfig(config);

    for (const [destination, amount] of destinations) {
        if (destination.length !== tempConfig.integratedAddressLength) {
            continue;
        }

        /* Extract the payment ID */
        const parsedAddress = CryptoUtils(tempConfig).decodeAddress(destination);

        if (paymentID === '') {
            paymentID = parsedAddress.paymentId;
        } else if (paymentID !== parsedAddress.paymentId) {
            return new WalletError(WalletErrorCode.CONFLICTING_PAYMENT_IDS);
        }
    }

    return SUCCESS;
}

/**
 * Validate the the addresses given are both valid, and exist in the subwallet
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export function validateOurAddresses(
    addresses: string[],
    subWallets: SubWallets,
    config: IConfig = new Config()): WalletError {

    const tempConfig: Config = MergeConfig(config);

    const error: WalletError = validateAddresses(addresses, false, tempConfig);

    if (!_.isEqual(error, SUCCESS)) {
        return error;
    }

    for (const address of addresses) {
        const parsedAddress = CryptoUtils(tempConfig).decodeAddress(address);

        const keys: string[] = subWallets.getPublicSpendKeys();

        if (!keys.includes(parsedAddress.publicSpendKey)) {
            return new WalletError(
                WalletErrorCode.ADDRESS_NOT_IN_WALLET,
                `The address given (${address}) does not exist in the wallet ` +
                `container, but it is required to exist for this operation.`,
            );
        }
    }

    return SUCCESS;
}

/**
 * Validate that the transfer amount + fee is valid, and we have enough balance
 * Note: Does not verify amounts are positive / integer, validateDestinations
 * handles that.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export function validateAmount(
    destinations: Array<[string, number]>,
    fee: FeeType,
    subWalletsToTakeFrom: string[],
    subWallets: SubWallets,
    currentHeight: number,
    config: IConfig = new Config()): WalletError {

    const tempConfig: Config = MergeConfig(config);

    if (!fee.isFeePerByte && !fee.isFixedFee) {
        throw new Error('Programmer error: Fee type not specified!');
    }

    /* Using a fee per byte, and doesn't meet the min fee per byte requirement. */
    if (fee.isFeePerByte && fee.feePerByte < tempConfig.minimumFeePerByte) {
        return new WalletError(WalletErrorCode.FEE_TOO_SMALL);
    }

    /* Cannot have a non integer fixed fee */
    if (fee.isFixedFee && !Number.isInteger(fee.fixedFee)) {
        return new WalletError(WalletErrorCode.NON_INTEGER_GIVEN);
    }

    /* Get available balance, given the source addresses */
    const [availableBalance, lockedBalance] = subWallets.getBalance(
        currentHeight, subWalletsToTakeFrom,
    );

    /* Get the sum of the transaction */
    let totalAmount: number = _.sumBy(destinations, ([destination, amount]) => amount);

    /* Can only accurately calculate if we've got enough funds for the tx if
     * using a fixed fee. If using a fee per byte, we'll verify when constructing
     * the transaction. */
    if (fee.isFixedFee) {
        totalAmount += fee.fixedFee;
    }

    if (totalAmount > availableBalance) {
        return new WalletError(WalletErrorCode.NOT_ENOUGH_BALANCE);
    }

    /* Can't send more than 2^64 (Granted, that is larger than the entire
       supply, but you can still try ;) */
    if (totalAmount >= 2 ** 64) {
        return new WalletError(WalletErrorCode.WILL_OVERFLOW);
    }

    return SUCCESS;
}

/**
 * Validates mixin is valid and in allowed range
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export function validateMixin(
    mixin: number,
    height: number,
    config: IConfig = new Config()): WalletError {

    const tempConfig: Config = MergeConfig(config);

    if (mixin < 0) {
        return new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN);
    }

    if (!Number.isInteger(mixin)) {
        return new WalletError(WalletErrorCode.NON_INTEGER_GIVEN);
    }

    const [minMixin, maxMixin] = tempConfig.mixinLimits.getMixinLimitsByHeight(height);

    if (mixin < minMixin) {
        return new WalletError(
            WalletErrorCode.MIXIN_TOO_SMALL,
            `The mixin value given (${mixin}) is lower than the minimum mixin ` +
            `allowed (${minMixin})`,
        );
    }

    if (mixin > maxMixin) {
        return new WalletError(
            WalletErrorCode.MIXIN_TOO_BIG,
            `The mixin value given (${mixin}) is greater than the maximum mixin ` +
            `allowed (${maxMixin})`,
        );
    }

    return SUCCESS;
}

/**
 * Validates the payment ID is valid (or an empty string)
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validatePaymentID(paymentID: string, allowEmptyString: boolean = true): WalletError {
    assertString(paymentID, 'paymentID');
    assertBoolean(allowEmptyString, 'allowEmptyString');

    if (paymentID === '' && allowEmptyString) {
        return SUCCESS;
    }

    if (paymentID.length !== 64) {
        return new WalletError(WalletErrorCode.PAYMENT_ID_WRONG_LENGTH);
    }

    if (paymentID.match(new RegExp(/[a-zA-Z0-9]{64}/)) === null) {
        return new WalletError(WalletErrorCode.PAYMENT_ID_INVALID);
    }

    return SUCCESS;
}
