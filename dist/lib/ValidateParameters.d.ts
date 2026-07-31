import { FeeType } from './FeeType';
import { SubWallets } from './SubWallets';
import { WalletError } from './WalletError';
import { IConfig } from './Config';
/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 * @param config
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export declare function validateAddresses(addresses: string[], integratedAddressesAllowed: boolean, config?: IConfig): Promise<WalletError>;
/**
 * Verifies that the address given is valid.
 * @param address The address to validate.
 * @param integratedAddressAllowed Should an integrated address be allowed?
 * @param config
 *
 * @returns Returns true if the address is valid, otherwise returns false
 *
 */
export declare function validateAddress(address: string, integratedAddressAllowed: boolean, config?: IConfig): Promise<boolean>;
/**
 * Validate the amounts being sent are valid, and the addresses are valid.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateDestinations(destinations: [string, number][], config?: IConfig): Promise<WalletError>;
/**
 * Validate that the payment ID's included in integrated addresses are valid.
 *
 * You should have already called validateAddresses() before this function
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateIntegratedAddresses(destinations: [string, number][], paymentID: string, config?: IConfig): Promise<WalletError>;
/**
 * Validate the the addresses given are both valid, and exist in the subwallet
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateOurAddresses(addresses: string[], subWallets: SubWallets, config?: IConfig): Promise<WalletError>;
/**
 * Validate that the transfer amount + fee is valid, and we have enough balance
 * Note: Does not verify amounts are positive / integer, validateDestinations
 * handles that.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateAmount(destinations: [string, number][], fee: FeeType, subWalletsToTakeFrom: string[], subWallets: SubWallets, currentHeight: number, config?: IConfig): Promise<WalletError>;
/**
 * Validates mixin is valid and in allowed range
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 *
 * @hidden
 */
export declare function validateMixin(mixin: number, height: number, config?: IConfig): WalletError;
/**
 * Validates the payment ID is valid (or an empty string)
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export declare function validatePaymentID(paymentID: string, allowEmptyString?: boolean): WalletError;
