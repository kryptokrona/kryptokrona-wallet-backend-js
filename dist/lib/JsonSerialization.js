"use strict";
// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
function txPrivateKeysToVector(txPrivateKeys) {
    const arr = [];
    for (const [hash, privateKey] of txPrivateKeys) {
        arr.push({ transactionHash: hash, txPrivateKey: privateKey });
    }
    return arr;
}
exports.txPrivateKeysToVector = txPrivateKeysToVector;
function transfersToVector(transfers) {
    const arr = [];
    for (const [publicKey, amount] of transfers) {
        arr.push({ amount, publicKey });
    }
    return arr;
}
exports.transfersToVector = transfersToVector;
