"use strict";
// Copyright (c) 2018-2020, Zpalmtree
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
exports.sendPreparedTransaction = exports.sendTransactionAdvanced = exports.sendTransactionBasic = exports.sendFusionTransactionAdvanced = exports.sendFusionTransactionBasic = void 0;
const _ = require("lodash");
const kryptokrona_utils_1 = require("kryptokrona-utils");
const FeeType_1 = require("./FeeType");
const CnUtils_1 = require("./CnUtils");
const Logger_1 = require("./Logger");
const Types_1 = require("./Types");
const CryptoWrapper_1 = require("./CryptoWrapper");
const Utilities_1 = require("./Utilities");
const ValidateParameters_1 = require("./ValidateParameters");
const Constants_1 = require("./Constants");
const WalletError_1 = require("./WalletError");
/**
 * Sends a fusion transaction.
 * If you need more control, use `sendFusionTransactionAdvanced`
 * Note that if your wallet is fully optimized, this will be indicated in the
 * returned error code.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
function sendFusionTransactionBasic(config, daemon, subWallets) {
    return __awaiter(this, void 0, void 0, function* () {
        return sendFusionTransactionAdvanced(config, daemon, subWallets);
    });
}
exports.sendFusionTransactionBasic = sendFusionTransactionBasic;
/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon and subWallets.
 * @param config
 * @param daemon                A daemon instance we can send the transaction to
 * @param subWallets            The subwallets instance to draw funds from
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param destination           The destination for the fusion transactions to be sent to.
 *                              Must be a subwallet in this container.
 * @param extraData             Extra arbitrary data to include in the transaction
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
function sendFusionTransactionAdvanced(config, daemon, subWallets, mixin, subWalletsToTakeFrom, destination, extraData) {
    return __awaiter(this, void 0, void 0, function* () {
        Logger_1.logger.log('Starting sendFusionTransaction process', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        const returnValue = {
            success: false,
            error: WalletError_1.SUCCESS,
        };
        if (mixin === undefined) {
            mixin = config.mixinLimits.getDefaultMixinByHeight(daemon.getNetworkBlockCount());
            Logger_1.logger.log(`Mixin not given, defaulting to mixin of ${mixin}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        /* Take from all subaddresses if none given */
        if (subWalletsToTakeFrom === undefined || subWalletsToTakeFrom.length === 0) {
            subWalletsToTakeFrom = subWallets.getAddresses();
            Logger_1.logger.log(`Subwallets to take from not given, defaulting to all subwallets (${subWalletsToTakeFrom})`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        /* Use primary address as change address if not given */
        if (destination === undefined || destination === '') {
            destination = subWallets.getPrimaryAddress();
            Logger_1.logger.log(`Destination address not given, defaulting to destination address of ${destination}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        Logger_1.logger.log('Prevalidating fusion transaction', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        /* Verify it's all valid */
        const error = yield validateFusionTransaction(mixin, subWalletsToTakeFrom, destination, daemon.getNetworkBlockCount(), subWallets, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            Logger_1.logger.log(`Failed to validate fusion transaction: ${error.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            returnValue.error = error;
            return returnValue;
        }
        /* Get the random inputs for this tx */
        const [ourInputs, foundMoney] = yield subWallets.getFusionTransactionInputs(subWalletsToTakeFrom, mixin, daemon.getNetworkBlockCount());
        Logger_1.logger.log(`Selected ${ourInputs.length} inputs for fusion transaction, for total amount of ${(0, Utilities_1.prettyPrintAmount)(foundMoney)}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        /* Payment ID's are not needed with fusion transactions */
        const paymentID = '';
        /* Fusion transactions are free */
        const fee = 0;
        let fusionTX;
        while (true) {
            Logger_1.logger.log(`Verifying fusion transaction is reasonable size`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            /* Not enough unspent inputs for a fusion TX, we're fully optimized */
            if (ourInputs.length < Constants_1.FUSION_TX_MIN_INPUT_COUNT) {
                Logger_1.logger.log('Wallet is fully optimized, cancelling fusion transaction', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                returnValue.error = new WalletError_1.WalletError(WalletError_1.WalletErrorCode.FULLY_OPTIMIZED);
                return returnValue;
            }
            /* Amount of the transaction */
            const amount = _.sumBy(ourInputs, (input) => input.input.amount);
            /* Number of outputs this transaction will create */
            const numOutputs = (0, Utilities_1.splitAmountIntoDenominations)(amount).length;
            Logger_1.logger.log(`Sum of tmp transaction: ${(0, Utilities_1.prettyPrintAmount)(amount)}, num outputs: ${numOutputs}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            /* Need to have at least 4x more inputs than outputs */
            if (numOutputs === 0
                || (ourInputs.length / numOutputs) < Constants_1.FUSION_TX_MIN_IN_OUT_COUNT_RATIO) {
                Logger_1.logger.log(`Too many outputs, decreasing number of inputs`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                /* Remove last input */
                ourInputs.pop();
                /* And try again */
                continue;
            }
            const addressesAndAmounts = [[destination, amount]];
            const destinations = yield setupDestinations(addressesAndAmounts, 0, destination, config);
            const [tx, creationError] = yield makeTransaction(mixin, fee, paymentID, ourInputs, destinations, subWallets, daemon, config, extraData);
            if (creationError || tx === undefined) {
                Logger_1.logger.log(`Failed to create fusion transaction, ${creationError.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                returnValue.error = creationError;
                return returnValue;
            }
            if (tx.size > Constants_1.MAX_FUSION_TX_SIZE) {
                Logger_1.logger.log(`Fusion tx is too large, decreasing number of inputs`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                /* Transaction too large, remove last input */
                ourInputs.pop();
                /* And try again */
                continue;
            }
            fusionTX = tx;
            /* Creation succeeded, and it's a valid fusion transaction -- lets try
               sending it! */
            break;
        }
        Logger_1.logger.log(`Successfully created fusion transaction, proceeding to validating and sending`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        const verifyErr = verifyTransaction(fusionTX, FeeType_1.FeeType.FixedFee(0), daemon, config);
        if (!_.isEqual(verifyErr, WalletError_1.SUCCESS)) {
            returnValue.error = verifyErr;
            return returnValue;
        }
        const result = yield relayTransaction(fusionTX, fee, paymentID, ourInputs, destination, 0, subWallets, daemon, config);
        const [prettyTransaction, err] = result;
        if (err) {
            Logger_1.logger.log(`Failed to verify and send transaction: ${err.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            returnValue.error = err;
            return returnValue;
        }
        returnValue.success = true;
        returnValue.fee = fee;
        returnValue.paymentID = paymentID;
        returnValue.inputs = ourInputs;
        returnValue.changeAddress = destination;
        returnValue.changeRequired = 0;
        returnValue.rawTransaction = fusionTX;
        returnValue.transactionHash = yield fusionTX.hash();
        returnValue.prettyTransaction = prettyTransaction;
        returnValue.destinations = {
            nodeFee: undefined,
            change: undefined,
            userDestinations: [{
                    address: destination,
                    amount: _.sumBy(ourInputs, (input) => input.input.amount),
                }],
        };
        return returnValue;
    });
}
exports.sendFusionTransactionAdvanced = sendFusionTransactionAdvanced;
/**
 * Sends a transaction of amount to the address destination, using the
 * given payment ID, if specified.
 *
 * Network fee is set to default, mixin is set to default, all subwallets
 * are taken from, primary address is used as change address.
 *
 * If you need more control, use [[sendTransactionAdvanced]]
 *
 * @param config
 * @param daemon            A daemon instance we can send the transaction to
 * @param subWallets        The subwallets instance to draw funds from
 * @param destination       The address to send the funds to
 * @param amount            The amount to send, in ATOMIC units
 * @param paymentID         The payment ID to include with this transaction. Optional.
 * @param relayToNetwork
 * @param sendAll
 */
function sendTransactionBasic(config, daemon, subWallets, destination, amount, paymentID, relayToNetwork, sendAll) {
    return __awaiter(this, void 0, void 0, function* () {
        return sendTransactionAdvanced(config, daemon, subWallets, [[destination, amount]], undefined, undefined, paymentID);
    });
}
exports.sendTransactionBasic = sendTransactionBasic;
/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon, subWallets, and addressesAndAmounts.
 * @param config
 * @param daemon                A daemon instance we can send the transaction to
 * @param subWallets            The subwallets instance to draw funds from
 * @param addressesAndAmounts   An array of destinations, and amounts to send to that
 *                              destination.
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param fee                   The network fee, fee per byte, or minimum fee to use
 *                              with this transaction. Defaults to minimum fee.
 * @param paymentID             The payment ID to include with this transaction.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param changeAddress         The address to send any returned change to.
 *
 * @param relayToNetwork        Whether we should submit the transaction to the network or not.
 *                              If set to false, allows you to review the transaction fee before sending it.
 *                              Use [[sendPreparedTransaction]] to send a transaction that you have not
 *                              relayed to the network. Defaults to true.
 *
 * @param sendAll               Whether we should send the entire balance available. Since fee per
 *                              byte means estimating fees is difficult, we can handle that process
 *                              on your behalf. The entire balance minus fees will be sent to the
 *                              first destination address. The amount given in the first destination
 *                              address will be ignored. Any following destinations will have
 *                              the given amount sent. For example, if your destinations array was
 *                              ```
 *                              [['address1', 0], ['address2', 50], ['address3', 100]]
 *                              ```
 *                              Then address2 would be sent 50, address3 would be sent 100,
 *                              and address1 would get whatever remains of the balance
 *                              after paying node/network fees.
 *                              Defaults to false.
 * @param extraData             Extra arbitrary data to include in the transaction
 */
function sendTransactionAdvanced(config, daemon, subWallets, addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, relayToNetwork, sendAll, extraData) {
    return __awaiter(this, void 0, void 0, function* () {
        Logger_1.logger.log('Starting sendTransaction process', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        const returnValue = {
            success: false,
            error: WalletError_1.SUCCESS,
        };
        if (mixin === undefined) {
            mixin = config.mixinLimits.getDefaultMixinByHeight(daemon.getNetworkBlockCount());
            Logger_1.logger.log(`Mixin not given, defaulting to mixin of ${mixin}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        if (fee === undefined) {
            fee = FeeType_1.FeeType.MinimumFee(config);
            Logger_1.logger.log(`Fee not given, defaulting to min fee of ${fee.feePerByte} per byte`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        if (paymentID === undefined) {
            paymentID = '';
        }
        if (subWalletsToTakeFrom === undefined || subWalletsToTakeFrom.length === 0) {
            subWalletsToTakeFrom = subWallets.getAddresses();
            Logger_1.logger.log(`Subwallets to take from not given, defaulting to all subwallets (${subWalletsToTakeFrom})`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        if (changeAddress === undefined || changeAddress === '') {
            changeAddress = subWallets.getPrimaryAddress();
            Logger_1.logger.log(`Change address not given, defaulting to change address of ${changeAddress}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        if (relayToNetwork === undefined) {
            relayToNetwork = true;
            Logger_1.logger.log(`Relay to network not given, defaulting to true`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        if (sendAll === undefined) {
            sendAll = false;
            Logger_1.logger.log(`Send all not given, defaulting to false`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        const [feeAddress, feeAmount] = daemon.nodeFee();
        /* Add the node fee, if it exists */
        if (feeAmount !== 0) {
            addressesAndAmounts.push([feeAddress, feeAmount]);
            Logger_1.logger.log(`Node fee is not zero, adding node fee of ${(0, Utilities_1.prettyPrintAmount)(feeAmount)} with destination of ${feeAddress}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        Logger_1.logger.log('Prevalidating transaction', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        const error = yield validateTransaction(addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, sendAll, daemon.getNetworkBlockCount(), subWallets, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            Logger_1.logger.log(`Failed to validate transaction: ${error.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            returnValue.error = error;
            return returnValue;
        }
        for (let [address] of addressesAndAmounts) {
            const decoded = yield kryptokrona_utils_1.Address.fromAddress(address, config.addressPrefix);
            /* Assign payment ID from integrated address if present */
            if (decoded.paymentId !== '') {
                paymentID = decoded.paymentId;
                /* Turn integrated address into standard address */
                address = yield (yield kryptokrona_utils_1.Address.fromPublicKeys(decoded.spend.publicKey, decoded.view.publicKey, undefined, config.addressPrefix)).address();
                Logger_1.logger.log(`Extracted payment ID of ${paymentID} from address ${decoded.address}, resulting non integrated address: ${address}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            }
        }
        /* Total amount we're sending */
        let totalAmount = _.sumBy(addressesAndAmounts, ([, amount]) => amount);
        const availableInputs = yield subWallets.getSpendableTransactionInputs(subWalletsToTakeFrom, daemon.getNetworkBlockCount());
        let sumOfInputs = 0;
        const ourInputs = [];
        if (fee.isFixedFee) {
            Logger_1.logger.log(`Total amount to send: ${totalAmount}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            totalAmount += fee.fixedFee;
        }
        else {
            Logger_1.logger.log(`Total amount to send (Not including fee per byte): ${totalAmount}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        }
        let changeRequired = 0;
        let requiredAmount = totalAmount;
        let txResult = [undefined, WalletError_1.SUCCESS];
        for (const [i, input] of availableInputs.entries()) {
            ourInputs.push(input);
            sumOfInputs += input.input.amount;
            /* If we're sending all, we want every input, so wait for last iteration */
            if (sendAll && i < availableInputs.length - 1) {
                continue;
            }
            if (sumOfInputs >= totalAmount || sendAll) {
                Logger_1.logger.log(`Selected enough inputs (${ourInputs.length}) with sum of ${sumOfInputs} ` +
                    `to exceed total amount required: ${totalAmount} (not including fee), ` +
                    `attempting to estimate transaction fee`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                /* If sum of inputs is > totalAmount, we need to send some back to
                 * ourselves */
                changeRequired = sumOfInputs - totalAmount;
                /* Split transfers up into amounts and keys */
                let destinations = yield setupDestinations(addressesAndAmounts, changeRequired, changeAddress, config);
                /* Using fee per byte, lets take a guess at how large our fee is
                 * going to be, and then see if we have enough inputs to cover it. */
                if (fee.isFeePerByte) {
                    const transactionSize = (0, Utilities_1.estimateTransactionSize)(mixin, ourInputs.length, destinations.length, paymentID !== '', 0);
                    Logger_1.logger.log(`Estimated transaction size: ${(0, Utilities_1.prettyPrintBytes)(transactionSize)}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                    const estimatedFee = (0, Utilities_1.getTransactionFee)(transactionSize, daemon.getNetworkBlockCount(), fee.feePerByte, config);
                    Logger_1.logger.log(`Estimated required transaction fee using fee per byte of ${fee.feePerByte}: ${estimatedFee}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                    if (sendAll) {
                        /* The amount available to be sent to the 1st destination,
                         * not including fee per byte */
                        let remainingFunds = sumOfInputs;
                        /* Remove amounts for fixed destinations. Skipping first
                         * (send all) target. */
                        for (let j = 1; j < addressesAndAmounts.length; j++) {
                            remainingFunds -= addressesAndAmounts[j][1];
                        }
                        if (estimatedFee > remainingFunds) {
                            Logger_1.logger.log(`Node fee + transaction fee + fixed destinations is greater than available balance`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                            returnValue.fee = estimatedFee;
                            returnValue.error = new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_BALANCE);
                            return returnValue;
                        }
                        totalAmount = remainingFunds - estimatedFee;
                        Logger_1.logger.log(`Sending all, estimated max send minus fees and fixed destinations: ${totalAmount}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                        /* Amount to send is sum of inputs (full balance), minus
                         * node fee, minus estimated fee. */
                        addressesAndAmounts[0][1] = remainingFunds - estimatedFee;
                        changeRequired = 0;
                        destinations = yield setupDestinations(addressesAndAmounts, changeRequired, changeAddress, config);
                    }
                    let estimatedAmount = totalAmount + estimatedFee;
                    /* Re-add total amount going to fixed destinations */
                    if (sendAll) {
                        /* Estimated amount should now equal total balance. */
                        for (let j = 1; j < addressesAndAmounts.length; j++) {
                            estimatedAmount += addressesAndAmounts[j][1];
                        }
                    }
                    Logger_1.logger.log(`Total amount to send (including fee per byte): ${estimatedAmount}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                    /* Ok, we have enough inputs to add our estimated fee, lets
                     * go ahead and try and make the transaction. */
                    if (sumOfInputs >= estimatedAmount) {
                        Logger_1.logger.log(`Selected enough inputs to exceed total amount required, ` +
                            `attempting to estimate transaction fee`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                        const [success, result, change, needed] = yield tryMakeFeePerByteTransaction(sumOfInputs, totalAmount, estimatedFee, fee.feePerByte, addressesAndAmounts, changeAddress, mixin, daemon, ourInputs, paymentID, subWallets, extraData, sendAll, config);
                        if (success) {
                            txResult = result;
                            changeRequired = change;
                            break;
                        }
                        else {
                            requiredAmount = needed;
                        }
                    }
                    else {
                        Logger_1.logger.log(`Did not select enough inputs to exceed total amount required, ` +
                            `selecting more if available.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                        requiredAmount = estimatedAmount;
                    }
                }
                else {
                    Logger_1.logger.log(`Making non fee per byte transaction with fixed fee of ${fee.fixedFee}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                    txResult = yield makeTransaction(mixin, fee.fixedFee, paymentID, ourInputs, destinations, subWallets, daemon, config, extraData);
                    const [tx, err] = txResult;
                    if (err) {
                        Logger_1.logger.log(`Error creating transaction, ${err.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                        break;
                    }
                    const minFee = (0, Utilities_1.getMinimumTransactionFee)(tx.size, daemon.getNetworkBlockCount(), config);
                    Logger_1.logger.log(`Min fee required for generated transaction: ${minFee}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                    if (fee.fixedFee >= minFee) {
                        Logger_1.logger.log(`Fee of generated transaction is greater than min fee, creation succeeded.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                        break;
                    }
                    else {
                        Logger_1.logger.log(`Fee of generated transaction is less than min fee, creation failed.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                        returnValue.error = new WalletError_1.WalletError(WalletError_1.WalletErrorCode.FEE_TOO_SMALL);
                        return returnValue;
                    }
                }
            }
        }
        if (sumOfInputs < requiredAmount) {
            returnValue.fee = requiredAmount - totalAmount;
            returnValue.error = new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_BALANCE);
            Logger_1.logger.log(`Not enough balance to cover transaction, required: ${requiredAmount}, ` +
                `fee: ${returnValue.fee}, available: ${sumOfInputs}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            return returnValue;
        }
        const [createdTX, creationError] = txResult;
        /* Checking for undefined to keep the compiler from complaining later.. */
        if (creationError || createdTX === undefined) {
            Logger_1.logger.log(`Failed to create transaction, ${creationError.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            returnValue.error = creationError;
            return returnValue;
        }
        const actualFee = sumTransactionFee(createdTX);
        Logger_1.logger.log(`Successfully created transaction, proceeding to validating and sending`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        Logger_1.logger.log(`Created transaction: ${JSON.stringify(createdTX.toString())}`, Logger_1.LogLevel.TRACE, Logger_1.LogCategory.TRANSACTIONS);
        const verifyErr = verifyTransaction(createdTX, fee, daemon, config);
        if (!_.isEqual(verifyErr, WalletError_1.SUCCESS)) {
            returnValue.error = verifyErr;
            return returnValue;
        }
        if (relayToNetwork) {
            const [prettyTX, err] = yield relayTransaction(createdTX, actualFee, paymentID, ourInputs, changeAddress, changeRequired, subWallets, daemon, config);
            if (err) {
                Logger_1.logger.log(`Failed to verify and send transaction: ${err.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                returnValue.error = err;
                return returnValue;
            }
            returnValue.prettyTransaction = prettyTX;
        }
        returnValue.success = true;
        returnValue.fee = actualFee;
        returnValue.paymentID = paymentID;
        returnValue.inputs = ourInputs;
        returnValue.changeAddress = changeAddress;
        returnValue.changeRequired = changeRequired;
        returnValue.rawTransaction = createdTX;
        returnValue.transactionHash = yield createdTX.hash();
        returnValue.destinations = {
            nodeFee: feeAmount === 0 ? undefined : {
                address: feeAddress,
                amount: feeAmount,
            },
            change: changeRequired === 0 ? undefined : {
                address: changeAddress,
                amount: changeRequired,
            },
            userDestinations: addressesAndAmounts.map(([address, amount]) => {
                return {
                    address,
                    amount,
                };
            }),
        };
        returnValue.nodeFee = feeAmount;
        return returnValue;
    });
}
exports.sendTransactionAdvanced = sendTransactionAdvanced;
function tryMakeFeePerByteTransaction(sumOfInputs, amountPreFee, estimatedFee, feePerByte, addressesAndAmounts, changeAddress, mixin, daemon, ourInputs, paymentID, subWallets, extraData = '', sendAll, config) {
    return __awaiter(this, void 0, void 0, function* () {
        let attempt = 0;
        while (true) {
            Logger_1.logger.log(`Attempting fee per byte transaction construction, attempt ${attempt}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            const changeRequired = sendAll
                ? 0
                : sumOfInputs - amountPreFee - estimatedFee;
            Logger_1.logger.log(`Change required: ${changeRequired}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            /* Need to recalculate destinations since amount of change, err, changed! */
            const destinations = yield setupDestinations(addressesAndAmounts, changeRequired, changeAddress, config);
            const result = yield makeTransaction(mixin, estimatedFee, paymentID, ourInputs, destinations, subWallets, daemon, config, extraData);
            const [tx, creationError] = result;
            if (creationError) {
                Logger_1.logger.log(`Error creating transaction, ${creationError.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                return [true, result, 0, 0];
            }
            const actualTxSize = tx.size;
            Logger_1.logger.log(`Size of generated transaction: ${(0, Utilities_1.prettyPrintBytes)(actualTxSize)}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            const requiredFee = (0, Utilities_1.getTransactionFee)(actualTxSize, daemon.getNetworkBlockCount(), feePerByte, config);
            Logger_1.logger.log(`Required transaction fee using fee per byte of ${feePerByte}: ${requiredFee}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            /* Great! The fee we estimated is greater than or equal
             * to the min/specified fee per byte for a transaction
             * of this size, so we can continue with sending the
             * transaction. */
            if (estimatedFee >= requiredFee) {
                Logger_1.logger.log(`Estimated fee of ${estimatedFee} is greater ` +
                    `than or equal to required fee of ${requiredFee}, creation succeeded.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                return [true, result, changeRequired, 0];
            }
            Logger_1.logger.log(`Estimated fee of ${estimatedFee} is less` +
                `than required fee of ${requiredFee}.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            /* If we're sending all, then we adjust the amount we're sending,
             * rather than the change we're returning. */
            if (sendAll) {
                /* Update the amount we're sending, by readding the too small fee,
                 * and taking off the requiredFee. I.e., if estimated was 35,
                 * required was 40, then we'd end up sending 5 less to the destination
                 * to cover the new fee required. */
                addressesAndAmounts[0][1] = addressesAndAmounts[0][1] + estimatedFee - requiredFee;
                estimatedFee = requiredFee;
                Logger_1.logger.log(`Sending all, adjusting primary transaction amount down to ${addressesAndAmounts[0][1]}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            }
            /* The actual fee required for a tx of this size is not
             * covered by the amount of inputs we have so far, lets
             * go select some more then try again. */
            if (amountPreFee + requiredFee > sumOfInputs) {
                Logger_1.logger.log(`Do not have enough inputs selected to cover required fee. Returning ` +
                    `to select more inputs if available.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                return [false, result, changeRequired, amountPreFee + requiredFee];
            }
            Logger_1.logger.log(`Updating estimated fee to ${requiredFee} and attempting transaction ` +
                `construction again.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            attempt++;
        }
    });
}
function sendPreparedTransaction(transaction, subWallets, daemon, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const returnValue = Object.assign({ success: false, error: WalletError_1.SUCCESS }, transaction);
        for (const input of transaction.inputs) {
            if (!subWallets.haveSpendableInput(input.input, daemon.getNetworkBlockCount())) {
                Logger_1.logger.log(`Prepared transaction ${transaction.rawTransaction.hash} expired, input ${input.input.key}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
                returnValue.error = new WalletError_1.WalletError(WalletError_1.WalletErrorCode.PREPARED_TRANSACTION_EXPIRED);
                return returnValue;
            }
        }
        const [prettyTX, err] = yield relayTransaction(transaction.rawTransaction, transaction.fee, transaction.paymentID, transaction.inputs, transaction.changeAddress, transaction.changeRequired, subWallets, daemon, config);
        if (err) {
            Logger_1.logger.log(`Failed to verify and send transaction: ${err.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            returnValue.error = err;
            return returnValue;
        }
        returnValue.prettyTransaction = prettyTX;
        returnValue.success = true;
        return returnValue;
    });
}
exports.sendPreparedTransaction = sendPreparedTransaction;
function setupDestinations(addressesAndAmountsTmp, changeRequired, changeAddress, config) {
    return __awaiter(this, void 0, void 0, function* () {
        /* Clone array so we don't manipulate it outside the function */
        const addressesAndAmounts = addressesAndAmountsTmp.slice();
        if (changeRequired !== 0) {
            addressesAndAmounts.push([changeAddress, changeRequired]);
        }
        let amounts = [];
        /* Split amounts into denominations */
        addressesAndAmounts.map(([address, amount]) => {
            for (const denomination of (0, Utilities_1.splitAmountIntoDenominations)(amount)) {
                amounts.push([address, denomination]);
            }
        });
        Logger_1.logger.log(`Split destinations into ${amounts.length} outputs`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        amounts = _.sortBy(amounts, ([, amount]) => amount);
        /* Prepare destinations keys */
        const result = [];
        for (const [address, amount] of amounts) {
            result.push({
                amount: amount,
                destination: yield kryptokrona_utils_1.Address.fromAddress(address, config.addressPrefix)
            });
        }
        return result;
    });
}
function makeTransaction(mixin, fee, paymentID, ourInputs, destinations, subWallets, daemon, config, extraData) {
    return __awaiter(this, void 0, void 0, function* () {
        ourInputs = _.sortBy(ourInputs, (input) => input.input.amount);
        Logger_1.logger.log(`Collecting ring participants`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        const randomOuts = yield getRingParticipants(ourInputs, mixin, daemon, config);
        if (randomOuts instanceof WalletError_1.WalletError) {
            Logger_1.logger.log(`Failed to get ring participants: ${randomOuts.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            return [undefined, randomOuts];
        }
        let numPregenerated = 0;
        let numGeneratedOnDemand = 0;
        const ourOutputs = yield Promise.all(ourInputs.map((input) => __awaiter(this, void 0, void 0, function* () {
            if (!input.input.privateEphemeral || !(0, Utilities_1.isHex64)(input.input.privateEphemeral)) {
                const [, tmpSecretKey] = yield (0, CryptoWrapper_1.generateKeyImage)(input.input.transactionPublicKey, subWallets.getPrivateViewKey(), input.publicSpendKey, input.privateSpendKey, input.input.transactionIndex, config);
                input.input.privateEphemeral = tmpSecretKey;
                numGeneratedOnDemand++;
            }
            else {
                numPregenerated++;
            }
            return {
                amount: input.input.amount,
                globalIndex: input.input.globalOutputIndex,
                index: input.input.transactionIndex,
                input: {
                    privateEphemeral: input.input.privateEphemeral,
                    publicEphemeral: '',
                    transactionKeys: {
                        derivedKey: '',
                        outputIndex: 0,
                        publicKey: '',
                    }, // again required by compiler but not used in func
                },
                key: input.input.key,
                keyImage: input.input.keyImage,
            };
        })));
        Logger_1.logger.log(`Generated key images for ${numGeneratedOnDemand} inputs, used pre-generated key images for ${numPregenerated} inputs.`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        try {
            Logger_1.logger.log(`Asynchronously creating transaction with turtlecoin-utils`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            const tx = yield (0, CnUtils_1.CryptoUtils)(config).createTransaction(destinations, ourOutputs, randomOuts, mixin, fee, paymentID, undefined, extraData);
            Logger_1.logger.log(`Transaction creation succeeded`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            return [tx, undefined];
        }
        catch (err) {
            Logger_1.logger.log(`Error while creating transaction with turtlecoin-utils: ${err.toString()}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.UNKNOWN_ERROR, err.toString())];
        }
    });
}
function verifyTransaction(tx, fee, daemon, config) {
    Logger_1.logger.log('Verifying size of transaction', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
    /* Check the transaction isn't too large to fit in a block */
    const tooBigErr = isTransactionPayloadTooBig(tx.size, daemon.getNetworkBlockCount(), config);
    if (!_.isEqual(tooBigErr, WalletError_1.SUCCESS)) {
        return tooBigErr;
    }
    Logger_1.logger.log('Verifying amounts of transaction', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
    /* Check all the output amounts are members of 'PRETTY_AMOUNTS', otherwise
       they will not be mixable */
    if (!verifyAmounts(tx.outputs)) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.AMOUNTS_NOT_PRETTY);
    }
    Logger_1.logger.log('Verifying transaction fee', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
    /* Check the transaction has the fee that we expect (0 for fusion) */
    if (!verifyTransactionFee(tx.size, fee, sumTransactionFee(tx))) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.UNEXPECTED_FEE);
    }
    return WalletError_1.SUCCESS;
}
function relayTransaction(tx, fee, paymentID, inputs, changeAddress, changeRequired, subWallets, daemon, config) {
    return __awaiter(this, void 0, void 0, function* () {
        let relaySuccess;
        let errorMessage;
        Logger_1.logger.log('Relaying transaction', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        try {
            [relaySuccess, errorMessage] = yield daemon.sendTransaction(tx.toString());
            /* Timeout */
        }
        catch (err) {
            Logger_1.logger.log(`Caught exception relaying transaction, error: ${err.toString()}, return code: ${err.statusCode}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            if (err.statusCode === 504) {
                return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_STILL_PROCESSING)];
            }
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_OFFLINE)];
        }
        if (!relaySuccess) {
            const customMessage = errorMessage === undefined
                ? ''
                : `The daemon did not accept our transaction. Error: ${errorMessage}.`;
            Logger_1.logger.log(`Failed to relay transaction. ${customMessage}`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_ERROR, customMessage)];
        }
        Logger_1.logger.log('Storing sent transaction', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        /* Store the unconfirmed transaction, update our balance */
        const returnTX = yield storeSentTransaction(yield tx.hash(), tx.outputs, tx.transactionKeys.publicKey, fee, paymentID, inputs, subWallets, config);
        Logger_1.logger.log('Marking sent inputs as locked', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        subWallets.knownTransactions.push(yield tx.hash());
        /* Lock the input for spending till confirmed/cancelled */
        for (const input of inputs) {
            subWallets.markInputAsLocked(input.publicSpendKey, input.input.keyImage, yield tx.hash());
        }
        Logger_1.logger.log('Transaction process complete.', Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        return [returnTX, undefined];
    });
}
function storeSentTransaction(hash, keyOutputs, txPublicKey, fee, paymentID, ourInputs, subWallets, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const transfers = new Map();
        const derivation = yield (0, CryptoWrapper_1.generateKeyDerivation)(txPublicKey, subWallets.getPrivateViewKey(), config);
        const spendKeys = subWallets.getPublicSpendKeys();
        for (const [outputIndex, output] of keyOutputs.entries()) {
            if (output.type === kryptokrona_utils_1.TransactionOutputs.OutputType.KEY) {
                const o = output;
                /* Derive the spend key from the transaction, using the previous
                   derivation */
                const derivedSpendKey = yield (0, CryptoWrapper_1.underivePublicKey)(derivation, outputIndex, o.key, config);
                /* See if the derived spend key matches any of our spend keys */
                if (!_.includes(spendKeys, derivedSpendKey)) {
                    continue;
                }
                const input = new Types_1.UnconfirmedInput(o.amount.toJSNumber(), o.key, hash, false);
                subWallets.storeUnconfirmedIncomingInput(input, derivedSpendKey);
                transfers.set(derivedSpendKey, o.amount.add(transfers.get(derivedSpendKey) || 0).toJSNumber());
            }
        }
        for (const input of ourInputs) {
            /* Amounts we have spent, subtract them from the transfers map */
            transfers.set(input.publicSpendKey, -input.input.amount + (transfers.get(input.publicSpendKey) || 0));
        }
        const timestamp = 0;
        const blockHeight = 0;
        const unlockTime = 0;
        const isCoinbaseTransaction = false;
        const tx = new Types_1.Transaction(transfers, hash, fee, timestamp, blockHeight, paymentID, unlockTime, isCoinbaseTransaction);
        subWallets.addUnconfirmedTransaction(tx);
        Logger_1.logger.log(`Stored unconfirmed transaction: ${JSON.stringify(tx)}`, Logger_1.LogLevel.TRACE, Logger_1.LogCategory.TRANSACTIONS);
        return tx;
    });
}
/**
 * Verify the transaction is small enough to fit in a block
 */
function isTransactionPayloadTooBig(txSize, currentHeight, config) {
    const maxTxSize = (0, Utilities_1.getMaxTxSize)(currentHeight, config.blockTargetTime);
    if (txSize > maxTxSize) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.TOO_MANY_INPUTS_TO_FIT_IN_BLOCK, `Transaction is too large: (${(0, Utilities_1.prettyPrintBytes)(txSize)}). Max ` +
            `allowed size is ${(0, Utilities_1.prettyPrintBytes)(maxTxSize)}. Decrease the ` +
            `amount you are sending, or perform some fusion transactions.`);
    }
    return WalletError_1.SUCCESS;
}
/**
 * Verify all the output amounts are members of PRETTY_AMOUNTS, otherwise they
 * will not be mixable
 */
function verifyAmounts(amounts) {
    for (const output of amounts) {
        if (output.type === kryptokrona_utils_1.TransactionOutputs.OutputType.KEY) {
            if (!Constants_1.PRETTY_AMOUNTS.includes(output.amount.toJSNumber())) {
                return false;
            }
        }
    }
    return true;
}
function sumTransactionFee(transaction) {
    const inputTotal = transaction.amount;
    let outputTotal = 0;
    for (const output of transaction.outputs) {
        if (output.type === kryptokrona_utils_1.TransactionOutputs.OutputType.KEY) {
            outputTotal += output.amount.toJSNumber();
        }
    }
    return inputTotal - outputTotal;
}
/**
 * Verify the transaction fee is the same as the requested transaction fee
 */
function verifyTransactionFee(transactionSize, expectedFee, actualFee) {
    if (expectedFee.isFixedFee) {
        return expectedFee.fixedFee === actualFee;
    }
    else {
        const calculatedFee = expectedFee.feePerByte * transactionSize;
        /* Ensure fee is greater or equal to the fee per byte specified,
         * and no more than two times the fee per byte specified. */
        return actualFee >= calculatedFee && actualFee <= calculatedFee * 2;
    }
}
/**
 * Get sufficient random outputs for the transaction. Returns an error if
 * can't get outputs or can't get enough outputs.
 */
function getRingParticipants(inputs, mixin, daemon, config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (mixin === 0) {
            Logger_1.logger.log(`Mixin = 0, no ring participants needed`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            return [];
        }
        /* Request one more than needed, this way if we get our own output as
           one of the mixin outs, we can skip it and still form the transaction */
        const requestedOuts = mixin + 1;
        const amounts = inputs.map((input) => input.input.amount);
        const outs = yield daemon.getRandomOutputsByAmount(amounts, requestedOuts);
        if (outs.length === 0) {
            Logger_1.logger.log(`Failed to get any random outputs from the daemon`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_OFFLINE);
        }
        for (const amount of amounts) {
            /* Check each amount is present in outputs */
            const foundOutputs = _.find(outs, ([outAmount, ignore]) => amount === outAmount);
            if (foundOutputs === undefined) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS, `Failed to get any matching outputs for amount ${amount} ` +
                    `(${(0, Utilities_1.prettyPrintAmount)(amount, config)}). Further explanation here: ` +
                    `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`);
            }
            const [, outputs] = foundOutputs;
            if (outputs.length < mixin) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS, `Failed to get enough matching outputs for amount ${amount} ` +
                    `(${(0, Utilities_1.prettyPrintAmount)(amount, config)}). Needed outputs: ${mixin} ` +
                    `, found outputs: ${outputs.length}. Further explanation here: ` +
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
                    `(${(0, Utilities_1.prettyPrintAmount)(amount, config)}). Needed outputs: ${mixin} ` +
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
        Logger_1.logger.log(`Finished gathering ring participants`, Logger_1.LogLevel.DEBUG, Logger_1.LogCategory.TRANSACTIONS);
        return randomOuts;
    });
}
/**
 * Validate the given transaction parameters are valid.
 *
 * @return Returns either SUCCESS or an error representing the issue
 */
function validateTransaction(destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, sendAll, currentHeight, subWallets, config) {
    return __awaiter(this, void 0, void 0, function* () {
        /* Validate the destinations are valid */
        let error = yield (0, ValidateParameters_1.validateDestinations)(destinations, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        /* Validate stored payment ID's in integrated addresses don't conflict */
        error = yield (0, ValidateParameters_1.validateIntegratedAddresses)(destinations, paymentID, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        /* Verify the subwallets to take from exist */
        error = yield (0, ValidateParameters_1.validateOurAddresses)(subWalletsToTakeFrom, subWallets, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        /* Verify we have enough money for the transaction */
        error = yield (0, ValidateParameters_1.validateAmount)(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        /* Validate mixin is within the bounds for the current height */
        error = (0, ValidateParameters_1.validateMixin)(mixin, currentHeight, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        error = (0, ValidateParameters_1.validatePaymentID)(paymentID);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        error = yield (0, ValidateParameters_1.validateOurAddresses)([changeAddress], subWallets, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        return WalletError_1.SUCCESS;
    });
}
/**
 * Validate the given transaction parameters are valid.
 *
 * @return Returns either SUCCESS or an error representing the issue
 */
function validateFusionTransaction(mixin, subWalletsToTakeFrom, destination, currentHeight, subWallets, config) {
    return __awaiter(this, void 0, void 0, function* () {
        /* Validate mixin is within the bounds for the current height */
        let error = (0, ValidateParameters_1.validateMixin)(mixin, currentHeight, config);
        if (_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        /* Verify the subwallets to take from exist */
        error = yield (0, ValidateParameters_1.validateOurAddresses)(subWalletsToTakeFrom, subWallets, config);
        if (_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        /* Verify the destination address is valid and exists in the subwallets */
        error = yield (0, ValidateParameters_1.validateOurAddresses)([destination], subWallets, config);
        if (_.isEqual(error, WalletError_1.SUCCESS)) {
            return error;
        }
        return WalletError_1.SUCCESS;
    });
}
