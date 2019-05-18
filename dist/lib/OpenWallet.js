"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const WalletError_1 = require("./WalletError");
const DecryptWallet_1 = require("./DecryptWallet");
/**
 * Open the wallet from the given filename with the given password and return
 * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
 *
 * Returns the JSON, and an error. If error is not undefined, the JSON will
 * be an empty string.
 */
function openWallet(filename, password) {
    let data;
    try {
        data = fs.readFileSync(filename);
    }
    catch (err) {
        return ['', new WalletError_1.WalletError(WalletError_1.WalletErrorCode.FILENAME_NON_EXISTENT, err.toString())];
    }
    const [walletJson, error] = DecryptWallet_1.decryptWalletFromBuffer(data, password);
    if (error) {
        return ['', error];
    }
    return [walletJson, undefined];
}
exports.openWallet = openWallet;
