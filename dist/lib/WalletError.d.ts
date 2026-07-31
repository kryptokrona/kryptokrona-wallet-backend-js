/**
 * Stores a programmatic error code and an error message
 */
export declare class WalletError {
    /**
     * The error code of this error
     */
    readonly errorCode: WalletErrorCode;
    /**
     * Stores the custom message of this error, if any
     */
    private readonly customMessage;
    constructor(errorCode: WalletErrorCode, customMessage?: string);
    /**
     * Convert a error code to a human readable string
     */
    toString(): string;
}
/**
 * Possible error codes
 */
export declare enum WalletErrorCode {
    SUCCESS = 0,
    FILENAME_NON_EXISTENT = 1,
    INVALID_WALLET_FILENAME = 2,
    NOT_A_WALLET_FILE = 3,
    WALLET_FILE_CORRUPTED = 4,
    WRONG_PASSWORD = 5,
    UNSUPPORTED_WALLET_FILE_FORMAT_VERSION = 6,
    INVALID_MNEMONIC = 7,
    WALLET_FILE_ALREADY_EXISTS = 8,
    WILL_OVERFLOW = 9,
    ADDRESS_NOT_IN_WALLET = 10,
    NOT_ENOUGH_BALANCE = 11,
    ADDRESS_WRONG_LENGTH = 12,
    ADDRESS_WRONG_PREFIX = 13,
    ADDRESS_NOT_BASE58 = 14,
    ADDRESS_NOT_VALID = 15,
    INTEGRATED_ADDRESS_PAYMENT_ID_INVALID = 16,
    FEE_TOO_SMALL = 17,
    NO_DESTINATIONS_GIVEN = 18,
    AMOUNT_IS_ZERO = 19,
    FAILED_TO_CREATE_RING_SIGNATURE = 20,
    MIXIN_TOO_SMALL = 21,
    MIXIN_TOO_BIG = 22,
    PAYMENT_ID_WRONG_LENGTH = 23,
    PAYMENT_ID_INVALID = 24,
    ADDRESS_IS_INTEGRATED = 25,
    CONFLICTING_PAYMENT_IDS = 26,
    CANT_GET_FAKE_OUTPUTS = 27,
    NOT_ENOUGH_FAKE_OUTPUTS = 28,
    INVALID_GENERATED_KEYIMAGE = 29,
    DAEMON_OFFLINE = 30,
    DAEMON_ERROR = 31,
    TOO_MANY_INPUTS_TO_FIT_IN_BLOCK = 32,
    MNEMONIC_INVALID_WORD = 33,
    MNEMONIC_WRONG_LENGTH = 34,
    MNEMONIC_INVALID_CHECKSUM = 35,
    FULLY_OPTIMIZED = 36,
    FUSION_MIXIN_TOO_LARGE = 37,
    SUBWALLET_ALREADY_EXISTS = 38,
    ILLEGAL_VIEW_WALLET_OPERATION = 39,
    ILLEGAL_NON_VIEW_WALLET_OPERATION = 40,
    KEYS_NOT_DETERMINISTIC = 41,
    CANNOT_DELETE_PRIMARY_ADDRESS = 42,
    TX_PRIVATE_KEY_NOT_FOUND = 43,
    AMOUNTS_NOT_PRETTY = 44,
    UNEXPECTED_FEE = 45,
    NEGATIVE_VALUE_GIVEN = 46,
    INVALID_KEY_FORMAT = 47,
    HASH_WRONG_LENGTH = 48,
    HASH_INVALID = 49,
    NON_INTEGER_GIVEN = 50,
    INVALID_PUBLIC_KEY = 51,
    INVALID_PRIVATE_KEY = 52,
    INVALID_EXTRA_DATA = 53,
    UNKNOWN_ERROR = 54,
    DAEMON_STILL_PROCESSING = 55,
    OUTPUT_DECOMPOSITION = 56,
    PREPARED_TRANSACTION_EXPIRED = 57,
    PREPARED_TRANSACTION_NOT_FOUND = 58
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
export declare let SUCCESS: WalletError;
