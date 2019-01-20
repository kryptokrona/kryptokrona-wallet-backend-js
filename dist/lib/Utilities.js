"use strict";
// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const CnUtils_1 = require("./CnUtils");
const Config_1 = require("./Config");
const Constants_1 = require("./Constants");
function isHex64(key) {
    const regex = new RegExp('^[0-9a-fA-F]{64}$');
    return regex.test(key);
}
exports.isHex64 = isHex64;
/* Precondition: address is valid */
function addressToKeys(address) {
    const parsed = CnUtils_1.CryptoUtils.decodeAddress(address);
    return [parsed.publicViewKey, parsed.publicSpendKey];
}
exports.addressToKeys = addressToKeys;
function getLowerBound(val, nearestMultiple) {
    const remainder = val % nearestMultiple;
    return val - remainder;
}
exports.getLowerBound = getLowerBound;
function getUpperBound(val, nearestMultiple) {
    return getLowerBound(val, nearestMultiple) + nearestMultiple;
}
exports.getUpperBound = getUpperBound;
function getCurrentTimestampAdjusted() {
    const timestamp = Math.floor(Date.now() / 1000);
    return timestamp - (100 * Config_1.default.blockTargetTime);
}
exports.getCurrentTimestampAdjusted = getCurrentTimestampAdjusted;
function isInputUnlocked(unlockTime, currentHeight) {
    /* Might as well return fast with the case that is true for nearly all
       transactions (excluding coinbase) */
    if (unlockTime === 0) {
        return true;
    }
    if (unlockTime >= Constants_1.MAX_BLOCK_NUMBER) {
        return (Math.floor(Date.now() / 1000)) >= unlockTime;
        /* Plus one for CRYPTONOTE_LOCKED_TX_ALLOWED_DELTA_BLOCKS */
    }
    else {
        return currentHeight + 1 >= unlockTime;
    }
}
exports.isInputUnlocked = isInputUnlocked;
/* Takes an amount in atomic units and pretty prints it. */
/* 12345607 -> 123,456.07 TRTL */
function prettyPrintAmount(amount) {
    /* Get the amount we need to divide atomic units by. 2 decimal places = 100 */
    const divisor = Math.pow(10, Config_1.default.decimalPlaces);
    /* This should make us have the right amount of decimals, but lets used
       toFixed() to be sure anyway */
    const unAtomic = (amount / divisor).toFixed(Config_1.default.decimalPlaces);
    /* Makes our numbers thousand separated. https://stackoverflow.com/a/2901298/8737306 */
    const formatted = unAtomic.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return formatted + ' ' + Config_1.default.ticker;
}
exports.prettyPrintAmount = prettyPrintAmount;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.delay = delay;
/* Split each amount into uniform amounts, e.g.
   1234567 = 1000000 + 200000 + 30000 + 4000 + 500 + 60 + 7 */
function splitAmountIntoDenominations(amount) {
    let multiplier = 1;
    const splitAmounts = [];
    while (amount >= 1) {
        const denomination = multiplier * (amount % 10);
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
exports.splitAmountIntoDenominations = splitAmountIntoDenominations;
/* The formula for the block size is as follows. Calculate the
   maxBlockCumulativeSize. This is equal to:
   100,000 + ((height * 102,400) / 1,051,200)
   At a block height of 400k, this gives us a size of 138,964.
   The constants this calculation arise from can be seen below, or in
   src/CryptoNoteCore/Currency.cpp::maxBlockCumulativeSize(). Call this value
   x.

   Next, calculate the median size of the last 100 blocks. Take the max of
   this value, and 100,000. Multiply this value by 1.25. Call this value y.

   Finally, return the minimum of x and y.

   Or, in short: min(140k (slowly rising), 1.25 * max(100k, median(last 100 blocks size)))
   Block size will always be 125k or greater (Assuming non testnet)

   To get the max transaction size, remove 600 from this value, for the
   reserved miner transaction.

   We are going to ignore the median(last 100 blocks size), as it is possible
   for a transaction to be valid for inclusion in a block when it is submitted,
   but not when it actually comes to be mined, for example if the median
   block size suddenly decreases. This gives a bit of a lower cap of max
   tx sizes, but prevents anything getting stuck in the pool.

*/
function getMaxTxSize(currentHeight) {
    const numerator = currentHeight * Constants_1.MAX_BLOCK_SIZE_GROWTH_SPEED_NUMERATOR;
    const denominator = Constants_1.MAX_BLOCK_SIZE_GROWTH_SPEED_DENOMINATOR;
    const growth = numerator / denominator;
    const x = Constants_1.MAX_BLOCK_SIZE_INITIAL + growth;
    const y = 125000;
    /* Need space for the miner transaction */
    return Math.min(x, y) - Constants_1.CRYPTONOTE_COINBASE_BLOB_RESERVED_SIZE;
}
exports.getMaxTxSize = getMaxTxSize;
/**
 * Converts an amount in bytes, say, 10000, into 9.76 KB
 */
function prettyPrintBytes(bytes) {
    const suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    let selectedSuffix = 0;
    while (bytes >= 1024 && selectedSuffix < suffixes.length - 1) {
        selectedSuffix++;
        bytes = Math.floor(bytes / 1024);
    }
    return bytes.toFixed(2) + ' ' + suffixes[selectedSuffix];
}
exports.prettyPrintBytes = prettyPrintBytes;
