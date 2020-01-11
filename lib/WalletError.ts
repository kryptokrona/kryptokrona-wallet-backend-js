// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

/**
 * Stores a programmatic error code and an error message
 */
export class WalletError {

    /**
     * The error code of this error
     */
    public readonly errorCode: WalletErrorCode;

    /**
     * Stores the custom message of this error, if any
     */
    private readonly customMessage: string;

    /* User can supply a custom, more informative message, if they like. This
       overrides the default message, if given. */
    constructor(errorCode: WalletErrorCode, customMessage: string = '') {
        this.errorCode = errorCode;
        this.customMessage = customMessage;
    }

    /**
     * Convert a error code to a human readable string
     */
    public toString(): string {
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

/**
 * Possible error codes
 */
export enum WalletErrorCode {
    /* No error, operation suceeded. */
    SUCCESS = 0,

    /* The wallet filename given does not exist or the program does not have
       permission to view it */
    FILENAME_NON_EXISTENT = 1,

    /* The output filename was unable to be opened for saving, probably due
       to invalid characters */
    INVALID_WALLET_FILENAME = 2,

    /* The wallet does not have the wallet identifier prefix */
    NOT_A_WALLET_FILE = 3,

    /* The file has the correct wallet file prefix, but is corrupted in some
       other way, such as a missing IV */
    WALLET_FILE_CORRUPTED = 4,

    /* Either the AES decryption failed due to wrong padding, or the decrypted
       data does not have the correct prefix indicating the password is
       correct. */
    WRONG_PASSWORD = 5,

    /* The wallet file is using a different version than the version supported
       by this version of the software. (Also could be potential corruption.) */
    UNSUPPORTED_WALLET_FILE_FORMAT_VERSION = 6,

    /* The mnemonic seed is invalid for some reason, for example, it has the
       wrong length, or an invalid checksum */
    INVALID_MNEMONIC = 7,

    /* Trying to create a wallet file which already exists */
    WALLET_FILE_ALREADY_EXISTS = 8,

    /* Operation will cause int overflow */
    WILL_OVERFLOW = 9,

    /* The address given does not exist in this container, and it's required,
       for example you specified it as the address to get the balance from */
    ADDRESS_NOT_IN_WALLET = 10,

    /* Amount + fee is greater than the total balance available in the
       subwallets specified (or all wallets, if not specified) */
    NOT_ENOUGH_BALANCE = 11,

    /* The address is the wrong length - neither a standard, nor an integrated
       address */
    ADDRESS_WRONG_LENGTH = 12,

    /* The address does not have the correct prefix, e.g. does not begin with
       TRTL (or whatever is specified in WalletConfig::addressPrefix) */
    ADDRESS_WRONG_PREFIX = 13,

    /* The address is not fully comprised of base58 characters */
    ADDRESS_NOT_BASE58 = 14,

    /* The address is invalid for some other reason (possibly checksum) */
    ADDRESS_NOT_VALID = 15,

    /* The payment ID encoded in the integrated address is not valid */
    INTEGRATED_ADDRESS_PAYMENT_ID_INVALID = 16,

    /* The fee given is lower than the CryptoNote::parameters::MINIMUM_FEE */
    FEE_TOO_SMALL = 17,

    /* The destinations array is empty */
    NO_DESTINATIONS_GIVEN = 18,

    /* One of the destination parameters has an amount given of zero. */
    AMOUNT_IS_ZERO = 19,

    /* Something went wrong creating the ring signatures. Probably a programmer
       error */
    FAILED_TO_CREATE_RING_SIGNATURE = 20,

    /* The mixin given is too low for the current height known by the wallet */
    MIXIN_TOO_SMALL = 21,

    /* The mixin given is too large for the current height known by the wallet */
    MIXIN_TOO_BIG = 22,

    /* Payment ID is not 64 chars */
    PAYMENT_ID_WRONG_LENGTH = 23,

    /* The payment ID is not hex */
    PAYMENT_ID_INVALID = 24,

    /* The address is an integrated address - but integrated addresses aren't
       valid for this parameter, for example, change address */
    ADDRESS_IS_INTEGRATED = 25,

    /* Conflicting payment ID's were found, due to integrated addresses. These
       could mean an integrated address + payment ID were given, where they
       are not the same, or that multiple integrated addresses with different
       payment IDs were given */
    CONFLICTING_PAYMENT_IDS = 26,

    /* Can't get mixin/fake outputs from the daemon, and mixin is not zero */
    CANT_GET_FAKE_OUTPUTS = 27,

    /* We got mixin/fake outputs from the daemon, but not enough. E.g. using a
       mixin of 3, we only got one fake output -> can't form transaction.
       This is most likely to be encountered on new networks, where not
       enough outputs have been created, or if you have a very large output
       that not enough have been created of.

       Try resending the transaction with a mixin of zero, if that is an option
       on your network. */
    NOT_ENOUGH_FAKE_OUTPUTS = 28,

    /* The key image generated was not valid. This is most likely a programmer
       error. */
    INVALID_GENERATED_KEYIMAGE = 29,

    /* Could not contact the daemon to complete the request. Ensure it is
       online and not frozen */
    DAEMON_OFFLINE = 30,

    /* An error occured whilst the daemon processed the request. Possibly our
       software is outdated, the daemon is faulty, or there is a programmer
       error. Check your daemon logs for more info (set_log 4) */
    DAEMON_ERROR = 31,

    /* The transction is too large (in BYTES, not AMOUNT) to fit in a block.
       Either:
       1) decrease the amount you are sending
       2) decrease the mixin value
       3) split your transaction up into multiple smaller transactions
       4) perform fusion transaction to combine multiple small inputs into
          fewer, larger inputs. */
    TOO_MANY_INPUTS_TO_FIT_IN_BLOCK = 32,

    /* Mnemonic has a word that is not in the english word list */
    MNEMONIC_INVALID_WORD = 33,

    /* Mnemonic seed is not 25 words */
    MNEMONIC_WRONG_LENGTH = 34,

    /* The mnemonic seed has an invalid checksum word */
    MNEMONIC_INVALID_CHECKSUM = 35,

    /* Don't have enough inputs to make a fusion transaction, wallet is fully
       optimized */
    FULLY_OPTIMIZED = 36,

    /* Mixin given for this fusion transaction is too large to be able to hit
       the min input requirement */
    FUSION_MIXIN_TOO_LARGE = 37,

    /* Attempted to add a subwallet which already exists in the container */
    SUBWALLET_ALREADY_EXISTS = 38,

    /* Cannot perform this operation when using a view wallet */
    ILLEGAL_VIEW_WALLET_OPERATION = 39,

    /* Cannot perform this operation when using a non view wallet */
    ILLEGAL_NON_VIEW_WALLET_OPERATION = 40,

    /* View key is not derived from spend key for this address */
    KEYS_NOT_DETERMINISTIC = 41,

    /* The primary address cannot be deleted */
    CANNOT_DELETE_PRIMARY_ADDRESS = 42,

    /* Couldn't find the private key for this hash */
    TX_PRIVATE_KEY_NOT_FOUND = 43,

    /* Amounts not a member of PRETTY_AMOUNTS */
    AMOUNTS_NOT_PRETTY = 44,

    /* Tx fee is not the same as specified fee */
    UNEXPECTED_FEE = 45,

    /* Value given is negative, but must be >= 0 */
    NEGATIVE_VALUE_GIVEN = 46,

    /* Key is not 64 char hex */
    INVALID_KEY_FORMAT = 47,

    /* Hash not 64 chars */
    HASH_WRONG_LENGTH = 48,

    /* Hash not hex */
    HASH_INVALID = 49,

    /* Input is a float not an int */
    NON_INTEGER_GIVEN = 50,

    /* Not on ed25519 curve */
    INVALID_PUBLIC_KEY = 51,

    /* Not on ed25519 curve */
    INVALID_PRIVATE_KEY = 52,

    /* Extra data for transaction is not a valid hexadecimal string */
    INVALID_EXTRA_DATA = 53,

    /* An unknown error occured */
    UNKNOWN_ERROR = 54,

    /* The daemon received our request but we timed out before we could figure
     * out if it completed */
    DAEMON_STILL_PROCESSING = 55,

    /* Transaction has too many outputs to be accepted by the network */
    OUTPUT_DECOMPOSITION = 56,

    /* Prepared transaction is no longer valid, inputs have been consumed by other transactions. */
    PREPARED_TRANSACTION_EXPIRED = 57,

    /* Prepared transaction cannot be found, perhaps wallet application has been restarted */
    PREPARED_TRANSACTION_NOT_FOUND = 58,
}

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
export let SUCCESS: WalletError = new WalletError(WalletErrorCode.SUCCESS);
