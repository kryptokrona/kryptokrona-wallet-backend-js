// Copyright (C) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

import { IConfig, Config, MergeConfig } from './Config';
import { CryptoUtils} from './CnUtils';

import {
    CRYPTONOTE_COINBASE_BLOB_RESERVED_SIZE, MAX_BLOCK_NUMBER,
    MAX_BLOCK_SIZE_GROWTH_SPEED_DENOMINATOR,
    MAX_BLOCK_SIZE_GROWTH_SPEED_NUMERATOR, MAX_BLOCK_SIZE_INITIAL,
    MAX_OUTPUT_SIZE_CLIENT,
} from './Constants';

import { validateAddresses, validatePaymentID } from './ValidateParameters';
import { SUCCESS } from './WalletError';
import { English } from './WordList';
import { assertString, assertNumber } from './Assert';

/**
 * Creates an integrated address from a standard address, and a payment ID.
 *
 * Throws if either address or payment ID is invalid.
 */
export function createIntegratedAddress(
    address: string,
    paymentID: string,
    config: IConfig = new Config()): string {

    assertString(address, 'address');
    assertString(paymentID, 'paymentID');

    const tempConfig: Config = MergeConfig(config);

    let error = validateAddresses([address], false, tempConfig);

    if (!_.isEqual(error, SUCCESS)) {
        throw error;
    }

    error = validatePaymentID(paymentID);

    if (!_.isEqual(error, SUCCESS)) {
        throw error;
    }

    /* Validate payment ID allows empty payment ID's */
    if (paymentID === '') {
        throw new Error('Payment ID is empty string!');
    }

    return CryptoUtils(tempConfig).createIntegratedAddress(address, paymentID);
}

/**
 * Verifies if a key or payment ID is valid (64 char hex)
 */
export function isHex64(val: string): boolean {
    assertString(val, 'val');

    const regex = new RegExp('^[0-9a-fA-F]{64}$');
    return regex.test(val);
}

/**
 * Converts an address to the corresponding public view and public spend key
 * Precondition: address is valid
 *
 * @hidden
 */
export function addressToKeys(address: string, config: IConfig = new Config()): [string, string] {
    const tempConfig: Config = MergeConfig(config);

    const parsed = CryptoUtils(tempConfig).decodeAddress(address);

    return [parsed.publicViewKey, parsed.publicSpendKey];
}

/**
 * Get the nearest multiple of the given value, rounded down.
 *
 * @hidden
 */
export function getLowerBound(val: number, nearestMultiple: number): number {
    const remainder = val % nearestMultiple;

    return val - remainder;
}

/**
 * Get the nearest multiple of the given value, rounded up
 *
 * @hidden
 */
export function getUpperBound(val: number, nearestMultiple: number): number {
    return getLowerBound(val, nearestMultiple) + nearestMultiple;
}

/**
 * Get a decent value to start the sync process at
 *
 * @hidden
 */
export function getCurrentTimestampAdjusted(blockTargetTime: number = 30): number {
    const timestamp = Math.floor(Date.now() / 1000);

    return timestamp - (100 * blockTargetTime);
}

/**
 * Is an input unlocked for spending at this height
 *
 * @hidden
 */
export function isInputUnlocked(unlockTime: number, currentHeight: number): boolean {
    /* Might as well return fast with the case that is true for nearly all
       transactions (excluding coinbase) */
    if (unlockTime === 0) {
        return true;
    }

    if (unlockTime >= MAX_BLOCK_NUMBER) {
        return (Math.floor(Date.now() / 1000)) >= unlockTime;
    /* Plus one for CRYPTONOTE_LOCKED_TX_ALLOWED_DELTA_BLOCKS */
    } else {
        return currentHeight + 1 >= unlockTime;
    }
}

/**
 * Takes an amount in atomic units and pretty prints it.
 * Example: 12345607 -> 123,456.07 TRTL
 */
export function prettyPrintAmount(amount: number, config: IConfig = new Config()): string {
    assertNumber(amount, 'amount');

    const tempConfig: Config = MergeConfig(config);

    /* Get the amount we need to divide atomic units by. 2 decimal places = 100 */
    const divisor: number = Math.pow(10, tempConfig.decimalPlaces);

    const dollars: number = amount >= 0 ? Math.floor(amount / divisor) : Math.ceil(amount / divisor);

    /* Make sure 1 is displaced as 01 */
    const cents: string = (Math.abs(amount % divisor)).toString().padStart(tempConfig.decimalPlaces, '0');

    /* Makes our numbers thousand separated. https://stackoverflow.com/a/2901298/8737306 */
    const formatted: string = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return formatted + '.' + cents + ' ' + tempConfig.ticker;
}

/**
 * Sleep for the given amount of milliseconds, async
 *
 * @hidden
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Split each amount into uniform amounts, e.g.
 * 1234567 = 1000000 + 200000 + 30000 + 4000 + 500 + 60 + 7
 *
 * @hidden
 */
export function splitAmountIntoDenominations(amount: number, preventTooLargeOutputs: boolean = true): number[] {
    let multiplier: number = 1;

    let splitAmounts: number[] = [];

    while (amount >= 1) {
        const denomination: number = multiplier * (amount % 10);

        if (denomination > MAX_OUTPUT_SIZE_CLIENT && preventTooLargeOutputs) {
            /* Split amounts into ten chunks */
            let numSplitAmounts = 10;
            let splitAmount = denomination / 10;

            while (splitAmount > MAX_OUTPUT_SIZE_CLIENT) {
                splitAmount = Math.floor(splitAmount / 10);
                numSplitAmounts *= 10;
            }

            splitAmounts = splitAmounts.concat(Array(numSplitAmounts).fill(splitAmount));
        } else if (denomination !== 0) {
            splitAmounts.push(denomination);
        }

        amount = Math.floor(amount / 10);
        multiplier *= 10;
    }

    return splitAmounts;
}

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
export function getMaxTxSize(currentHeight: number, blockTime: number = 30): number {
    const numerator: number = currentHeight * MAX_BLOCK_SIZE_GROWTH_SPEED_NUMERATOR;
    const denominator: number = (MAX_BLOCK_SIZE_GROWTH_SPEED_DENOMINATOR / blockTime);
    const growth: number = numerator / denominator;
    const x: number = MAX_BLOCK_SIZE_INITIAL + growth;
    const y: number = 125000;

    /* Need space for the miner transaction */
    return Math.min(x, y) - CRYPTONOTE_COINBASE_BLOB_RESERVED_SIZE;
}

