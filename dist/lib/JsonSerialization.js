"use strict";
// Copyright (C) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.txPrivateKeysToVector = txPrivateKeysToVector;
exports.transfersToVector = transfersToVector;
function txPrivateKeysToVector(txPrivateKeys) {
    const arr = [];
    for (const [hash, privateKey] of txPrivateKeys) {
        arr.push({ transactionHash: hash, txPrivateKey: privateKey });
    }
    return arr;
}
function transfersToVector(transfers) {
    const arr = [];
    for (const [publicKey, amount] of transfers) {
        arr.push({ amount, publicKey });
    }
    return arr;
}
