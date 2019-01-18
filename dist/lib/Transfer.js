"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const deepEqual = require("deep-equal");
const _ = require("lodash");
const CnUtils_1 = require("./CnUtils");
const Logger_1 = require("./Logger");
const Utilities_1 = require("./Utilities");
const ValidateParameters_1 = require("./ValidateParameters");
const WalletError_1 = require("./WalletError");
const Config_1 = require("./Config");
/**
 * Sends a transaction of amount to the address destination, using the
 * given payment ID, if specified.
 *
 * Network fee is set to default, mixin is set to default, all subwallets
 * are taken from, primary address is used as change address.
 *
 * If you need more control, use `sendTransactionAdvanced()`
 *
 * @param destination   The address to send the funds to
 * @param amount        The amount to send, in ATOMIC units
 * @param paymentID     The payment ID to include with this transaction. Optional.
 *
 * @return Returns either an error, or the transaction hash.
 */
function sendTransactionBasic(daemon, subWallets, destination, amount, paymentID) {
    return __awaiter(this, void 0, void 0, function* () {
        return sendTransactionAdvanced(daemon, subWallets, [[destination, amount]], undefined, undefined, paymentID);
    });
}
exports.sendTransactionBasic = sendTransactionBasic;
/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon, subWallets, and addressesAndAmounts.
 *
 * @param addressesAndAmounts   An array of destinations, and amounts to send to that
 *                              destination.
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param fee                   The network fee to use with this transaction. In ATOMIC units.
 * @param paymentID             The payment ID to include with this transaction.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param changeAddress         The address to send any returned change to.
 */
function sendTransactionAdvanced(daemon, subWallets, addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        if (mixin === undefined) {
            mixin = Config_1.default.mixinLimits.getDefaultMixinByHeight(daemon.getNetworkBlockCount());
        }
        if (fee === undefined) {
            fee = Config_1.default.minimumFee;
        }
        if (paymentID === undefined) {
            paymentID = '';
        }
        if (subWalletsToTakeFrom === undefined || subWalletsToTakeFrom.length === 0) {
            subWalletsToTakeFrom = subWallets.getAddresses();
        }
        if (changeAddress === undefined || changeAddress === '') {
            changeAddress = subWallets.getPrimaryAddress();
        }
        const [feeAddress, feeAmount] = daemon.nodeFee();
        /* Add the node fee, if it exists */
        if (feeAmount !== 0) {
            addressesAndAmounts.push([feeAddress, feeAmount]);
        }
        const error = validateTransaction(addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, daemon.getNetworkBlockCount(), subWallets);
        if (!deepEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        const tmp = [];
        const totalAmount = _.sumBy(addressesAndAmounts, ([address, amount]) => amount) + fee;
        /* Prepare destinations keys */
        const transfers = addressesAndAmounts.map(([address, amount]) => {
            const decoded = CnUtils_1.CryptoUtils.decodeAddress(address);
            /* Assign payment ID from integrated address is present */
            if (decoded.paymentId !== '') {
                paymentID = decoded.paymentId;
            }
            return {
                amount: amount,
                keys: decoded,
            };
        });
        const [inputs, foundMoney] = subWallets.getTransactionInputsForAmount(totalAmount, subWalletsToTakeFrom, daemon.getNetworkBlockCount());
        const ourOutputs = inputs.map((input) => {
            const [keyImage, tmpSecretKey] = CnUtils_1.CryptoUtils.generateKeyImage(input.input.transactionPublicKey, subWallets.getPrivateViewKey(), input.publicSpendKey, input.privateSpendKey, input.input.transactionIndex);
            return {
                amount: input.input.amount,
                globalIndex: input.input.globalOutputIndex,
                index: input.input.transactionIndex,
                input: {
                    privateEphemeral: tmpSecretKey,
                    privateSpendKey: input.privateSpendKey,
                    publicSpendKey: input.publicSpendKey,
                },
                key: input.input.key,
                keyImage: keyImage,
            };
        });
        const randomOuts = yield getRingParticipants(inputs, mixin, daemon);
        if (randomOuts instanceof WalletError_1.WalletError) {
            return randomOuts;
        }
        let tx;
        try {
            tx = CnUtils_1.CryptoUtils.createTransaction(transfers, ourOutputs, randomOuts, mixin, fee, paymentID);
        }
        catch (err) {
            Logger_1.logger.log('Failed to create transaction: ' + err.toString(), Logger_1.LogLevel.ERROR, Logger_1.LogCategory.TRANSACTIONS);
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.UNKNOWN_ERROR, err.toString());
        }
        try {
            const relaySuccess = yield daemon.sendTransaction(tx.rawTransaction);
            if (relaySuccess) {
                return tx.hash;
            }
            else {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_ERROR);
            }
            /* Timeout */
        }
        catch (err) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_OFFLINE);
        }
        return tx.hash;
    });
}
exports.sendTransactionAdvanced = sendTransactionAdvanced;
/**
 * Get sufficient random outputs for the transaction. Returns an error if
 * can't get outputs or can't get enough outputs.
 */
