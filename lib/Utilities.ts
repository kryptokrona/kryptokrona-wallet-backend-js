// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';
import config from './Config';

import {
    CRYPTONOTE_COINBASE_BLOB_RESERVED_SIZE, MAX_BLOCK_NUMBER,
    MAX_BLOCK_SIZE_GROWTH_SPEED_DENOMINATOR,
    MAX_BLOCK_SIZE_GROWTH_SPEED_NUMERATOR, MAX_BLOCK_SIZE_INITIAL,
} from './Constants';

/**
 * Verifies if a key or payment ID is valid (64 char hex)
 */
export function isHex64(val: string) {
    const regex = new RegExp('^[0-9a-fA-F]{64}$');
    return regex.test(val);
}

/**
 * Converts an address to the corresponding public view and public spend key
 * Precondition: address is valid
 *
 * @hidden
 */
export function addressToKeys(address: string): [string, string] {
    const parsed = CryptoUtils.decodeAddress(address);

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
export function getCurrentTimestampAdjusted(): number {
    const timestamp = Math.floor(Date.now() / 1000);

    return timestamp - (100 * config.blockTargetTime);
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
export function prettyPrintAmount(amount: number): string {
    /* Get the amount we need to divide atomic units by. 2 decimal places = 100 */
    const divisor: number = Math.pow(10, config.decimalPlaces);

    /* This should make us have the right amount of decimals, but lets used
       toFixed() to be sure anyway */
    const unAtomic: string = (amount / divisor).toFixed(config.decimalPlaces);

    /* Makes our numbers thousand separated. https://stackoverflow.com/a/2901298/8737306 */
    const formatted: string = unAtomic.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return formatted + ' ' + config.ticker;
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
export function splitAmountIntoDenominations(amount: number): number[] {
    let multiplier: number = 1;

    const splitAmounts: number[] = [];

    while (amount >= 1) {
        const denomination: number = multiplier * (amount % 10);

        /* If we have for example, 1010 - we want 1000 + 10,
           not 1000 + 0 + 10 + 0 */
        if (denomination !== 0) {
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
export function getMaxTxSize(currentHeight: number): number {
    const numerator: number = currentHeight * MAX_BLOCK_SIZE_GROWTH_SPEED_NUMERATOR;
    const denominator: number = MAX_BLOCK_SIZE_GROWTH_SPEED_DENOMINATOR;
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

        bytes = Math.floor(bytes / 1024);
    }

    return bytes.toFixed(2) + ' ' + suffixes[selectedSuffix];
}
