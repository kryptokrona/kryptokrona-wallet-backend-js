"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const CnUtils_1 = require("./CnUtils");
const WalletError_1 = require("./WalletError");
function validateAddresses(addresses, integratedAddressesAllowed) {
    addresses.forEach((address) => {
        try {
            const parsed = CnUtils_1.CryptoUtils.decodeAddress(address);
            if (parsed.paymentId.length !== 0 && !integratedAddressesAllowed) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_IS_INTEGRATED);
            }
        }
        catch (err) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.ADDRESS_NOT_VALID, err.toString());
        }
    });
    return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.SUCCESS);
}
exports.validateAddresses = validateAddresses;
