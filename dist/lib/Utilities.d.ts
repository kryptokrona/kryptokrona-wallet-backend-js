import { IConfig } from './Config';
/**
 * Creates an integrated address from a standard address, and a payment ID.
 *
 * Throws if either address or payment ID is invalid.
 */
export declare function createIntegratedAddress(address: string, paymentID: string, config?: IConfig): Promise<string>;
/**
 * Verifies if a key or payment ID is valid (64 char hex)
 */
export declare function isHex64(val: string): boolean;
/**
 * Converts an address to the corresponding public view and public spend key
 * Precondition: address is valid
 *
 * @hidden
 */
export declare function addressToKeys(address: string, config?: IConfig): Promise<[string, string]>;
/**
 * Get the nearest multiple of the given value, rounded down.
 *
 * @hidden
 */
export declare function getLowerBound(val: number, nearestMultiple: number): number;
/**
 * Get the nearest multiple of the given value, rounded up
 *
 * @hidden
 */
export declare function getUpperBound(val: number, nearestMultiple: number): number;
/**
 * Get a decent value to start the sync process at
 *
 * @hidden
 */
export declare function getCurrentTimestampAdjusted(blockTargetTime?: number): number;
/**
 * Is an input unlocked for spending at this height
 *
 * @hidden
 */
export declare function isInputUnlocked(unlockTime: number, currentHeight: number): boolean;
/**
 * Takes an amount in atomic units and pretty prints it.
 * Example: 12345607 -> 123,456.07 TRTL
 */
export declare function prettyPrintAmount(amount: number, config?: IConfig): string;
/**
 * Sleep for the given amount of milliseconds, async
 *
 * @hidden
 */
export declare function delay(ms: number): Promise<void>;
/**
 * Split each amount into uniform amounts, e.g.
 * 1234567 = 1000000 + 200000 + 30000 + 4000 + 500 + 60 + 7
 *
 * @hidden
 */
export declare function splitAmountIntoDenominations(amount: number, preventTooLargeOutputs?: boolean): number[];
/**
 * The formula for the block size is as follows. Calculate the
 * maxBlockCumulativeSize. This is equal to:
 * 100,000 + ((height * 102,400) / 1,051,200)
 * At a block height of 400k, this gives us a size of 138,964.
 * The constants this calculation arise from can be seen below, or in
 * src/CryptoNoteCore/Currency.cpp::maxBlockCumulativeSize(). Call this value
 * x.
 *
 * Next, calculate the median size of the last 100 blocks. Take the max of
 * this value, and 100,000. Multiply this value by 1.25. Call this value y.
 *
 * Finally, return the minimum of x and y.
 *
 * Or, in short: min(140k (slowly rising), 1.25 * max(100k, median(last 100 blocks size)))
 * Block size will always be 125k or greater (Assuming non testnet)
 *
 * To get the max transaction size, remove 600 from this value, for the
 * reserved miner transaction.
 *
 * We are going to ignore the median(last 100 blocks size), as it is possible
 * for a transaction to be valid for inclusion in a block when it is submitted,
 * but not when it actually comes to be mined, for example if the median
 * block size suddenly decreases. This gives a bit of a lower cap of max
 * tx sizes, but prevents anything getting stuck in the pool.
 *
 * @hidden
 */
export declare function getMaxTxSize(currentHeight: number, blockTime?: number): number;
/**
 * Converts an amount in bytes, say, 10000, into 9.76 KB
 *
 * @hidden
 */
export declare function prettyPrintBytes(bytes: number): string;
/**
 * Returns whether the given word is in the mnemonic english dictionary. Note that
 * just because all the words are valid, does not mean the mnemonic is valid.
 *
 * Use isValidMnemonic to verify that.
 */
export declare function isValidMnemonicWord(word: string): boolean;
/**
 * Verifies whether a mnemonic is valid. Returns a boolean, and an error messsage
 * describing what is invalid.
 */
export declare function isValidMnemonic(mnemonic: string, config?: IConfig): Promise<[boolean, string]>;
export declare function getMinimumTransactionFee(transactionSize: number, height: number, config?: IConfig): number;
export declare function getTransactionFee(transactionSize: number, height: number, feePerByte: number, config?: IConfig): number;
export declare function estimateTransactionSize(mixin: number, numInputs: number, numOutputs: number, havePaymentID: boolean, extraDataSize: number): number;
