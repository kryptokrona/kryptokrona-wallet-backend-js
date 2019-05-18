/// <reference types="node" />
import { WalletError } from './WalletError';
/**
 * Decrypt the wallet from the given encrypted string with the given password and return
 * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
 *
 * Returns the JSON, and an error. If error is not undefined, the JSON will
 * be an empty string.
 */
export declare function decryptWalletFromString(dataString: string, password: string): [string, WalletError | undefined];
/**
 * Decrypt the wallet from the given Buffer with the given password and return
 * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
 *
 * Returns the JSON, and an error. If error is not undefined, the JSON will
 * be an empty string.
 */
export declare function decryptWalletFromBuffer(data: Buffer, password: string): [string, WalletError | undefined];
