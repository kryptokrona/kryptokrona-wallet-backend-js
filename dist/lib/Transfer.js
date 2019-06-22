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
const _ = require("lodash");
const CnUtils_1 = require("./CnUtils");
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
 * @param daemon                A daemon instance we can send the transaction to
 * @param subWallets            The subwallets instance to draw funds from
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param destination           The destination for the fusion transactions to be sent to.
 *                              Must be a subwallet in this container.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
function sendFusionTransactionAdvanced(config, daemon, subWallets, mixin, subWalletsToTakeFrom, destination) {
    return __awaiter(this, void 0, void 0, function* () {
        if (mixin === undefined) {
            mixin = config.mixinLimits.getDefaultMixinByHeight(daemon.getNetworkBlockCount());
        }
        /* Take from all subaddresses if none given */
        if (subWalletsToTakeFrom === undefined || subWalletsToTakeFrom.length === 0) {
            subWalletsToTakeFrom = subWallets.getAddresses();
        }
        /* Use primary address as change address if not given */
        if (destination === undefined || destination === '') {
            destination = subWallets.getPrimaryAddress();
        }
        /* Verify it's all valid */
        const error = validateFusionTransaction(mixin, subWalletsToTakeFrom, destination, daemon.getNetworkBlockCount(), subWallets, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return [undefined, undefined, error];
        }
        /* Get the random inputs for this tx */
        const [ourInputs, foundMoney] = subWallets.getFusionTransactionInputs(subWalletsToTakeFrom, mixin, daemon.getNetworkBlockCount());
        /* Payment ID's are not needed with fusion transactions */
        const paymentID = '';
        /* Fusion transactions are free */
        const fee = 0;
        let fusionTX;
        while (true) {
            /* Not enough unspent inputs for a fusion TX, we're fully optimized */
            if (ourInputs.length < Constants_1.FUSION_TX_MIN_INPUT_COUNT) {
                return [undefined, undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.FULLY_OPTIMIZED)];
            }
            /* Amount of the transaction */
            const amount = _.sumBy(ourInputs, (input) => input.input.amount);
            /* Number of outputs this transaction will create */
            const numOutputs = Utilities_1.splitAmountIntoDenominations(amount).length;
            /* Need to have at least 4x more inputs than outputs */
            if (numOutputs === 0
                || (ourInputs.length / numOutputs) < Constants_1.FUSION_TX_MIN_IN_OUT_COUNT_RATIO) {
                /* Remove last input */
                ourInputs.pop();
                /* And try again */
                continue;
            }
            const addressesAndAmounts = [[destination, amount]];
            const [tx, creationError] = yield makeTransaction(mixin, fee, paymentID, ourInputs, addressesAndAmounts, subWallets, daemon, config);
            if (creationError || tx === undefined) {
                return [undefined, undefined, creationError];
            }
            /* Divided by two because it's represented as hex */
            if (tx.rawTransaction.length / 2 > Constants_1.MAX_FUSION_TX_SIZE) {
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
        return verifyAndSendTransaction(fusionTX, fee, paymentID, ourInputs, destination, 0, subWallets, daemon, config);
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
 * If you need more control, use `sendTransactionAdvanced()`
 *
 * @param daemon        A daemon instance we can send the transaction to
 * @param subWallets    The subwallets instance to draw funds from
 * @param destination   The address to send the funds to
 * @param amount        The amount to send, in ATOMIC units
 * @param paymentID     The payment ID to include with this transaction. Optional.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
function sendTransactionBasic(config, daemon, subWallets, destination, amount, paymentID) {
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
 * @param daemon                A daemon instance we can send the transaction to
 * @param subWallets            The subwallets instance to draw funds from
 * @param addressesAndAmounts   An array of destinations, and amounts to send to that
 *                              destination.
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param fee                   The network fee to use with this transaction. In ATOMIC units.
 * @param paymentID             The payment ID to include with this transaction.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param changeAddress         The address to send any returned change to.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
function sendTransactionAdvanced(config, daemon, subWallets, addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        if (mixin === undefined) {
            mixin = config.mixinLimits.getDefaultMixinByHeight(daemon.getNetworkBlockCount());
        }
        if (fee === undefined) {
            fee = config.minimumFee;
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
        const error = validateTransaction(addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, daemon.getNetworkBlockCount(), subWallets, config);
        if (!_.isEqual(error, WalletError_1.SUCCESS)) {
            return [undefined, undefined, error];
        }
        /* Total amount we're sending */
        const totalAmount = _.sumBy(addressesAndAmounts, ([address, amount]) => amount) + fee;
        const [inputs, foundMoney] = subWallets.getTransactionInputsForAmount(totalAmount, subWalletsToTakeFrom, daemon.getNetworkBlockCount());
        /* Amount to send back to ourself */
        const changeRequired = foundMoney - totalAmount;
        if (changeRequired > 0) {
            addressesAndAmounts.push([changeAddress, changeRequired]);
        }
        const [tx, creationError] = yield makeTransaction(mixin, fee, paymentID, inputs, addressesAndAmounts, subWallets, daemon, config);
        /* Checking for undefined to keep the compiler from complaining later.. */
        if (creationError || tx === undefined) {
            return [undefined, undefined, creationError];
        }
        /* Perform some final checks, and send the transaction */
        return verifyAndSendTransaction(tx, fee, paymentID, inputs, changeAddress, changeRequired, subWallets, daemon, config);
    });
}
exports.sendTransactionAdvanced = sendTransactionAdvanced;
function makeTransaction(mixin, fee, paymentID, ourInputs, addressesAndAmounts, subWallets, daemon, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const amounts = [];
        /* Split amounts into denominations */
        addressesAndAmounts.map(([address, amount]) => {
            for (const denomination of Utilities_1.splitAmountIntoDenominations(amount)) {
                amounts.push([address, denomination]);
            }
        });
        /* Prepare destinations keys */
        const transfers = amounts.map(([address, amount]) => {
            const decoded = CnUtils_1.CryptoUtils(config).decodeAddress(address);
            /* Assign payment ID from integrated address if present */
            if (decoded.paymentId !== '') {
                paymentID = decoded.paymentId;
            }
            return {
                amount: amount,
                keys: decoded,
            };
        });
        const randomOuts = yield getRingParticipants(ourInputs, mixin, daemon, config);
        if (randomOuts instanceof WalletError_1.WalletError) {
            return [undefined, randomOuts];
        }
        const ourOutputs = yield Promise.all(ourInputs.map((input) => __awaiter(this, void 0, void 0, function* () {
            const [keyImage, tmpSecretKey] = yield CryptoWrapper_1.generateKeyImage(input.input.transactionPublicKey, subWallets.getPrivateViewKey(), input.publicSpendKey, input.privateSpendKey, input.input.transactionIndex, config);
            return {
                amount: input.input.amount,
                globalIndex: input.input.globalOutputIndex,
                index: input.input.transactionIndex,
                input: {
                    privateEphemeral: tmpSecretKey,
                },
                key: input.input.key,
                keyImage: keyImage,
            };
        })));
        try {
            const tx = yield CnUtils_1.CryptoUtils(config).createTransactionAsync(transfers, ourOutputs, randomOuts, mixin, fee, paymentID);
            return [tx, undefined];
        }
        catch (err) {
            return [undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.UNKNOWN_ERROR, err.toString())];
        }
    });
}
function verifyAndSendTransaction(tx, fee, paymentID, inputs, changeAddress, changeRequired, subWallets, daemon, config) {
    return __awaiter(this, void 0, void 0, function* () {
        /* Check the transaction isn't too large to fit in a block */
        const tooBigErr = isTransactionPayloadTooBig(tx.rawTransaction, daemon.getNetworkBlockCount(), config);
        if (!_.isEqual(tooBigErr, WalletError_1.SUCCESS)) {
            return [undefined, undefined, tooBigErr];
        }
        /* Check all the output amounts are members of 'PRETTY_AMOUNTS', otherwise
           they will not be mixable */
        if (!verifyAmounts(tx.transaction.vout)) {
            return [undefined, undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.AMOUNTS_NOT_PRETTY)];
        }
        /* Check the transaction is zero fee */
        if (!verifyTransactionFee(tx.transaction, fee)) {
            return [undefined, undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.UNEXPECTED_FEE)];
        }
        let relaySuccess;
        try {
            relaySuccess = yield daemon.sendTransaction(tx.rawTransaction);
            /* Timeout */
        }
        catch (err) {
            return [undefined, undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_OFFLINE)];
        }
        if (!relaySuccess) {
            return [undefined, undefined, new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_ERROR)];
        }
        /* Store the unconfirmed transaction, update our balance */
        const returnTX = storeSentTransaction(tx.hash, fee, paymentID, inputs, changeAddress, changeRequired, subWallets, config);
        /* Update our locked balanced with the incoming funds */
        yield storeUnconfirmedIncomingInputs(subWallets, tx.transaction.vout, tx.transaction.transactionKeys.publicKey, tx.hash, config);
        subWallets.storeTxPrivateKey(tx.transaction.transactionKeys.privateKey, tx.hash);
        /* Lock the input for spending till confirmed/cancelled */
        for (const input of inputs) {
            subWallets.markInputAsLocked(input.publicSpendKey, input.input.keyImage);
        }
        return [returnTX, tx.hash, undefined];
    });
}
function storeSentTransaction(hash, fee, paymentID, ourInputs, changeAddress, changeRequired, subWallets, config) {
    const transfers = new Map();
    for (const input of ourInputs) {
        /* Amounts we have spent, subtract them from the transfers map */
        transfers.set(input.publicSpendKey, -input.input.amount + (transfers.get(input.publicSpendKey) || 0));
    }
    if (changeRequired !== 0) {
        const [publicViewKey, publicSpendKey] = Utilities_1.addressToKeys(changeAddress, config);
        transfers.set(publicSpendKey, changeRequired + (transfers.get(publicSpendKey) || 0));
    }
    const timestamp = 0;
    const blockHeight = 0;
    const unlockTime = 0;
    const isCoinbaseTransaction = false;
    const tx = new Types_1.Transaction(transfers, hash, fee, timestamp, blockHeight, paymentID, unlockTime, isCoinbaseTransaction);
    subWallets.addUnconfirmedTransaction(tx);
    return tx;
}
function storeUnconfirmedIncomingInputs(subWallets, keyOutputs, txPublicKey, txHash, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const derivation = yield CryptoWrapper_1.generateKeyDerivation(txPublicKey, subWallets.getPrivateViewKey(), config);
        const spendKeys = subWallets.getPublicSpendKeys();
        for (const [outputIndex, output] of keyOutputs.entries()) {
            /* Derive the spend key from the transaction, using the previous
               derivation */
            const derivedSpendKey = yield CryptoWrapper_1.underivePublicKey(derivation, outputIndex, output.target.data, config);
            /* See if the derived spend key matches any of our spend keys */
            if (!_.includes(spendKeys, derivedSpendKey)) {
                continue;
            }
            const input = new Types_1.UnconfirmedInput(output.amount, output.target.data, txHash);
            subWallets.storeUnconfirmedIncomingInput(input, derivedSpendKey);
        }
    });
}
/**
 * Verify the transaction is small enough to fit in a block
 */
