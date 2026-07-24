"use strict";
// Copyright (c) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletEncryption = void 0;
const crypto = require("crypto");
const pbkdf2 = require("pbkdf2");
const Constants_1 = require("./Constants");
const WalletError_1 = require("./WalletError");
class WalletEncryption {
    /**
     * Encrypt the wallet using the given password. Note that an empty password does not mean an
     * unencrypted wallet - simply a wallet encrypted with the empty string.
     *
     * This will take some time (Roughly a second on a modern PC) - it runs 500,000 iterations of pbkdf2.
     *
     * Example:
     * ```javascript
     * const dataJson = wallet.encryptWalletToString('hunter2');
     *
     * ```
     *
     * @param walletJson
     * @param password The password to encrypt the wallet with
     *
     * @return Returns a string containing the encrypted fileData.
     */
    static encryptWalletToString(walletJson, password) {
        const buffer = WalletEncryption.encryptWalletToBuffer(walletJson, password);
        return JSON.stringify(buffer);
    }
    /**
     * Encrypt the wallet using the given password. Note that an empty password does not mean an
     * unencrypted wallet - simply a wallet encrypted with the empty string.
     *
     * This will take some time (Roughly a second on a modern PC) - it runs 500,000 iterations of pbkdf2.
     *
     * Example:
     * ```javascript
     * const dataJson = wallet.encryptWalletToBuffer('hunter2');
     *
     * ```
     *
     * @param walletJson
     * @param password The password to encrypt the wallet with
     *
     * @return Returns a Buffer containing the encrypted fileData.
     */
    static encryptWalletToBuffer(walletJson, password) {
        /* Append the identifier so we can verify the password is correct */
        const data = Buffer.concat([
            Constants_1.IS_CORRECT_PASSWORD_IDENTIFIER,
            Buffer.from(walletJson),
        ]);
        /* Random salt */
        const salt = crypto.randomBytes(16);
        /* PBKDF2 key for our encryption */
        const key = pbkdf2.pbkdf2Sync(password, salt, Constants_1.PBKDF2_ITERATIONS, 16, 'sha256');
        /* Encrypt with AES */
        const cipher = crypto.createCipheriv('aes-128-cbc', key, salt);
        /* Perform the encryption */
        const encryptedData = Buffer.concat([
            cipher.update(data),
            cipher.final(),
        ]);
        /* Write the wallet identifier to the file so we know it's a wallet file.
            Write the salt so it can be decrypted again */
        return Buffer.concat([
            Constants_1.IS_A_WALLET_IDENTIFIER,
            salt,
            encryptedData,
        ]);
    }
    /**
     * Decrypt the wallet from the given encrypted string with the given password and return
     * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
     *
     * Returns the JSON, and an error. If error is not undefined, the JSON will
     * be an empty string.
     */
    static decryptWalletFromString(dataString, password) {
        const data = Buffer.from(JSON.parse(dataString).data);
        return WalletEncryption.decryptWalletFromBuffer(data, password);
    }
    /**
     * Decrypt the wallet from the given Buffer with the given password and return
     * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
     *
     * Returns the JSON, and an error. If error is not undefined, the JSON will
     * be an empty string.
     */
    static decryptWalletFromBuffer(data, password) {
        /* Take a slice containing the wallet identifier magic bytes */
        const magicBytes1 = data.slice(0, Constants_1.IS_A_WALLET_IDENTIFIER.length);
        if (magicBytes1.compare(Constants_1.IS_A_WALLET_IDENTIFIER) !== 0) {
            return ['', new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_A_WALLET_FILE)];
        }
        /* Remove the magic bytes */
        data = data.slice(Constants_1.IS_A_WALLET_IDENTIFIER.length, data.length);
        /* Grab the salt from the data */
        const salt = data.slice(0, 16);
        /* Remove the salt from the data */
        data = data.slice(salt.length, data.length);
        /* Derive our key with pbkdf2, 16 bytes long */
        const key = pbkdf2.pbkdf2Sync(password, salt, Constants_1.PBKDF2_ITERATIONS, 16, 'sha256');
        /* Setup the aes decryption */
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, salt);
        let decrypted;
        try {
            /* Perform the decryption */
            decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        }
        catch (err) {
            return ['', new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WRONG_PASSWORD)];
        }
        /* Grab the second set of magic bytes */
        const magicBytes2 = decrypted.slice(0, Constants_1.IS_CORRECT_PASSWORD_IDENTIFIER.length);
        /* Verify the magic bytes are present */
        if (magicBytes2.compare(Constants_1.IS_CORRECT_PASSWORD_IDENTIFIER) !== 0) {
            return ['', new WalletError_1.WalletError(WalletError_1.WalletErrorCode.WRONG_PASSWORD)];
        }
        /* Remove the magic bytes */
        decrypted = decrypted.slice(Constants_1.IS_CORRECT_PASSWORD_IDENTIFIER.length, decrypted.length);
        return [decrypted.toString(), undefined];
    }
}
exports.WalletEncryption = WalletEncryption;
