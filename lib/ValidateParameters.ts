// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';
import { WalletError, WalletErrorCode } from './WalletError';

/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validateAddresses(addresses: string[], integratedAddressesAllowed: boolean): WalletError {
    for (const address of addresses) {
        try {
            const parsed = CryptoUtils.decodeAddress(address);

            if (parsed.paymentId.length !== 0 && !integratedAddressesAllowed) {
                return new WalletError(WalletErrorCode.ADDRESS_IS_INTEGRATED);
            }
        } catch (err) {
            return new WalletError(WalletErrorCode.ADDRESS_NOT_VALID, err.toString());
        }
    }

    return new WalletError(WalletErrorCode.SUCCESS);
}