function isTransactionPayloadTooBig(rawTransaction, currentHeight, config) {
    /* Divided by two because it's represented as hex */
    const txSize = rawTransaction.length / 2;
    const maxTxSize = Utilities_1.getMaxTxSize(currentHeight, config.blockTargetTime);
    if (txSize > maxTxSize) {
        return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.TOO_MANY_INPUTS_TO_FIT_IN_BLOCK, `Transaction is too large: (${Utilities_1.prettyPrintBytes(txSize)}). Max ` +
            `allowed size is ${Utilities_1.prettyPrintBytes(maxTxSize)}. Decrease the ` +
            `amount you are sending, or perform some fusion transactions.`);
    }
    return WalletError_1.SUCCESS;
}
/**
 * Verify all the output amounts are members of PRETTY_AMOUNTS, otherwise they
 * will not be mixable
 */
function verifyAmounts(amounts) {
    for (const vout of amounts) {
        if (!Constants_1.PRETTY_AMOUNTS.includes(vout.amount)) {
            return false;
        }
    }
    return true;
}
/**
 * Verify the transaction fee is the same as the requested transaction fee
 */
function verifyTransactionFee(transaction, expectedFee) {
    let inputTotal = 0;
    let outputTotal = 0;
    for (const input of transaction.vin) {
        inputTotal += input.amount;
    }
    for (const output of transaction.vout) {
        outputTotal += output.amount;
    }
    const actualFee = inputTotal - outputTotal;
    return actualFee === expectedFee;
}
/**
 * Get sufficient random outputs for the transaction. Returns an error if
 * can't get outputs or can't get enough outputs.
 */
