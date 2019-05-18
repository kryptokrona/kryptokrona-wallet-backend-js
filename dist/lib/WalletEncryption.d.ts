/// <reference types="node" />
import { WalletError } from './WalletError';
export declare class WalletEncryption {
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
    static encryptWalletToString(walletJson: string, password: string): string;
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
    static encryptWalletToBuffer(walletJson: string, password: string): Buffer;
    /**
     * Decrypt the wallet from the given encrypted string with the given password and return
     * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
     *
     * Returns the JSON, and an error. If error is not undefined, the JSON will
     * be an empty string.
     */
    static decryptWalletFromString(dataString: string, password: string): [string, WalletError | undefined];
    /**
     * Decrypt the wallet from the given Buffer with the given password and return
     * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
     *
     * Returns the JSON, and an error. If error is not undefined, the JSON will
     * be an empty string.
     */
    static decryptWalletFromBuffer(data: Buffer, password: string): [string, WalletError | undefined];
}
