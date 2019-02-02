import { WalletError } from './WalletError';
/**
 * Open the wallet from the given filename with the given password and return
 * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
 *
 * Returns the JSON, and an error. If error is not undefined, the JSON will
 * be an empty string.
 */
export declare function openWallet(filename: string, password: string): [string, WalletError | undefined];