/**
 * Converts an amount in bytes, say, 10000, into 9.76 KB
 *
 * @hidden
 */
export function prettyPrintBytes(bytes: number): string {
    const suffixes: string[] = ['B', 'KB', 'MB', 'GB', 'TB'];

    let selectedSuffix: number = 0;

    while (bytes >= 1024 && selectedSuffix < suffixes.length - 1) {
        selectedSuffix++;
        bytes /= 1024;
    }

    return bytes.toFixed(2) + ' ' + suffixes[selectedSuffix];
}

/**
 * Returns whether the given word is in the mnemonic english dictionary. Note that
 * just because all the words are valid, does not mean the mnemonic is valid.
 *
 * Use isValidMnemonic to verify that.
 */
export function isValidMnemonicWord(word: string): boolean {
    assertString(word, 'word');

    return English.includes(word);
}

/**
 * Verifies whether a mnemonic is valid. Returns a boolean, and an error messsage
 * describing what is invalid.
 */
export function isValidMnemonic(mnemonic: string, config: IConfig = new Config()): [boolean, string] {
    assertString(mnemonic, 'mnemonic');

    const tempConfig: Config = MergeConfig(config);

    const words = mnemonic.split(' ').map((x) => x.toLowerCase());

    if (words.length !== 25) {
        return [false, 'The mnemonic seed given is the wrong length.'];
    }

    const invalidWords = [];

    for (const word of words) {
        if (!isValidMnemonicWord(word)) {
            invalidWords.push(word);
        }
    }

    if (invalidWords.length !== 0) {
        return [
            false,
            'The following mnemonic words are not in the english word list: '
                + invalidWords.join(', '),
        ];
    }

    try {
        CryptoUtils(tempConfig).createAddressFromMnemonic(words.join(' '));
        return [true, ''];
    } catch (err) {
        return [false, 'Mnemonic checksum word is invalid'];
    }
}

export function getMinimumTransactionFee(
    transactionSize: number,
    height: number,
    config: IConfig = new Config()) {

    const tempConfig: Config = MergeConfig(config);

    return getTransactionFee(
        transactionSize,
        height,
        tempConfig.minimumFeePerByte,
        tempConfig,
    );
}

export function getTransactionFee(
    transactionSize: number,
    height: number,
    feePerByte: number,
    config: IConfig = new Config()) {

    const tempConfig: Config = MergeConfig(config);

    const numChunks: number = Math.ceil(
        transactionSize / tempConfig.feePerByteChunkSize,
    );

    return numChunks * feePerByte * tempConfig.feePerByteChunkSize;
}

export function estimateTransactionSize(
    mixin: number,
    numInputs: number,
    numOutputs: number,
    havePaymentID: boolean,
    extraDataSize: number): number {

    const KEY_IMAGE_SIZE: number = 32;
    const OUTPUT_KEY_SIZE: number = 32;
    const AMOUNT_SIZE = 8 + 2; // varint
    const GLOBAL_INDEXES_VECTOR_SIZE_SIZE: number = 1 // varint
    const GLOBAL_INDEXES_INITIAL_VALUE_SIZE: number = 4; // varint
    const GLOBAL_INDEXES_DIFFERENCE_SIZE: number = 4; // varint
    const SIGNATURE_SIZE: number = 64;
    const EXTRA_TAG_SIZE: number = 1;
    const INPUT_TAG_SIZE: number = 1;
    const OUTPUT_TAG_SIZE: number = 1;
    const PUBLIC_KEY_SIZE: number = 32;
    const TRANSACTION_VERSION_SIZE: number = 1;
    const TRANSACTION_UNLOCK_TIME_SIZE: number = 8 + 2; // varint
    const EXTRA_DATA_SIZE: number = extraDataSize > 0 ? extraDataSize + 4 : 0;
    const PAYMENT_ID_SIZE: number = havePaymentID ? 34 : 0;

    /* The size of the transaction header */
    const headerSize: number = TRANSACTION_VERSION_SIZE
                             + TRANSACTION_UNLOCK_TIME_SIZE
                             + EXTRA_TAG_SIZE
                             + EXTRA_DATA_SIZE
                             + PUBLIC_KEY_SIZE
                             + PAYMENT_ID_SIZE;

    /* The size of each transaction input */
    const inputSize: number = INPUT_TAG_SIZE
                            + AMOUNT_SIZE
                            + KEY_IMAGE_SIZE
                            + SIGNATURE_SIZE
                            + GLOBAL_INDEXES_VECTOR_SIZE_SIZE
                            + GLOBAL_INDEXES_INITIAL_VALUE_SIZE
                            + mixin * SIGNATURE_SIZE;

    const inputsSize: number = inputSize * numInputs;

    /* The size of each transaction output. */
    const outputSize: number = OUTPUT_TAG_SIZE
                             + OUTPUT_KEY_SIZE
                             + AMOUNT_SIZE;

    const outputsSize: number = outputSize * numOutputs;

    return headerSize + inputsSize + outputsSize;
}
