"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const CnUtils_1 = require("./CnUtils");
const WalletError_1 = require("./WalletError");
/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
function validateAddresses(addresses, integratedAddressesAllowed) {
    for (const address of addresses) {
        try {
            const parsed = CnUtils_1.CryptoUtils.decodeAddress(address);
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
