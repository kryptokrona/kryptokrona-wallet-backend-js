// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';
import { WalletError, WalletErrorCode } from './WalletError';

export function validateAddresses(addresses: string[], integratedAddressesAllowed: boolean) {
    addresses.forEach((address) => {
        try {
            const parsed = CryptoUtils.decodeAddress(address);

            if (parsed.paymentId.length !== 0 && !integratedAddressesAllowed) {
                return new WalletError(WalletErrorCode.ADDRESS_IS_INTEGRATED);
            }
        } catch (err) {
            return new WalletError(WalletErrorCode.ADDRESS_NOT_VALID, err.toString());
        }
    });

    return new WalletError(WalletErrorCode.SUCCESS);
}
