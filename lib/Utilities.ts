// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';
import config from './Config';
import { MAX_BLOCK_NUMBER } from './Constants';

export function isHex64(key: string) {
    const regex = new RegExp('^[0-9a-fA-F]{64}$');
    return regex.test(key);
}

/* Precondition: address is valid */
export function addressToKeys(address: string): [string, string] {
    const parsed = CryptoUtils.decodeAddress(address);

    return [parsed.publicViewKey, parsed.publicSpendKey];
}

export function getLowerBound(val: number, nearestMultiple: number): number {
    const remainder = val % nearestMultiple;

    return val - remainder;
}

export function getUpperBound(val: number, nearestMultiple: number): number {
    return getLowerBound(val, nearestMultiple) + nearestMultiple;
}

export function getCurrentTimestampAdjusted(): number {
    const timestamp = Math.floor(Date.now() / 1000);

    /* BLOCK_FUTURE_TIME_LIMIT */
    return timestamp - (60 * 60 * 2);
}

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

/* Takes an amount in atomic units and pretty prints it. */
/* 12345607 -> 123,456.07 TRTL */
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
