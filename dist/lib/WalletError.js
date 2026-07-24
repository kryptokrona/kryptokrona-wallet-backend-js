"use strict";
// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUCCESS = exports.WalletErrorCode = exports.WalletError = void 0;
/**
 * Stores a programmatic error code and an error message
 */
class WalletError {
    /* User can supply a custom, more informative message, if they like. This
       overrides the default message, if given. */
    constructor(errorCode, customMessage = '') {
        this.errorCode = errorCode;
        this.customMessage = customMessage;
    }
    /**
     * Convert a error code to a human readable string
     */
    toString() {
        if (this.customMessage !== '') {
            return this.customMessage;
        }
        switch (this.errorCode) {
            case WalletErrorCode.SUCCESS: {
                return 'The operation completed successfully.';
            }
            case WalletErrorCode.FILENAME_NON_EXISTENT: {
                return 'The filename you are attempting to open does not exist, ' +
                    'or the wallet does not have permission to open it.';
            }
            case WalletErrorCode.INVALID_WALLET_FILENAME: {
                return 'We could not open/save to the filename given. Possibly ' +
                    'invalid characters, or permission issues.';
            }
            case WalletErrorCode.NOT_A_WALLET_FILE: {
                return 'This file is not a wallet file, or is not a wallet file ' +
                    'type supported by this wallet version.';
            }
            case WalletErrorCode.WALLET_FILE_CORRUPTED: {
                return 'This wallet file appears to have gotten corrupted.';
            }
            case WalletErrorCode.WRONG_PASSWORD: {
                return 'The password given for this wallet is incorrect.';
            }
            case WalletErrorCode.UNSUPPORTED_WALLET_FILE_FORMAT_VERSION: {
                return 'This wallet file appears to be from a newer or older ' +
                    'version of the software, that we do not support.';
            }
            case WalletErrorCode.INVALID_MNEMONIC: {
                return 'The mnemonic seed given is invalid.';
            }
            case WalletErrorCode.WALLET_FILE_ALREADY_EXISTS: {
                return 'The wallet file you are attempting to create already ' +
                    'exists. Please delete it first.';
            }
            case WalletErrorCode.ADDRESS_NOT_IN_WALLET: {
                return 'The address given does not exist in the wallet container, ' +
                    'but is required to exist for this operation.';
            }
            case WalletErrorCode.NOT_ENOUGH_BALANCE: {
                return 'Not enough unlocked funds were found to cover this ' +
                    'transaction in the subwallets specified (or all wallets, ' +
                    'if not specified. (Sum of amounts + fee + node fee)';
            }
            case WalletErrorCode.ADDRESS_WRONG_LENGTH: {
                return 'The address given is too short or too long.';
            }
            case WalletErrorCode.ADDRESS_WRONG_PREFIX: {
                return 'The address does not have the correct prefix corresponding ' +
                    'to this coin - it appears to be an address for another ' +
                    'cryptocurrency.';
            }
            case WalletErrorCode.ADDRESS_NOT_BASE58: {
                return 'The address contains invalid characters, that are not in ' +
                    'the base58 set.';
            }
            case WalletErrorCode.ADDRESS_NOT_VALID: {
                return 'The address given is not valid. Possibly invalid checksum. ' +
                    'Most likely a typo.';
            }
            case WalletErrorCode.INTEGRATED_ADDRESS_PAYMENT_ID_INVALID: {
                return 'The payment ID stored in the integrated address supplied ' +
                    'is not valid.';
            }
            case WalletErrorCode.FEE_TOO_SMALL: {
                return 'The fee given for this transaction is below the minimum ' +
                    'allowed network fee.';
            }
            case WalletErrorCode.NO_DESTINATIONS_GIVEN: {
                return 'The destinations array (amounts/addresses) is empty.';
            }
            case WalletErrorCode.AMOUNT_IS_ZERO: {
                return 'One of the destination parameters has an amount given of ' +
                    'zero.';
            }
            case WalletErrorCode.FAILED_TO_CREATE_RING_SIGNATURE: {
                return 'Failed to create ring signature - probably a programmer ' +
                    'error, or a corrupted wallet.';
            }
            case WalletErrorCode.MIXIN_TOO_SMALL: {
                return 'The mixin value given is too low to be accepted by the ' +
                    'network (based on the current height known by the wallet)';
            }
            case WalletErrorCode.MIXIN_TOO_BIG: {
                return 'The mixin value given is too high to be accepted by the ' +
                    'network (based on the current height known by the wallet)';
            }
            case WalletErrorCode.PAYMENT_ID_WRONG_LENGTH: {
                return 'The payment ID given is not 64 characters long.';
            }
            case WalletErrorCode.PAYMENT_ID_INVALID: {
                return 'The payment ID given is not a hex string (A-Za-z0-9)';
            }
            case WalletErrorCode.ADDRESS_IS_INTEGRATED: {
                return 'The address given is an integrated address, but integrated ' +
                    'addresses aren\'t valid for this parameter, for example, ' +
                    'change address.';
            }
            case WalletErrorCode.CONFLICTING_PAYMENT_IDS: {
                return 'Conflicting payment IDs were given. This could mean ' +
                    'an integrated address + payment ID were given, where ' +
                    'they are not the same, or that multiple integrated ' +
                    'addresses with different payment IDs were given.';
            }
            case WalletErrorCode.CANT_GET_FAKE_OUTPUTS: {
                return 'Failed to get fake outputs from the daemon to obscure ' +
                    'our transaction, and mixin is not zero.';
            }
            case WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS: {
                return 'We could not get enough fake outputs for this transaction ' +
                    'to complete. If possible, try lowering the mixin value ' +
                    'used, or decrease the amount you are sending.';
            }
            case WalletErrorCode.INVALID_GENERATED_KEYIMAGE: {
                return 'The key image we generated is invalid - probably a ' +
                    'programmer error, or a corrupted wallet.';
            }
            case WalletErrorCode.DAEMON_OFFLINE: {
                return 'We were not able to submit our request to the daemon. ' +
                    'Ensure it is online and not frozen.';
            }
            case WalletErrorCode.DAEMON_ERROR: {
                return 'Something went wrong creating the transaction. Please try again.';
            }
            case WalletErrorCode.TOO_MANY_INPUTS_TO_FIT_IN_BLOCK: {
                return 'The transaction is too large (in BYTES, not AMOUNT) to fit ' +
                    'in a block. Either decrease the amount you are sending, ' +
                    'perform fusion transactions, or decrease mixin (if possible).';
            }
            case WalletErrorCode.MNEMONIC_INVALID_WORD: {
                return 'The mnemonic seed given has a word that is not present in ' +
                    'the english word list.';
            }
            case WalletErrorCode.MNEMONIC_WRONG_LENGTH: {
                return 'The mnemonic seed given is the wrong length.';
            }
            case WalletErrorCode.MNEMONIC_INVALID_CHECKSUM: {
                return 'The mnemonic seed given has an invalid checksum word.';
            }
            case WalletErrorCode.FULLY_OPTIMIZED: {
                return 'Cannot send fusion transaction - wallet is already fully optimized.';
            }
            case WalletErrorCode.FUSION_MIXIN_TOO_LARGE: {
                return 'Cannot send fusion transacton - mixin is too large to meet ' +
                    'input/output ratio requirements whilst remaining in ' +
                    'size constraints.';
            }
            case WalletErrorCode.SUBWALLET_ALREADY_EXISTS: {
                return 'A subwallet with the given key already exists.';
            }
            case WalletErrorCode.ILLEGAL_VIEW_WALLET_OPERATION: {
                return 'This function cannot be called when using a view wallet.';
            }
            case WalletErrorCode.ILLEGAL_NON_VIEW_WALLET_OPERATION: {
                return 'This function can only be used when using a view wallet.';
            }
            case WalletErrorCode.WILL_OVERFLOW: {
                return 'This operation will cause integer overflow. Please decrease ' +
                    'the amounts you are sending.';
            }
            case WalletErrorCode.KEYS_NOT_DETERMINISTIC: {
                return 'You cannot get a mnemonic seed for this address, as the ' +
                    'view key is derived in terms of the spend key.';
            }
            case WalletErrorCode.CANNOT_DELETE_PRIMARY_ADDRESS: {
                return 'Each wallet has a primary address when created, this address ' +
                    'cannot be removed.';
            }
            case WalletErrorCode.TX_PRIVATE_KEY_NOT_FOUND: {
                return 'Couldn\'t find the private key for this transaction. The ' +
                    'transaction must exist, and have been sent by this program. ' +
                    'Transaction private keys cannot be found upon rescanning/' +
                    'reimporting.';
            }
            case WalletErrorCode.AMOUNTS_NOT_PRETTY: {
                return 'The created transaction isn\'t comprised of only \'Pretty\' ' +
                    'amounts. This will cause the outputs to be unmixable. ' +
                    'Almost certainly a programmer error. Cancelling transaction.';
            }
            case WalletErrorCode.UNEXPECTED_FEE: {
                return 'The fee of the created transaction is not the same as that ' +
                    'which was specified (0 for fusion transactions). Almost ' +
                    'certainly a programmer error. Cancelling transaction.';
            }
            case WalletErrorCode.NEGATIVE_VALUE_GIVEN: {
                return 'The input for this operation must be greater than or ' +
                    'equal to zero, but a negative number was given.';
            }
            case WalletErrorCode.INVALID_KEY_FORMAT: {
                return 'The public/private key or hash given is not a 64 char ' +
                    'hex string.';
            }
            case WalletErrorCode.HASH_WRONG_LENGTH: {
                return 'The hash given is not 64 characters long.';
            }
            case WalletErrorCode.HASH_INVALID: {
                return 'The hash given is not a hex string (A-Za-z0-9).';
            }
            case WalletErrorCode.NON_INTEGER_GIVEN: {
                return 'The number given was a float, not an integer.';
            }
            case WalletErrorCode.INVALID_PUBLIC_KEY: {
                return 'The public key given is not a valid ed25519 public key.';
            }
            case WalletErrorCode.INVALID_PRIVATE_KEY: {
                return 'The private key given is not a valid ed25519 private key.';
            }
            case WalletErrorCode.INVALID_EXTRA_DATA: {
                return 'The extra data given for the transaction could not be decoded.';
            }
            case WalletErrorCode.UNKNOWN_ERROR: {
                return 'An unknown error occured.';
            }
            case WalletErrorCode.DAEMON_STILL_PROCESSING: {
                return 'The transaction was sent to the daemon, but the connection timed out ' +
                    'before we could determine if the transaction succeeded. ' +
                    'Wait a few minutes before retrying the transaction, as it ' +
                    'may still succeed.';
            }
            case WalletErrorCode.OUTPUT_DECOMPOSITION: {
                return 'The transaction will create too many outputs to be accepted by ' +
                    'the network. Decrease the number of destinations or use rounder ' +
                    'amounts.';
            }
            case WalletErrorCode.PREPARED_TRANSACTION_EXPIRED: {
                return 'The prepared transaction is no longer valid, likely because ' +
                    'another transaction was sent using some of the same inputs.';
            }
            case WalletErrorCode.PREPARED_TRANSACTION_NOT_FOUND: {
                return 'The prepared transaction given could not be found. Note ' +
                    'that prepared transactions are lost upon restarting the wallet.';
            }
        }
    }
}
exports.WalletError = WalletError;
/**
 * Possible error codes
 */
