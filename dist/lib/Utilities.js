"use strict";
// Copyright (C) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateTransactionSize = exports.getTransactionFee = exports.getMinimumTransactionFee = exports.isValidMnemonic = exports.isValidMnemonicWord = exports.prettyPrintBytes = exports.getMaxTxSize = exports.splitAmountIntoDenominations = exports.delay = exports.prettyPrintAmount = exports.isInputUnlocked = exports.getCurrentTimestampAdjusted = exports.getUpperBound = exports.getLowerBound = exports.addressToKeys = exports.isHex64 = exports.createIntegratedAddress = void 0;
const _ = require("lodash");
const kryptokrona_utils_1 = require("kryptokrona-utils");
const Config_1 = require("./Config");
const CnUtils_1 = require("./CnUtils");
const Constants_1 = require("./Constants");
const ValidateParameters_1 = require("./ValidateParameters");
const WalletError_1 = require("./WalletError");
const WordList_1 = require("./WordList");
const Assert_1 = require("./Assert");
/**
 * Creates an integrated address from a standard address, and a payment ID.
 *
 * Throws if either address or payment ID is invalid.
 */
function createIntegratedAddress(address, paymentID, config = new Config_1.Config()) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, Assert_1.assertString)(address, 'address');
        (0, Assert_1.assertString)(paymentID, 'paymentID');
        const tempConfig = (0, Config_1.MergeConfig)(config);
        let error = yield (0, ValidateParameters_1.validateAddresses)([address], false, tempConfig);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            throw error;
        }
        error = (0, ValidateParameters_1.validatePaymentID)(paymentID);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            throw error;
        }
        /* Validate payment ID allows empty payment ID's */
        if (paymentID === '') {
            throw new Error('Payment ID is empty string!');
        }
        return (0, CnUtils_1.CryptoUtils)(tempConfig).createIntegratedAddress(address, paymentID);
    });
}
exports.createIntegratedAddress = createIntegratedAddress;
/**
 * Verifies if a key or payment ID is valid (64 char hex)
 */
function isHex64(val) {
    (0, Assert_1.assertString)(val, 'val');
    const regex = new RegExp('^[0-9a-fA-F]{64}$');
    return regex.test(val);
}
exports.isHex64 = isHex64;
/**
 * Converts an address to the corresponding public view and public spend key
 * Precondition: address is valid
 *
 * @hidden
 */
function addressToKeys(address, config = new Config_1.Config()) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempConfig = (0, Config_1.MergeConfig)(config);
        const parsed = yield kryptokrona_utils_1.Address.fromAddress(address, tempConfig.addressPrefix);
        return [parsed.view.publicKey, parsed.spend.publicKey];
    });
}
exports.addressToKeys = addressToKeys;
/**
 * Get the nearest multiple of the given value, rounded down.
 *
 * @hidden
 */
function getLowerBound(val, nearestMultiple) {
    const remainder = val % nearestMultiple;
    return val - remainder;
}
exports.getLowerBound = getLowerBound;
/**
 * Get the nearest multiple of the given value, rounded up
 *
 * @hidden
 */
function getUpperBound(val, nearestMultiple) {
    return getLowerBound(val, nearestMultiple) + nearestMultiple;
}
exports.getUpperBound = getUpperBound;
/**
 * Get a decent value to start the sync process at
 *
 * @hidden
 */
function getCurrentTimestampAdjusted(blockTargetTime = 30) {
    const timestamp = Math.floor(Date.now() / 1000);
    return timestamp - (100 * blockTargetTime);
}
exports.getCurrentTimestampAdjusted = getCurrentTimestampAdjusted;
/**
 * Is an input unlocked for spending at this height
 *
 * @hidden
 */
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
/**
 * Takes an amount in atomic units and pretty prints it.
 * Example: 12345607 -> 123,456.07 TRTL
 */
function prettyPrintAmount(amount, config = new Config_1.Config()) {
    (0, Assert_1.assertNumber)(amount, 'amount');
    const tempConfig = (0, Config_1.MergeConfig)(config);
    /* Get the amount we need to divide atomic units by. 2 decimal places = 100 */
    const divisor = Math.pow(10, tempConfig.decimalPlaces);
    const dollars = amount >= 0 ? Math.floor(amount / divisor) : Math.ceil(amount / divisor);
    /* Make sure 1 is displaced as 01 */
    const cents = (Math.abs(amount % divisor)).toString().padStart(tempConfig.decimalPlaces, '0');
    /* Makes our numbers thousand separated. https://stackoverflow.com/a/2901298/8737306 */
    const formatted = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return formatted + '.' + cents + ' ' + tempConfig.ticker;
}
exports.prettyPrintAmount = prettyPrintAmount;
/**
 * Sleep for the given amount of milliseconds, async
 *
 * @hidden
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.delay = delay;
/**
 * Split each amount into uniform amounts, e.g.
 * 1234567 = 1000000 + 200000 + 30000 + 4000 + 500 + 60 + 7
 *
 * @hidden
 */
