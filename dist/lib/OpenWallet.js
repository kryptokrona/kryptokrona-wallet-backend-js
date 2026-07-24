"use strict";
// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.openWallet = void 0;
const fs = require("fs");
const WalletError_1 = require("./WalletError");
const WalletEncryption_1 = require("./WalletEncryption");
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
    return WalletEncryption_1.WalletEncryption.decryptWalletFromBuffer(data, password);
}
exports.openWallet = openWallet;
