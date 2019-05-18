import * as crypto from 'crypto';
import * as pbkdf2 from 'pbkdf2';
import { IS_A_WALLET_IDENTIFIER, IS_CORRECT_PASSWORD_IDENTIFIER, PBKDF2_ITERATIONS } from './Constants';
import { WalletError, WalletErrorCode } from './WalletError';

/**
 * Decrypt the wallet from the given encrypted string with the given password and return
 * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
 *
 * Returns the JSON, and an error. If error is not undefined, the JSON will
 * be an empty string.
 */
export function decryptWalletFromString(dataString: string, password: string): [string, WalletError | undefined] {
    const data = Buffer.from(JSON.parse(dataString).data);

    return decryptWalletFromBuffer(data, password);
}

/**
 * Decrypt the wallet from the given Buffer with the given password and return
 * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
 *
 * Returns the JSON, and an error. If error is not undefined, the JSON will
 * be an empty string.
 */
export function decryptWalletFromBuffer(data: Buffer, password: string): [string, WalletError | undefined] {
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
