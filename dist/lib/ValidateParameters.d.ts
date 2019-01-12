import { WalletError } from './WalletError';
/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export declare function validateAddresses(addresses: string[], integratedAddressesAllowed: boolean): WalletError;
