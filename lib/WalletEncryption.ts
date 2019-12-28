// Copyright (c) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as crypto from 'crypto';
import * as pbkdf2 from 'pbkdf2';
import { IS_A_WALLET_IDENTIFIER, IS_CORRECT_PASSWORD_IDENTIFIER, PBKDF2_ITERATIONS } from './Constants';
import { WalletError, WalletErrorCode } from './WalletError';

export class WalletEncryption {
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
     * @param password The password to encrypt the wallet with
     *
     * @return Returns a string containing the encrypted fileData.
     */
    public static encryptWalletToString(walletJson: string, password: string): string {
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
     * @param password The password to encrypt the wallet with
     *
     * @return Returns a Buffer containing the encrypted fileData.
     */
    public static encryptWalletToBuffer(walletJson: string, password: string): Buffer {
        /* Append the identifier so we can verify the password is correct */
        const data: Buffer = Buffer.concat([
            IS_CORRECT_PASSWORD_IDENTIFIER,
            Buffer.from(walletJson),
        ]);

        /* Random salt */
        const salt: Buffer = crypto.randomBytes(16);

        /* PBKDF2 key for our encryption */
        const key: Buffer = pbkdf2.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 16, 'sha256');

        /* Encrypt with AES */
        const cipher = crypto.createCipheriv('aes-128-cbc', key, salt);

        /* Perform the encryption */
        const encryptedData: Buffer = Buffer.concat([
            cipher.update(data),
            cipher.final(),
        ]);

        /* Write the wallet identifier to the file so we know it's a wallet file.
            Write the salt so it can be decrypted again */
        const fileData: Buffer = Buffer.concat([
            IS_A_WALLET_IDENTIFIER,
            salt,
            encryptedData,
        ]);

        return fileData;
    }

    /**
     * Decrypt the wallet from the given encrypted string with the given password and return
     * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
     *
     * Returns the JSON, and an error. If error is not undefined, the JSON will
     * be an empty string.
     */
    public static decryptWalletFromString(dataString: string, password: string): [string, WalletError | undefined] {
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
    public static decryptWalletFromBuffer(data: Buffer, password: string): [string, WalletError | undefined] {
        /* Take a slice containing the wallet identifier magic bytes */
        const magicBytes1: Buffer = data.slice(0, IS_A_WALLET_IDENTIFIER.length);

        if (magicBytes1.compare(IS_A_WALLET_IDENTIFIER) !== 0) {
            return ['', new WalletError(WalletErrorCode.NOT_A_WALLET_FILE)];
        }

        /* Remove the magic bytes */
        data = data.slice(IS_A_WALLET_IDENTIFIER.length, data.length);

        /* Grab the salt from the data */
        const salt: Buffer = data.slice(0, 16);

        /* Remove the salt from the data */
        data = data.slice(salt.length, data.length);

        /* Derive our key with pbkdf2, 16 bytes long */
        const key: Buffer = pbkdf2.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 16, 'sha256');

        /* Setup the aes decryption */
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, salt);

        let decrypted: Buffer;

        try {
            /* Perform the decryption */
            decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        } catch (err) {
            return ['', new WalletError(WalletErrorCode.WRONG_PASSWORD)];
        }

        /* Grab the second set of magic bytes */
        const magicBytes2: Buffer = decrypted.slice(0, IS_CORRECT_PASSWORD_IDENTIFIER.length);

        /* Verify the magic bytes are present */
        if (magicBytes2.compare(IS_CORRECT_PASSWORD_IDENTIFIER) !== 0) {
            return ['', new WalletError(WalletErrorCode.WRONG_PASSWORD)];
        }

        /* Remove the magic bytes */
        decrypted = decrypted.slice(IS_CORRECT_PASSWORD_IDENTIFIER.length, decrypted.length);
        return [decrypted.toString(), undefined];
    }

}