function splitAmountIntoDenominations(amount, preventTooLargeOutputs = true) {
    let multiplier = 1;
    let splitAmounts = [];
    while (amount >= 1) {
        const denomination = multiplier * (amount % 10);
        if (denomination > Constants_1.MAX_OUTPUT_SIZE_CLIENT && preventTooLargeOutputs) {
            /* Split amounts into ten chunks */
            let numSplitAmounts = 10;
            let splitAmount = denomination / 10;
            while (splitAmount > Constants_1.MAX_OUTPUT_SIZE_CLIENT) {
                splitAmount = Math.floor(splitAmount / 10);
                numSplitAmounts *= 10;
            }
            splitAmounts = splitAmounts.concat(Array(numSplitAmounts).fill(splitAmount));
        }
        else if (denomination !== 0) {
            splitAmounts.push(denomination);
        }
        amount = Math.floor(amount / 10);
        multiplier *= 10;
    }
    return splitAmounts;
}
exports.splitAmountIntoDenominations = splitAmountIntoDenominations;
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
function getMaxTxSize(currentHeight, blockTime = 30) {
    const numerator = currentHeight * Constants_1.MAX_BLOCK_SIZE_GROWTH_SPEED_NUMERATOR;
    const denominator = (Constants_1.MAX_BLOCK_SIZE_GROWTH_SPEED_DENOMINATOR / blockTime);
    const growth = numerator / denominator;
    const x = Constants_1.MAX_BLOCK_SIZE_INITIAL + growth;
    const y = 125000;
    /* Need space for the miner transaction */
    return Math.min(x, y) - Constants_1.CRYPTONOTE_COINBASE_BLOB_RESERVED_SIZE;
}
exports.getMaxTxSize = getMaxTxSize;
/**
 * Converts an amount in bytes, say, 10000, into 9.76 KB
 *
 * @hidden
 */
function prettyPrintBytes(bytes) {
    const suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    let selectedSuffix = 0;
    while (bytes >= 1024 && selectedSuffix < suffixes.length - 1) {
        selectedSuffix++;
        bytes /= 1024;
    }
    return bytes.toFixed(2) + ' ' + suffixes[selectedSuffix];
}
exports.prettyPrintBytes = prettyPrintBytes;
/**
 * Returns whether the given word is in the mnemonic english dictionary. Note that
 * just because all the words are valid, does not mean the mnemonic is valid.
 *
 * Use isValidMnemonic to verify that.
 */
function isValidMnemonicWord(word) {
    (0, Assert_1.assertString)(word, 'word');
    return WordList_1.English.includes(word);
}
exports.isValidMnemonicWord = isValidMnemonicWord;
/**
 * Verifies whether a mnemonic is valid. Returns a boolean, and an error messsage
 * describing what is invalid.
 */
function isValidMnemonic(mnemonic, config = new Config_1.Config()) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, Assert_1.assertString)(mnemonic, 'mnemonic');
        const tempConfig = (0, Config_1.MergeConfig)(config);
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
            yield kryptokrona_utils_1.Address.fromMnemonic(words.join(' '), undefined, tempConfig.addressPrefix);
            return [true, ''];
        }
        catch (err) {
            return [false, 'Mnemonic checksum word is invalid'];
        }
    });
}
exports.isValidMnemonic = isValidMnemonic;
function getMinimumTransactionFee(transactionSize, height, config = new Config_1.Config()) {
    const tempConfig = (0, Config_1.MergeConfig)(config);
    return getTransactionFee(transactionSize, height, tempConfig.minimumFeePerByte, tempConfig);
}
exports.getMinimumTransactionFee = getMinimumTransactionFee;
function getTransactionFee(transactionSize, height, feePerByte, config = new Config_1.Config()) {
    return 10;
    const tempConfig = (0, Config_1.MergeConfig)(config);
    const numChunks = Math.ceil(transactionSize / tempConfig.feePerByteChunkSize);
    return numChunks * feePerByte * tempConfig.feePerByteChunkSize;
}
exports.getTransactionFee = getTransactionFee;
function estimateTransactionSize(mixin, numInputs, numOutputs, havePaymentID, extraDataSize) {
    const KEY_IMAGE_SIZE = 32;
    const OUTPUT_KEY_SIZE = 32;
    const AMOUNT_SIZE = 8 + 2; // varint
    const GLOBAL_INDEXES_VECTOR_SIZE_SIZE = 1; // varint
    const GLOBAL_INDEXES_INITIAL_VALUE_SIZE = 4; // varint
    const SIGNATURE_SIZE = 64;
    const EXTRA_TAG_SIZE = 1;
    const INPUT_TAG_SIZE = 1;
    const OUTPUT_TAG_SIZE = 1;
    const PUBLIC_KEY_SIZE = 32;
    const TRANSACTION_VERSION_SIZE = 1;
    const TRANSACTION_UNLOCK_TIME_SIZE = 8 + 2; // varint
    const EXTRA_DATA_SIZE = extraDataSize > 0 ? extraDataSize + 4 : 0;
    const PAYMENT_ID_SIZE = havePaymentID ? 34 : 0;
    /* The size of the transaction header */
    const headerSize = TRANSACTION_VERSION_SIZE
        + TRANSACTION_UNLOCK_TIME_SIZE
        + EXTRA_TAG_SIZE
        + EXTRA_DATA_SIZE
        + PUBLIC_KEY_SIZE
        + PAYMENT_ID_SIZE;
    /* The size of each transaction input */
    const inputSize = INPUT_TAG_SIZE
        + AMOUNT_SIZE
        + KEY_IMAGE_SIZE
        + SIGNATURE_SIZE
        + GLOBAL_INDEXES_VECTOR_SIZE_SIZE
        + GLOBAL_INDEXES_INITIAL_VALUE_SIZE
        + mixin * SIGNATURE_SIZE;
    const inputsSize = inputSize * numInputs;
    /* The size of each transaction output. */
    const outputSize = OUTPUT_TAG_SIZE
        + OUTPUT_KEY_SIZE
        + AMOUNT_SIZE;
    const outputsSize = outputSize * numOutputs;
    return headerSize + inputsSize + outputsSize;
}
exports.estimateTransactionSize = estimateTransactionSize;
