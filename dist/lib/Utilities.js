"use strict";
// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const CnUtils_1 = require("./CnUtils");
function isHex64(key) {
    const regex = new RegExp('^[0-9a-fA-F]{64}$');
    return regex.test(key);
}
exports.isHex64 = isHex64;
/* Precondition: address is valid */
function addressToKeys(address) {
    const parsed = CnUtils_1.CryptoUtils.decodeAddress(address);
    return [parsed.publicViewKey, parsed.publicSpendKey];
}
exports.addressToKeys = addressToKeys;
