// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';

export function isHex64(key: string) {
    const regex = new RegExp('^[0-9a-fA-F]{64}$');
    return regex.test(key);
}

/* Precondition: address is valid */
export function addressToKeys(address: string): [string, string] {
    const parsed = CryptoUtils.decodeAddress(address);

    return [parsed.publicViewKey, parsed.publicSpendKey];
}