function getRingParticipants(inputs, mixin, daemon) {
    return __awaiter(this, void 0, void 0, function* () {
        if (mixin === 0) {
            return [];
        }
        /* Request one more than needed, this way if we get our own output as
           one of the mixin outs, we can skip it and still form the transaction */
        const requestedOuts = mixin + 1;
        const amounts = inputs.map((input) => input.input.amount);
        const outs = yield daemon.getRandomOutputsByAmount(amounts, mixin);
        if (outs.length === 0) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_OFFLINE);
        }
        for (const amount of amounts) {
            /* Check each amount is present in outputs */
            const foundOutputs = _.find(outs, ([outAmount, ignore]) => amount === outAmount);
            if (foundOutputs === undefined) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS, `Failed to get any matching outputs for amount ${amount} ` +
                    `(${Utilities_1.prettyPrintAmount(amount)}). Further explanation here: ` +
                    `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`);
            }
            if (foundOutputs.length < mixin) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS, `Failed to get enough matching outputs for amount ${amount} ` +
                    `(${Utilities_1.prettyPrintAmount(amount)}). Needed outputs: ${requestedOuts} ` +
                    `, found outputs: ${foundOutputs.length}. Further explanation here: ` +
                    `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`);
            }
        }
        if (outs.length !== amounts.length) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS);
        }
        const randomOuts = [];
        /* Do the same check as above here, again. The reason being that
           we just find the first set of outputs matching the amount above,
           and if we requests, say, outputs for the amount 100 twice, the
           first set might be sufficient, but the second are not.
   
           We could just check here instead of checking above, but then we
           might hit the length message first. Checking this way gives more
           informative errors. */
        for (const [amount, outputs] of outs) {
            if (outputs.length < mixin) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS, `Failed to get enough matching outputs for amount ${amount} ` +
                    `(${Utilities_1.prettyPrintAmount(amount)}). Needed outputs: ${requestedOuts} ` +
                    `, found outputs: ${outputs.length}. Further explanation here: ` +
                    `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`);
            }
            randomOuts.push(outputs.map(([index, key]) => {
                return {
                    globalIndex: index,
                    key: key,
                };
            }));
        }
        return randomOuts;
    });
}
/**
 * Validate the given transaction parameters are valid.
 *
 * @return Returns either SUCCESS or an error representing the issue
 */
function validateTransaction(destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, currentHeight, subWallets) {
    /* Validate the destinations are valid */
    let error = ValidateParameters_1.validateDestinations(destinations);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Validate stored payment ID's in integrated addresses don't conflict */
    error = ValidateParameters_1.validateIntegratedAddresses(destinations, paymentID);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Verify the subwallets to take from exist */
    error = ValidateParameters_1.validateOurAddresses(subWalletsToTakeFrom, subWallets);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Verify we have enough money for the transaction */
    error = ValidateParameters_1.validateAmount(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Validate mixin is within the bounds for the current height */
    error = ValidateParameters_1.validateMixin(mixin, currentHeight);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    error = ValidateParameters_1.validatePaymentID(paymentID);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    error = ValidateParameters_1.validateOurAddresses([changeAddress], subWallets);
    if (!deepEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    return WalletError_1.SUCCESS;
}
