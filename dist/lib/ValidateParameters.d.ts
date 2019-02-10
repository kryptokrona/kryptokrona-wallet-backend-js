import { SubWallets } from './SubWallets';
import { WalletError } from './WalletError';
/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export declare function validateAddresses(addresses: string[], integratedAddressesAllowed: boolean): WalletError;
/**
 * Validate the amounts being sent are valid, and the addresses are valid.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateDestinations(destinations: Array<[string, number]>): WalletError;
/**
 * Validate that the payment ID's included in integrated addresses are valid.
 *
 * You should have already called validateAddresses() before this function
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateIntegratedAddresses(destinations: Array<[string, number]>, paymentID: string): WalletError;
/**
 * Validate the the addresses given are both valid, and exist in the subwallet
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateOurAddresses(addresses: string[], subWallets: SubWallets): WalletError;
/**
 * Validate that the transfer amount + fee is valid, and we have enough balance
 * Note: Does not verify amounts are positive / integer, validateDestinations
 * handles that.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateAmount(destinations: Array<[string, number]>, fee: number, subWalletsToTakeFrom: string[], subWallets: SubWallets, currentHeight: number): WalletError;
/**
 * Validates mixin is valid and in allowed range
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateMixin(mixin: number, height: number): WalletError;
/**
 * Validates the payment ID is valid (or an empty string)
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export declare function validatePaymentID(paymentID: string): WalletError;
