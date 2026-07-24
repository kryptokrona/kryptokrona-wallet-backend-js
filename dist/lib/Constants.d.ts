/// <reference types="node" />
/**
 * What version of the file format are we on (to make it easier to
 * upgrade the wallet format in the future)
 */
export declare const WALLET_FILE_FORMAT_VERSION: number;
/**
 * The number of iterations of PBKDF2 to perform on the wallet
 * password.
 */
export declare const PBKDF2_ITERATIONS: number;
/**
 * We use this to check that the file is a wallet file, this bit does
 * not get encrypted, and we can check if it exists before decrypting.
 * If it isn't, it's not a wallet file.
 */
export declare const IS_A_WALLET_IDENTIFIER: Buffer;
/**
 * We use this to check if the file has been correctly decoded, i.e.
 * is the password correct. This gets encrypted into the file, and
 * then when unencrypted the file should start with this - if it
 * doesn't, the password is wrong
 */
export declare const IS_CORRECT_PASSWORD_IDENTIFIER: Buffer;
/**
 * How large should the lastKnownBlockHashes container be
 */
export declare const LAST_KNOWN_BLOCK_HASHES_SIZE: number;
/**
 * Save a block hash checkpoint every BLOCK_HASH_CHECKPOINTS_INTERVAL
 * blocks
 */
export declare const BLOCK_HASH_CHECKPOINTS_INTERVAL: number;
/**
 * When we get the global indexes, we pass in a range of blocks, to obscure
 * which transactions we are interested in - the ones that belong to us.
 * To do this, we get the global indexes for all transactions in a range.
 * For example, if we want the global indexes for a transaction in block
 * 17, we get all the indexes from block 10 to block 20.
 *
 * This value determines how many blocks to take from.
 */
export declare const GLOBAL_INDEXES_OBSCURITY: number;
/**
 * Used to determine whether an unlock time is a height, or a timestamp
 */
export declare const MAX_BLOCK_NUMBER: number;
/**
 * Valid output amounts to be mixable
 */
export declare const PRETTY_AMOUNTS: number[];
/**
 * Part of the how fast blocks can grow formula
 */
export declare const MAX_BLOCK_SIZE_GROWTH_SPEED_NUMERATOR: number;
/**
 * Part of the how fast blocks can grow
 */
export declare const MAX_BLOCK_SIZE_GROWTH_SPEED_DENOMINATOR: number;
/**
 * Initial block size
 */
export declare const MAX_BLOCK_SIZE_INITIAL: number;
/**
 * Reserved space for miner transaction in block
 */
export declare const CRYPTONOTE_COINBASE_BLOB_RESERVED_SIZE: number;
/**
 * Minimum number of inputs a fusion transaction must have
 */
export declare const FUSION_TX_MIN_INPUT_COUNT = 12;
/**
 * Max size in bytes a fusion transaction can be
 */
export declare const MAX_FUSION_TX_SIZE = 30000;
/**
 * Required ratio of inputs to outputs in fusion transactions
 */
export declare const FUSION_TX_MIN_IN_OUT_COUNT_RATIO = 4;
/**
 * Max amount to create a single output of
 */
export declare const MAX_OUTPUT_SIZE_CLIENT = 100000000000;
