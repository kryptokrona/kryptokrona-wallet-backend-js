import { WalletError } from './WalletError';
/**
 * Open the wallet from the given filename with the given password and return
 * a JSON string. Uses pbkdf2 encryption, not the same as turtle-service
 *
 * @returns Returns either the wallet as a JSON string (can then be used with
 *                  loadWalletFromJSON) or a WalletError if password is wrong
 *                  or data is corrupted.
 */
export declare function openWallet(filename: string, password: string): string | WalletError;