var WalletErrorCode;
(function (WalletErrorCode) {
    /* No error, operation suceeded. */
    WalletErrorCode[WalletErrorCode["SUCCESS"] = 0] = "SUCCESS";
    /* The wallet filename given does not exist or the program does not have
       permission to view it */
    WalletErrorCode[WalletErrorCode["FILENAME_NON_EXISTENT"] = 1] = "FILENAME_NON_EXISTENT";
    /* The output filename was unable to be opened for saving, probably due
       to invalid characters */
    WalletErrorCode[WalletErrorCode["INVALID_WALLET_FILENAME"] = 2] = "INVALID_WALLET_FILENAME";
    /* The wallet does not have the wallet identifier prefix */
    WalletErrorCode[WalletErrorCode["NOT_A_WALLET_FILE"] = 3] = "NOT_A_WALLET_FILE";
    /* The file has the correct wallet file prefix, but is corrupted in some
       other way, such as a missing IV */
    WalletErrorCode[WalletErrorCode["WALLET_FILE_CORRUPTED"] = 4] = "WALLET_FILE_CORRUPTED";
    /* Either the AES decryption failed due to wrong padding, or the decrypted
       data does not have the correct prefix indicating the password is
       correct. */
    WalletErrorCode[WalletErrorCode["WRONG_PASSWORD"] = 5] = "WRONG_PASSWORD";
    /* The wallet file is using a different version than the version supported
       by this version of the software. (Also could be potential corruption.) */
    WalletErrorCode[WalletErrorCode["UNSUPPORTED_WALLET_FILE_FORMAT_VERSION"] = 6] = "UNSUPPORTED_WALLET_FILE_FORMAT_VERSION";
    /* The mnemonic seed is invalid for some reason, for example, it has the
       wrong length, or an invalid checksum */
    WalletErrorCode[WalletErrorCode["INVALID_MNEMONIC"] = 7] = "INVALID_MNEMONIC";
    /* Trying to create a wallet file which already exists */
    WalletErrorCode[WalletErrorCode["WALLET_FILE_ALREADY_EXISTS"] = 8] = "WALLET_FILE_ALREADY_EXISTS";
    /* Operation will cause int overflow */
    WalletErrorCode[WalletErrorCode["WILL_OVERFLOW"] = 9] = "WILL_OVERFLOW";
    /* The address given does not exist in this container, and it's required,
       for example you specified it as the address to get the balance from */
    WalletErrorCode[WalletErrorCode["ADDRESS_NOT_IN_WALLET"] = 10] = "ADDRESS_NOT_IN_WALLET";
    /* Amount + fee is greater than the total balance available in the
       subwallets specified (or all wallets, if not specified) */
    WalletErrorCode[WalletErrorCode["NOT_ENOUGH_BALANCE"] = 11] = "NOT_ENOUGH_BALANCE";
    /* The address is the wrong length - neither a standard, nor an integrated
       address */
    WalletErrorCode[WalletErrorCode["ADDRESS_WRONG_LENGTH"] = 12] = "ADDRESS_WRONG_LENGTH";
    /* The address does not have the correct prefix, e.g. does not begin with
       TRTL (or whatever is specified in WalletConfig::addressPrefix) */
    WalletErrorCode[WalletErrorCode["ADDRESS_WRONG_PREFIX"] = 13] = "ADDRESS_WRONG_PREFIX";
    /* The address is not fully comprised of base58 characters */
    WalletErrorCode[WalletErrorCode["ADDRESS_NOT_BASE58"] = 14] = "ADDRESS_NOT_BASE58";
    /* The address is invalid for some other reason (possibly checksum) */
    WalletErrorCode[WalletErrorCode["ADDRESS_NOT_VALID"] = 15] = "ADDRESS_NOT_VALID";
    /* The payment ID encoded in the integrated address is not valid */
    WalletErrorCode[WalletErrorCode["INTEGRATED_ADDRESS_PAYMENT_ID_INVALID"] = 16] = "INTEGRATED_ADDRESS_PAYMENT_ID_INVALID";
    /* The fee given is lower than the CryptoNote::parameters::MINIMUM_FEE */
    WalletErrorCode[WalletErrorCode["FEE_TOO_SMALL"] = 17] = "FEE_TOO_SMALL";
    /* The destinations array is empty */
    WalletErrorCode[WalletErrorCode["NO_DESTINATIONS_GIVEN"] = 18] = "NO_DESTINATIONS_GIVEN";
    /* One of the destination parameters has an amount given of zero. */
    WalletErrorCode[WalletErrorCode["AMOUNT_IS_ZERO"] = 19] = "AMOUNT_IS_ZERO";
    /* Something went wrong creating the ring signatures. Probably a programmer
       error */
    WalletErrorCode[WalletErrorCode["FAILED_TO_CREATE_RING_SIGNATURE"] = 20] = "FAILED_TO_CREATE_RING_SIGNATURE";
    /* The mixin given is too low for the current height known by the wallet */
    WalletErrorCode[WalletErrorCode["MIXIN_TOO_SMALL"] = 21] = "MIXIN_TOO_SMALL";
    /* The mixin given is too large for the current height known by the wallet */
    WalletErrorCode[WalletErrorCode["MIXIN_TOO_BIG"] = 22] = "MIXIN_TOO_BIG";
    /* Payment ID is not 64 chars */
    WalletErrorCode[WalletErrorCode["PAYMENT_ID_WRONG_LENGTH"] = 23] = "PAYMENT_ID_WRONG_LENGTH";
    /* The payment ID is not hex */
    WalletErrorCode[WalletErrorCode["PAYMENT_ID_INVALID"] = 24] = "PAYMENT_ID_INVALID";
    /* The address is an integrated address - but integrated addresses aren't
       valid for this parameter, for example, change address */
    WalletErrorCode[WalletErrorCode["ADDRESS_IS_INTEGRATED"] = 25] = "ADDRESS_IS_INTEGRATED";
    /* Conflicting payment ID's were found, due to integrated addresses. These
       could mean an integrated address + payment ID were given, where they
       are not the same, or that multiple integrated addresses with different
       payment IDs were given */
    WalletErrorCode[WalletErrorCode["CONFLICTING_PAYMENT_IDS"] = 26] = "CONFLICTING_PAYMENT_IDS";
    /* Can't get mixin/fake outputs from the daemon, and mixin is not zero */
    WalletErrorCode[WalletErrorCode["CANT_GET_FAKE_OUTPUTS"] = 27] = "CANT_GET_FAKE_OUTPUTS";
    /* We got mixin/fake outputs from the daemon, but not enough. E.g. using a
       mixin of 3, we only got one fake output -> can't form transaction.
       This is most likely to be encountered on new networks, where not
       enough outputs have been created, or if you have a very large output
       that not enough have been created of.

       Try resending the transaction with a mixin of zero, if that is an option
       on your network. */
    WalletErrorCode[WalletErrorCode["NOT_ENOUGH_FAKE_OUTPUTS"] = 28] = "NOT_ENOUGH_FAKE_OUTPUTS";
    /* The key image generated was not valid. This is most likely a programmer
       error. */
    WalletErrorCode[WalletErrorCode["INVALID_GENERATED_KEYIMAGE"] = 29] = "INVALID_GENERATED_KEYIMAGE";
    /* Could not contact the daemon to complete the request. Ensure it is
       online and not frozen */
    WalletErrorCode[WalletErrorCode["DAEMON_OFFLINE"] = 30] = "DAEMON_OFFLINE";
    /* An error occured whilst the daemon processed the request. Possibly our
       software is outdated, the daemon is faulty, or there is a programmer
       error. Check your daemon logs for more info (set_log 4) */
    WalletErrorCode[WalletErrorCode["DAEMON_ERROR"] = 31] = "DAEMON_ERROR";
    /* The transction is too large (in BYTES, not AMOUNT) to fit in a block.
       Either:
       1) decrease the amount you are sending
       2) decrease the mixin value
       3) split your transaction up into multiple smaller transactions
       4) perform fusion transaction to combine multiple small inputs into
          fewer, larger inputs. */
    WalletErrorCode[WalletErrorCode["TOO_MANY_INPUTS_TO_FIT_IN_BLOCK"] = 32] = "TOO_MANY_INPUTS_TO_FIT_IN_BLOCK";
    /* Mnemonic has a word that is not in the english word list */
    WalletErrorCode[WalletErrorCode["MNEMONIC_INVALID_WORD"] = 33] = "MNEMONIC_INVALID_WORD";
    /* Mnemonic seed is not 25 words */
    WalletErrorCode[WalletErrorCode["MNEMONIC_WRONG_LENGTH"] = 34] = "MNEMONIC_WRONG_LENGTH";
    /* The mnemonic seed has an invalid checksum word */
    WalletErrorCode[WalletErrorCode["MNEMONIC_INVALID_CHECKSUM"] = 35] = "MNEMONIC_INVALID_CHECKSUM";
    /* Don't have enough inputs to make a fusion transaction, wallet is fully
       optimized */
    WalletErrorCode[WalletErrorCode["FULLY_OPTIMIZED"] = 36] = "FULLY_OPTIMIZED";
    /* Mixin given for this fusion transaction is too large to be able to hit
       the min input requirement */
    WalletErrorCode[WalletErrorCode["FUSION_MIXIN_TOO_LARGE"] = 37] = "FUSION_MIXIN_TOO_LARGE";
    /* Attempted to add a subwallet which already exists in the container */
    WalletErrorCode[WalletErrorCode["SUBWALLET_ALREADY_EXISTS"] = 38] = "SUBWALLET_ALREADY_EXISTS";
    /* Cannot perform this operation when using a view wallet */
    WalletErrorCode[WalletErrorCode["ILLEGAL_VIEW_WALLET_OPERATION"] = 39] = "ILLEGAL_VIEW_WALLET_OPERATION";
    /* Cannot perform this operation when using a non view wallet */
    WalletErrorCode[WalletErrorCode["ILLEGAL_NON_VIEW_WALLET_OPERATION"] = 40] = "ILLEGAL_NON_VIEW_WALLET_OPERATION";
    /* View key is not derived from spend key for this address */
    WalletErrorCode[WalletErrorCode["KEYS_NOT_DETERMINISTIC"] = 41] = "KEYS_NOT_DETERMINISTIC";
    /* The primary address cannot be deleted */
    WalletErrorCode[WalletErrorCode["CANNOT_DELETE_PRIMARY_ADDRESS"] = 42] = "CANNOT_DELETE_PRIMARY_ADDRESS";
    /* Couldn't find the private key for this hash */
    WalletErrorCode[WalletErrorCode["TX_PRIVATE_KEY_NOT_FOUND"] = 43] = "TX_PRIVATE_KEY_NOT_FOUND";
    /* Amounts not a member of PRETTY_AMOUNTS */
    WalletErrorCode[WalletErrorCode["AMOUNTS_NOT_PRETTY"] = 44] = "AMOUNTS_NOT_PRETTY";
    /* Tx fee is not the same as specified fee */
    WalletErrorCode[WalletErrorCode["UNEXPECTED_FEE"] = 45] = "UNEXPECTED_FEE";
    /* Value given is negative, but must be >= 0 */
    WalletErrorCode[WalletErrorCode["NEGATIVE_VALUE_GIVEN"] = 46] = "NEGATIVE_VALUE_GIVEN";
    /* Key is not 64 char hex */
    WalletErrorCode[WalletErrorCode["INVALID_KEY_FORMAT"] = 47] = "INVALID_KEY_FORMAT";
    /* Hash not 64 chars */
    WalletErrorCode[WalletErrorCode["HASH_WRONG_LENGTH"] = 48] = "HASH_WRONG_LENGTH";
    /* Hash not hex */
    WalletErrorCode[WalletErrorCode["HASH_INVALID"] = 49] = "HASH_INVALID";
    /* Input is a float not an int */
    WalletErrorCode[WalletErrorCode["NON_INTEGER_GIVEN"] = 50] = "NON_INTEGER_GIVEN";
    /* Not on ed25519 curve */
    WalletErrorCode[WalletErrorCode["INVALID_PUBLIC_KEY"] = 51] = "INVALID_PUBLIC_KEY";
    /* Not on ed25519 curve */
    WalletErrorCode[WalletErrorCode["INVALID_PRIVATE_KEY"] = 52] = "INVALID_PRIVATE_KEY";
    /* Extra data for transaction is not a valid hexadecimal string */
    WalletErrorCode[WalletErrorCode["INVALID_EXTRA_DATA"] = 53] = "INVALID_EXTRA_DATA";
    /* An unknown error occured */
    WalletErrorCode[WalletErrorCode["UNKNOWN_ERROR"] = 54] = "UNKNOWN_ERROR";
    /* The daemon received our request but we timed out before we could figure
     * out if it completed */
    WalletErrorCode[WalletErrorCode["DAEMON_STILL_PROCESSING"] = 55] = "DAEMON_STILL_PROCESSING";
    /* Transaction has too many outputs to be accepted by the network */
    WalletErrorCode[WalletErrorCode["OUTPUT_DECOMPOSITION"] = 56] = "OUTPUT_DECOMPOSITION";
    /* Prepared transaction is no longer valid, inputs have been consumed by other transactions. */
    WalletErrorCode[WalletErrorCode["PREPARED_TRANSACTION_EXPIRED"] = 57] = "PREPARED_TRANSACTION_EXPIRED";
    /* Prepared transaction cannot be found, perhaps wallet application has been restarted */
    WalletErrorCode[WalletErrorCode["PREPARED_TRANSACTION_NOT_FOUND"] = 58] = "PREPARED_TRANSACTION_NOT_FOUND";
})(WalletErrorCode || (exports.WalletErrorCode = WalletErrorCode = {}));
/**
 * Lets us easier compare if a operation code was successful.
 * Unfortunately have to use deepEqual since object comparison is by reference..
 *
 * Usage:
 * ```
 * if (deepEqual(someOperation, SUCCESS))
 * ```
 * vs
 * ```
 * if (someOperation === new WalletError(WalletErrorCode.SUCCESS))
 * ```
 */
exports.SUCCESS = new WalletError(WalletErrorCode.SUCCESS);