function getRingParticipants(inputs, mixin, daemon, config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (mixin === 0) {
            return [];
        }
        /* Request one more than needed, this way if we get our own output as
           one of the mixin outs, we can skip it and still form the transaction */
        const requestedOuts = mixin + 1;
        const amounts = inputs.map((input) => input.input.amount);
        const outs = yield daemon.getRandomOutputsByAmount(amounts, requestedOuts);
        if (outs.length === 0) {
            return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.DAEMON_OFFLINE);
        }
        for (const amount of amounts) {
            /* Check each amount is present in outputs */
            const foundOutputs = _.find(outs, ([outAmount, ignore]) => amount === outAmount);
            if (foundOutputs === undefined) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS, `Failed to get any matching outputs for amount ${amount} ` +
                    `(${Utilities_1.prettyPrintAmount(amount, config)}). Further explanation here: ` +
                    `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`);
            }
            const [, outputs] = foundOutputs;
            if (outputs.length < mixin) {
                return new WalletError_1.WalletError(WalletError_1.WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS, `Failed to get enough matching outputs for amount ${amount} ` +
                    `(${Utilities_1.prettyPrintAmount(amount, config)}). Needed outputs: ${mixin} ` +
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
                    `(${Utilities_1.prettyPrintAmount(amount, config)}). Needed outputs: ${mixin} ` +
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
function validateTransaction(destinations, mixin, fee, paymentID, subWalletsToTakeFrom, changeAddress, currentHeight, subWallets, config) {
    /* Validate the destinations are valid */
    let error = ValidateParameters_1.validateDestinations(destinations, config);
    if (!_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Validate stored payment ID's in integrated addresses don't conflict */
    error = ValidateParameters_1.validateIntegratedAddresses(destinations, paymentID, config);
    if (!_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Verify the subwallets to take from exist */
    error = ValidateParameters_1.validateOurAddresses(subWalletsToTakeFrom, subWallets, config);
    if (!_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Verify we have enough money for the transaction */
    error = ValidateParameters_1.validateAmount(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight, config);
    if (!_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Validate mixin is within the bounds for the current height */
    error = ValidateParameters_1.validateMixin(mixin, currentHeight, config);
    if (!_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    error = ValidateParameters_1.validatePaymentID(paymentID);
    if (!_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    error = ValidateParameters_1.validateOurAddresses([changeAddress], subWallets, config);
    if (!_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    return WalletError_1.SUCCESS;
}
/**
 * Validate the given transaction parameters are valid.
 *
 * @return Returns either SUCCESS or an error representing the issue
 */
function validateFusionTransaction(mixin, subWalletsToTakeFrom, destination, currentHeight, subWallets, config) {
    /* Validate mixin is within the bounds for the current height */
    let error = ValidateParameters_1.validateMixin(mixin, currentHeight, config);
    if (_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Verify the subwallets to take from exist */
    error = ValidateParameters_1.validateOurAddresses(subWalletsToTakeFrom, subWallets, config);
    if (_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    /* Verify the destination address is valid and exists in the subwallets */
    error = ValidateParameters_1.validateOurAddresses([destination], subWallets, config);
    if (_.isEqual(error, WalletError_1.SUCCESS)) {
        return error;
    }
    return WalletError_1.SUCCESS;
}
