// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

import {
    CreatedTransaction, DecodedAddress, Output, RandomOutput, Transaction,
    TxDestination, Vout, Wallet,
} from 'turtlecoin-utils';

import { Config } from './Config';
import { FeeType } from './FeeType';
import { IDaemon } from './IDaemon';
import { CryptoUtils} from './CnUtils';
import { SubWallets } from './SubWallets';

import { LogCategory, logger, LogLevel } from './Logger';

import {
    Transaction as TX, TxInputAndOwner, UnconfirmedInput, PreparedTransactionInfo,
    PreparedTransaction, Destination,
} from './Types';

import {
    generateKeyImage, generateKeyDerivation, underivePublicKey,
} from './CryptoWrapper';

import {
    addressToKeys, getMaxTxSize, prettyPrintAmount, prettyPrintBytes,
    splitAmountIntoDenominations, isHex64, estimateTransactionSize,
    getMinimumTransactionFee, getTransactionFee,
} from './Utilities';

import {
    validateAddresses, validateAmount, validateDestinations,
    validateIntegratedAddresses, validateMixin, validateOurAddresses,
    validatePaymentID,
} from './ValidateParameters';

import {
    PRETTY_AMOUNTS, FUSION_TX_MIN_INPUT_COUNT,
    FUSION_TX_MIN_IN_OUT_COUNT_RATIO, MAX_FUSION_TX_SIZE,
} from './Constants';

import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';

/**
 * Sends a fusion transaction.
 * If you need more control, use `sendFusionTransactionAdvanced`
 * Note that if your wallet is fully optimized, this will be indicated in the
 * returned error code.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
export async function sendFusionTransactionBasic(
    config: Config,
    daemon: IDaemon,
    subWallets: SubWallets): Promise<PreparedTransactionInfo> {

    return sendFusionTransactionAdvanced(
        config,
        daemon,
        subWallets,
    );
}

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
export async function sendFusionTransactionAdvanced(
    config: Config,
    daemon: IDaemon,
    subWallets: SubWallets,
    mixin?: number,
    subWalletsToTakeFrom?: string[],
    destination?: string): Promise<PreparedTransactionInfo> {

    logger.log(
        'Starting sendFusionTransaction process',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    const returnValue: PreparedTransactionInfo = {
        success: false,
        error: SUCCESS,
    };

    if (mixin === undefined) {
        mixin = config.mixinLimits.getDefaultMixinByHeight(
            daemon.getNetworkBlockCount(),
        );

        logger.log(
            `Mixin not given, defaulting to mixin of ${mixin}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    /* Take from all subaddresses if none given */
    if (subWalletsToTakeFrom === undefined || subWalletsToTakeFrom.length === 0) {
        subWalletsToTakeFrom = subWallets.getAddresses();

        logger.log(
            `Subwallets to take from not given, defaulting to all subwallets (${subWalletsToTakeFrom})`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    /* Use primary address as change address if not given */
    if (destination === undefined || destination === '') {
        destination = subWallets.getPrimaryAddress();

        logger.log(
            `Destination address not given, defaulting to destination address of ${destination}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    logger.log(
        'Prevalidating fusion transaction',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    /* Verify it's all valid */
    const error: WalletError = validateFusionTransaction(
        mixin, subWalletsToTakeFrom, destination,
        daemon.getNetworkBlockCount(), subWallets, config,
    );

    if (!_.isEqual(error, SUCCESS)) {
        logger.log(
            `Failed to validate fusion transaction: ${error.toString()}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        returnValue.error = error;
        return returnValue;
    }

    /* Get the random inputs for this tx */
    const [ourInputs, foundMoney] = subWallets.getFusionTransactionInputs(
        subWalletsToTakeFrom, mixin, daemon.getNetworkBlockCount(),
    );

    logger.log(
        `Selected ${ourInputs.length} inputs for fusion transaction, for total amount of ${prettyPrintAmount(foundMoney)}`,
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    /* Payment ID's are not needed with fusion transactions */
    const paymentID: string = '';

    /* Fusion transactions are free */
    const fee: number = 0;

    let fusionTX: CreatedTransaction;

    while (true) {
        logger.log(
            `Verifying fusion transaction is reasonable size`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        /* Not enough unspent inputs for a fusion TX, we're fully optimized */
        if (ourInputs.length < FUSION_TX_MIN_INPUT_COUNT) {
            logger.log(
                'Wallet is fully optimized, cancelling fusion transaction',
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

            returnValue.error = new WalletError(WalletErrorCode.FULLY_OPTIMIZED);
            return returnValue;
        }

        /* Amount of the transaction */
        const amount = _.sumBy(ourInputs, (input) => input.input.amount);

        /* Number of outputs this transaction will create */
        const numOutputs = splitAmountIntoDenominations(amount).length;

        logger.log(
            `Sum of tmp transaction: ${prettyPrintAmount(amount)}, num outputs: ${numOutputs}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        /* Need to have at least 4x more inputs than outputs */
        if (numOutputs === 0
        || (ourInputs.length / numOutputs) < FUSION_TX_MIN_IN_OUT_COUNT_RATIO) {
            logger.log(
                `Too many outputs, decreasing number of inputs`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

            /* Remove last input */
            ourInputs.pop();

            /* And try again */
            continue;
        }

        const addressesAndAmounts: Array<[string, number]> = [[destination, amount]];

        const destinations = setupDestinations(
            addressesAndAmounts,
            0,
            destination,
            config,
        );

        const [tx, creationError] = await makeTransaction(
            mixin,
            fee,
            paymentID,
            ourInputs,
            destinations,
            subWallets,
            daemon,
            config,
        );

        if (creationError || tx === undefined) {
            logger.log(
                `Failed to create fusion transaction, ${(creationError as WalletError).toString()}`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

            returnValue.error = creationError as WalletError;
            return returnValue;
        }

        /* Divided by two because it's represented as hex */
        if (tx.rawTransaction.length / 2 > MAX_FUSION_TX_SIZE) {
            logger.log(
                `Fusion tx is too large, decreasing number of inputs`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

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

    logger.log(
        `Successfully created fusion transaction, proceeding to validating and sending`,
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    const verifyErr: WalletError = verifyTransaction(
        fusionTX,
        FeeType.FixedFee(0),
        daemon,
        config,
    );

    if (!_.isEqual(verifyErr, SUCCESS)) {
        returnValue.error = verifyErr;
        return returnValue;
    }

    const result = await relayTransaction(
        fusionTX,
        fee,
        paymentID,
        ourInputs,
        destination,
        0,
        subWallets,
        daemon,
        config,
    );

    const [prettyTransaction, err] = result;

    if (err) {
        logger.log(
            `Failed to verify and send transaction: ${(err as WalletError).toString()}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

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
    returnValue.transactionHash = fusionTX.hash;
    returnValue.prettyTransaction = prettyTransaction;
    returnValue.destinations = {
        nodeFee: undefined, /* technically this line is not needed, will def to undef */
        change: undefined,
        userDestinations: [{
            address: destination,
            amount: _.sumBy(ourInputs, (input) => input.input.amount),
        }],
    };

    return returnValue;
}

/**
 * Sends a transaction of amount to the address destination, using the
 * given payment ID, if specified.
 *
 * Network fee is set to default, mixin is set to default, all subwallets
 * are taken from, primary address is used as change address.
 *
 * If you need more control, use [[sendTransactionAdvanced]]
 *
 * @param daemon            A daemon instance we can send the transaction to
 * @param subWallets        The subwallets instance to draw funds from
 * @param destination       The address to send the funds to
 * @param amount            The amount to send, in ATOMIC units
 * @param paymentID         The payment ID to include with this transaction. Optional.
 */
export async function sendTransactionBasic(
    config: Config,
    daemon: IDaemon,
    subWallets: SubWallets,
    destination: string,
    amount: number,
    paymentID?: string,
    relayToNetwork?: boolean,
    sendAll?: boolean): Promise<PreparedTransactionInfo> {

    return sendTransactionAdvanced(
        config,
        daemon,
        subWallets,
        [[destination, amount]],
        undefined,
        undefined,
        paymentID,
    );
}

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
 */
export async function sendTransactionAdvanced(
    config: Config,
    daemon: IDaemon,
    subWallets: SubWallets,
    addressesAndAmounts: Array<[string, number]>,
    mixin?: number,
    fee?: FeeType,
    paymentID?: string,
    subWalletsToTakeFrom?: string[],
    changeAddress?: string,
    relayToNetwork?: boolean,
    sendAll?: boolean): Promise<PreparedTransactionInfo> {

    logger.log(
        'Starting sendTransaction process',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    const returnValue: PreparedTransactionInfo = {
        success: false,
        error: SUCCESS,
    };

    if (mixin === undefined) {
        mixin = config.mixinLimits.getDefaultMixinByHeight(
            daemon.getNetworkBlockCount(),
        );

        logger.log(
            `Mixin not given, defaulting to mixin of ${mixin}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    if (fee === undefined) {
        fee = FeeType.MinimumFee(config);

        logger.log(
            `Fee not given, defaulting to min fee of ${fee.feePerByte} per byte`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    if (paymentID === undefined) {
        paymentID = '';
    }

    if (subWalletsToTakeFrom === undefined || subWalletsToTakeFrom.length === 0) {
        subWalletsToTakeFrom = subWallets.getAddresses();

        logger.log(
            `Subwallets to take from not given, defaulting to all subwallets (${subWalletsToTakeFrom})`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    if (changeAddress === undefined || changeAddress === '') {
        changeAddress = subWallets.getPrimaryAddress();

        logger.log(
            `Change address not given, defaulting to change address of ${changeAddress}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    if (relayToNetwork === undefined) {
        relayToNetwork = true;

        logger.log(
            `Relay to network not given, defaulting to true`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    if (sendAll === undefined) {
        sendAll = false;

        logger.log(
            `Send all not given, defaulting to false`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    const [feeAddress, feeAmount] = daemon.nodeFee();

    /* Add the node fee, if it exists */
    if (feeAmount !== 0) {
        addressesAndAmounts.push([feeAddress, feeAmount]);

        logger.log(
            `Node fee is not zero, adding node fee of ${
                prettyPrintAmount(feeAmount)
            } with destination of ${feeAddress}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    logger.log(
        'Prevalidating transaction',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    const error: WalletError = validateTransaction(
        addressesAndAmounts,
        mixin,
        fee,
        paymentID,
        subWalletsToTakeFrom,
        changeAddress,
        sendAll,
        daemon.getNetworkBlockCount(),
        subWallets,
        config,
    );

    if (!_.isEqual(error, SUCCESS)) {
        logger.log(
            `Failed to validate transaction: ${error.toString()}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        returnValue.error = error;

        return returnValue;
    }

    for (let [address, amount] of addressesAndAmounts) {
        const decoded: DecodedAddress = CryptoUtils(config).decodeAddress(address);

        /* Assign payment ID from integrated address if present */
        if (decoded.paymentId !== '') {
            paymentID = decoded.paymentId;

            /* Turn integrated address into standard address */
            address = CryptoUtils(config).encodeAddress(
                decoded.publicViewKey,
                decoded.publicSpendKey,
                undefined,
                decoded.prefix as any, /* TODO, types are wrong */
            );

            logger.log(
                `Extracted payment ID of ${paymentID} from address ${address}, resulting non integrated address: ${address}`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );
        }
    }

    /* Total amount we're sending */
    let totalAmount: number = _.sumBy(
        addressesAndAmounts, ([address, amount]) => amount,
    );

    const availableInputs: TxInputAndOwner[] = subWallets.getSpendableTransactionInputs(
        subWalletsToTakeFrom,
        daemon.getNetworkBlockCount(),
    );

    let sumOfInputs: number = 0;

    const ourInputs: TxInputAndOwner[] = [];

    if (fee.isFixedFee) {
        logger.log(
            `Total amount to send: ${totalAmount}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        totalAmount += fee.fixedFee;
    } else {
        logger.log(
            `Total amount to send (Not including fee per byte): ${totalAmount}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );
    }

    let changeRequired: number = 0;
    let requiredAmount: number = totalAmount;
    let txResult: [undefined, WalletError] | [CreatedTransaction, undefined] = [ undefined, SUCCESS ];
    const txInfo: PreparedTransactionInfo = {} as any;

    for (const [i, input] of availableInputs.entries()) {
        ourInputs.push(input);
        sumOfInputs += input.input.amount;

        /* If we're sending all, we want every input, so wait for last iteration */
        if (sendAll && i < availableInputs.length - 1) {
            continue;
        }

        if (sumOfInputs >= totalAmount || sendAll) {
            logger.log(
                `Selected enough inputs (${ourInputs.length}) with sum of ${sumOfInputs} ` +
                `to exceed total amount required: ${totalAmount} (not including fee), ` +
                `attempting to estimate transaction fee`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

            /* If sum of inputs is > totalAmount, we need to send some back to
             * ourselves */
            changeRequired = sumOfInputs - totalAmount;

            /* Split transfers up into amounts and keys */
            let destinations = setupDestinations(
                addressesAndAmounts,
                changeRequired,
                changeAddress,
                config,
            );

            /* Using fee per byte, lets take a guess at how large our fee is
             * going to be, and then see if we have enough inputs to cover it. */
            if (fee.isFeePerByte) {
                const transactionSize: number = estimateTransactionSize(
                    mixin,
                    ourInputs.length,
                    destinations.length,
                    paymentID !== '',
                    0,
                );

                logger.log(
                    `Estimated transaction size: ${prettyPrintBytes(transactionSize)}`,
                    LogLevel.DEBUG,
                    LogCategory.TRANSACTIONS,
                );

                const estimatedFee: number = getTransactionFee(
                    transactionSize,
                    daemon.getNetworkBlockCount(),
                    fee.feePerByte,
                    config,
                );

                logger.log(
                    `Estimated required transaction fee using fee per byte of ${fee.feePerByte}: ${estimatedFee}`,
                    LogLevel.DEBUG,
                    LogCategory.TRANSACTIONS,
                );

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
                        logger.log(
                            `Node fee + transaction fee + fixed destinations is greater than available balance`,
                            LogLevel.DEBUG,
                            LogCategory.TRANSACTIONS,
                        );

                        returnValue.fee = estimatedFee;
                        returnValue.error = new WalletError(WalletErrorCode.NOT_ENOUGH_BALANCE);

                        return returnValue;
                    }

                    totalAmount = remainingFunds - estimatedFee;

                    logger.log(
                        `Sending all, estimated max send minus fees and fixed destinations: ${totalAmount}`,
                        LogLevel.DEBUG,
                        LogCategory.TRANSACTIONS,
                    );

                    /* Amount to send is sum of inputs (full balance), minus
                     * node fee, minus estimated fee. */
                    addressesAndAmounts[0][1] = remainingFunds - estimatedFee;

                    changeRequired = 0;

                    destinations = setupDestinations(
                        addressesAndAmounts,
                        changeRequired,
                        changeAddress,
                        config,
                    );
                }

                let estimatedAmount: number = totalAmount + estimatedFee;

                /* Re-add total amount going to fixed destinations */
                if (sendAll) {
                    /* Estimated amount should now equal total balance. */
                    for (let j = 1; j < addressesAndAmounts.length; j++) {
                        estimatedAmount += addressesAndAmounts[j][1];
                    }
                }

                logger.log(
                    `Total amount to send (including fee per byte): ${estimatedAmount}`,
                    LogLevel.DEBUG,
                    LogCategory.TRANSACTIONS,
                );

                /* Ok, we have enough inputs to add our estimated fee, lets
                 * go ahead and try and make the transaction. */
                if (sumOfInputs >= estimatedAmount) {
                    logger.log(
                        `Selected enough inputs to exceed total amount required, ` +
                        `attempting to estimate transaction fee`,
                        LogLevel.DEBUG,
                        LogCategory.TRANSACTIONS,
                    );

                    const [success, result, change, needed] = await tryMakeFeePerByteTransaction(
                        sumOfInputs,
                        totalAmount,
                        estimatedFee,
                        fee.feePerByte,
                        addressesAndAmounts,
                        changeAddress,
                        mixin,
                        daemon,
                        ourInputs,
                        paymentID,
                        subWallets,
                        '',
                        sendAll,
                        config,
                    );

                    if (success) {
                        txResult = result;
                        changeRequired = change;
                        break;
                    } else {
                        requiredAmount = needed;
                        continue;
                    }
                } else {
                    logger.log(
                        `Did not select enough inputs to exceed total amount required, ` +
                        `selecting more if available.`,
                        LogLevel.DEBUG,
                        LogCategory.TRANSACTIONS,
                    );

                    requiredAmount = estimatedAmount;
                }
            } else {
                logger.log(
                    `Making non fee per byte transaction with fixed fee of ${fee.fixedFee}`,
                    LogLevel.DEBUG,
                    LogCategory.TRANSACTIONS,
                );

                txResult = await makeTransaction(
                    mixin,
                    fee.fixedFee,
                    paymentID,
                    ourInputs,
                    destinations,
                    subWallets,
                    daemon,
                    config,
                );

                const [tx, err] = txResult;

                if (err) {
                    logger.log(
                        `Error creating transaction, ${err.toString()}`,
                        LogLevel.DEBUG,
                        LogCategory.TRANSACTIONS,
                    );

                    break;
                }

                const minFee: number = getMinimumTransactionFee(
                    tx!.rawTransaction.length / 2 ,
                    daemon.getNetworkBlockCount(),
                    config,
                );

                logger.log(
                    `Min fee required for generated transaction: ${minFee}`,
                    LogLevel.DEBUG,
                    LogCategory.TRANSACTIONS,
                );

                if (fee.fixedFee >= minFee) {
                    logger.log(
                        `Fee of generated transaction is greater than min fee, creation succeeded.`,
                        LogLevel.DEBUG,
                        LogCategory.TRANSACTIONS,
                    );

                    break;
                } else {
                    logger.log(
                        `Fee of generated transaction is less than min fee, creation failed.`,
                        LogLevel.DEBUG,
                        LogCategory.TRANSACTIONS,
                    );

                    returnValue.error = new WalletError(WalletErrorCode.FEE_TOO_SMALL);
                    return returnValue;
                }
            }
        }
    }

    if (sumOfInputs < requiredAmount) {
        returnValue.fee = requiredAmount - totalAmount;
        returnValue.error = new WalletError(WalletErrorCode.NOT_ENOUGH_BALANCE);

        logger.log(
            `Not enough balance to cover transaction, required: ${requiredAmount}, ` +
            `fee: ${returnValue.fee}, available: ${sumOfInputs}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        return returnValue;
    }

    const [createdTX, creationError] = txResult;

    /* Checking for undefined to keep the compiler from complaining later.. */
    if (creationError || createdTX === undefined) {
        logger.log(
            `Failed to create transaction, ${(creationError as WalletError).toString()}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        returnValue.error = creationError as WalletError;
        return returnValue;
    }

    const actualFee: number = sumTransactionFee(createdTX.transaction);

    logger.log(
        `Successfully created transaction, proceeding to validating and sending`,
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    logger.log(
        `Created transaction: ${JSON.stringify(createdTX.transaction)}`,
        LogLevel.TRACE,
        LogCategory.TRANSACTIONS,
    );

    const verifyErr: WalletError = verifyTransaction(
        createdTX,
        fee,
        daemon,
        config,
    );

    if (!_.isEqual(verifyErr, SUCCESS)) {
        returnValue.error = verifyErr;
        return returnValue;
    }

    if (relayToNetwork) {
        const [prettyTX, err] = await relayTransaction(
            createdTX,
            actualFee,
            paymentID,
            ourInputs,
            changeAddress,
            changeRequired,
            subWallets,
            daemon,
            config,
        );

        if (err) {
            logger.log(
                `Failed to verify and send transaction: ${(err as WalletError).toString()}`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

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
    returnValue.transactionHash = createdTX.hash;
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
}

async function tryMakeFeePerByteTransaction(
    sumOfInputs: number,
    amountPreFee: number,
    estimatedFee: number,
    feePerByte: number,
    addressesAndAmounts: Array<[string, number]>,
    changeAddress: string,
    mixin: number,
    daemon: IDaemon,
    ourInputs: TxInputAndOwner[],
    paymentID: string,
    subWallets: SubWallets,
    extraData: string,
    sendAll: boolean,
    config: Config): Promise<[
        boolean,
        ([ CreatedTransaction, undefined ] | [undefined, WalletError ]),
        number,
        number
]> {

    let attempt: number = 0;

    while (true) {
        logger.log(
            `Attempting fee per byte transaction construction, attempt ${attempt}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        const changeRequired: number = sendAll
            ? 0
            : sumOfInputs - amountPreFee - estimatedFee;

        logger.log(
            `Change required: ${changeRequired}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        /* Need to recalculate destinations since amount of change, err, changed! */
        const destinations = setupDestinations(
            addressesAndAmounts,
            changeRequired,
            changeAddress,
            config,
        );

        const result = await makeTransaction(
            mixin,
            estimatedFee,
            paymentID,
            ourInputs,
            destinations,
            subWallets,
            daemon,
            config,
        );

        const [ tx, creationError ] = result;

        if (creationError) {
            logger.log(
                `Error creating transaction, ${creationError.toString()}`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

            return [ true, result, 0, 0 ];
        }

        const actualTxSize = tx!.rawTransaction.length / 2;

        logger.log(
            `Size of generated transaction: ${prettyPrintBytes(actualTxSize)}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        const requiredFee: number = getTransactionFee(
            actualTxSize,
            daemon.getNetworkBlockCount(),
            feePerByte,
            config,
        );

        logger.log(
            `Required transaction fee using fee per byte of ${feePerByte}: ${requiredFee}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        /* Great! The fee we estimated is greater than or equal
         * to the min/specified fee per byte for a transaction
         * of this size, so we can continue with sending the
         * transaction. */
        if (estimatedFee >= requiredFee) {
            logger.log(
                `Estimated fee of ${estimatedFee} is greater ` +
                `than or equal to required fee of ${requiredFee}, creation succeeded.`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

            return [ true, result, changeRequired, 0 ];
        }

        logger.log(
            `Estimated fee of ${estimatedFee} is less` +
            `than required fee of ${requiredFee}.`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        /* If we're sending all, then we adjust the amount we're sending,
         * rather than the change we're returning. */
        if (sendAll) {
            /* Update the amount we're sending, by readding the too small fee,
             * and taking off the requiredFee. I.e., if estimated was 35,
             * required was 40, then we'd end up sending 5 less to the destination
             * to cover the new fee required. */
            addressesAndAmounts[0][1] = addressesAndAmounts[0][1] + estimatedFee - requiredFee;

            estimatedFee = requiredFee;

            logger.log(
                `Sending all, adjusting primary transaction amount down to ${addressesAndAmounts[0][1]}`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );
        }

        /* The actual fee required for a tx of this size is not
         * covered by the amount of inputs we have so far, lets
         * go select some more then try again. */
        if (amountPreFee + requiredFee > sumOfInputs) {
            logger.log(
                `Do not have enough inputs selected to cover required fee. Returning ` +
                `to select more inputs if available.`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

            return [ false, result, changeRequired, amountPreFee + requiredFee ];
        }

        logger.log(
            `Updating estimated fee to ${requiredFee} and attempting transaction ` +
            `construction again.`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        attempt++;
    }
}

export async function sendPreparedTransaction(
    transaction: PreparedTransaction,
    subWallets: SubWallets,
    daemon: IDaemon,
    config: Config): Promise<PreparedTransactionInfo> {

    const returnValue: PreparedTransactionInfo = {
        success: false,
        error: SUCCESS,
        ...transaction,
    };

    for (const input of transaction.inputs) {
        if (!subWallets.haveSpendableInput(input.input, daemon.getNetworkBlockCount())) {
            logger.log(
                `Prepared transaction ${transaction.rawTransaction.hash} expired, input ${input.input.key}`,
                LogLevel.DEBUG,
                LogCategory.TRANSACTIONS,
            );

            returnValue.error = new WalletError(WalletErrorCode.PREPARED_TRANSACTION_EXPIRED);
            return returnValue;
        }
    }

    const [prettyTX, err] = await relayTransaction(
        transaction.rawTransaction,
        transaction.fee,
        transaction.paymentID,
        transaction.inputs,
        transaction.changeAddress,
        transaction.changeRequired,
        subWallets,
        daemon,
        config,
    );

    if (err) {
        logger.log(
            `Failed to verify and send transaction: ${(err as WalletError).toString()}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        returnValue.error = err;
        return returnValue;
    }

    returnValue.prettyTransaction = prettyTX;
    returnValue.success = true;

    return returnValue;
}

function setupDestinations(
    addressesAndAmountsTmp: Array<[string, number]>,
    changeRequired: number,
    changeAddress: string,
    config: Config): TxDestination[] {

    /* Clone array so we don't manipulate it outside the function */
    const addressesAndAmounts: Array<[string, number]> = addressesAndAmountsTmp.slice();

    if (changeRequired !== 0) {
        addressesAndAmounts.push([changeAddress, changeRequired]);
    }

    let amounts: Array<[string, number]> = [];

    /* Split amounts into denominations */
    addressesAndAmounts.map(([address, amount]) => {
        for (const denomination of splitAmountIntoDenominations(amount)) {
            amounts.push([address, denomination]);
        }
    });

    logger.log(
        `Split destinations into ${amounts.length} outputs`,
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    amounts = _.sortBy(amounts, ([address, amount]) => amount);

    /* Prepare destinations keys */
    return amounts.map(([address, amount]) => {
        const decoded: DecodedAddress = CryptoUtils(config).decodeAddress(address);

        return {
            amount: amount,
            keys: decoded,
        };
    });
}

async function makeTransaction(
    mixin: number,
    fee: number,
    paymentID: string,
    ourInputs: TxInputAndOwner[],
    destinations: TxDestination[],
    subWallets: SubWallets,
    daemon: IDaemon,
    config: Config): Promise<([CreatedTransaction, undefined]) | ([undefined, WalletError])> {

    ourInputs = _.sortBy(ourInputs, (input) => input.input.amount);

    logger.log(
        `Collecting ring participants`,
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    const randomOuts: WalletError | RandomOutput[][] = await getRingParticipants(
        ourInputs, mixin, daemon, config,
    );

    if (randomOuts instanceof WalletError) {
        logger.log(
            `Failed to get ring participants: ${randomOuts.toString()}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        return [undefined, randomOuts as WalletError];
    }

    let numPregenerated = 0;
    let numGeneratedOnDemand = 0;

    const ourOutputs: Output[] = await Promise.all(ourInputs.map(async (input) => {
        if (typeof input.input.privateEphemeral !== 'string' || !isHex64(input.input.privateEphemeral)) {
            const [keyImage, tmpSecretKey] = await generateKeyImage(
                input.input.transactionPublicKey,
                subWallets.getPrivateViewKey(),
                input.publicSpendKey,
                input.privateSpendKey,
                input.input.transactionIndex,
                config,
            );

            input.input.privateEphemeral = tmpSecretKey;

            numGeneratedOnDemand++;
        } else {
            numPregenerated++;
        }

        return {
            amount: input.input.amount,
            globalIndex: input.input.globalOutputIndex as number,
            index: input.input.transactionIndex,
            input: {
                privateEphemeral: input.input.privateEphemeral,
            },
            key: input.input.key,
            keyImage: input.input.keyImage,
        };
    }));

    logger.log(
        `Generated key images for ${numGeneratedOnDemand} inputs, used pre-generated key images for ${numPregenerated} inputs.`,
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    try {
        logger.log(
            `Asynchronously creating transaction with turtlecoin-utils`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        const tx = await CryptoUtils(config).createTransactionAsync(
            destinations, ourOutputs, randomOuts as RandomOutput[][], mixin, fee,
            paymentID,
        );

        logger.log(
            `Transaction creation succeeded`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        return [tx, undefined];
    } catch (err) {
        logger.log(
            `Error while creating transaction with turtlecoin-utils: ${err.toString()}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        return [undefined, new WalletError(WalletErrorCode.UNKNOWN_ERROR, err.toString())];
    }
}

function verifyTransaction(
    tx: CreatedTransaction,
    fee: FeeType,
    daemon: IDaemon,
    config: Config): WalletError {

    logger.log(
        'Verifying size of transaction',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    /* Check the transaction isn't too large to fit in a block */
    const tooBigErr: WalletError = isTransactionPayloadTooBig(
        tx.rawTransaction, daemon.getNetworkBlockCount(), config,
    );

    if (!_.isEqual(tooBigErr, SUCCESS)) {
        return tooBigErr;
    }

    logger.log(
        'Verifying amounts of transaction',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    /* Check all the output amounts are members of 'PRETTY_AMOUNTS', otherwise
       they will not be mixable */
    if (!verifyAmounts(tx.transaction.outputs)) {
        return new WalletError(WalletErrorCode.AMOUNTS_NOT_PRETTY);
    }

    logger.log(
        'Verifying transaction fee',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    /* Check the transaction has the fee that we expect (0 for fusion) */
    if (!verifyTransactionFee(tx, fee, sumTransactionFee(tx.transaction))) {
        return new WalletError(WalletErrorCode.UNEXPECTED_FEE);
    }

    return SUCCESS;
}

async function relayTransaction(
    tx: CreatedTransaction,
    fee: number,
    paymentID: string,
    inputs: TxInputAndOwner[],
    changeAddress: string,
    changeRequired: number,
    subWallets: SubWallets,
    daemon: IDaemon,
    config: Config): Promise<[TX, undefined] | [undefined, WalletError]> {

    let relaySuccess: boolean;
    let errorMessage: string | undefined;

    logger.log(
        'Relaying transaction',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    try {
        [relaySuccess, errorMessage] = await daemon.sendTransaction(tx.rawTransaction);

    /* Timeout */
    } catch (err) {
        logger.log(
            `Caught exception relaying transaction, error: ${err.toString()}, return code: ${err.statusCode}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        if (err.statusCode === 504) {
            return [undefined, new WalletError(WalletErrorCode.DAEMON_STILL_PROCESSING)];
        }

        return [undefined, new WalletError(WalletErrorCode.DAEMON_OFFLINE)];
    }

    if (!relaySuccess) {
        const customMessage = errorMessage === undefined
            ? ''
            : `The daemon did not accept our transaction. Error: ${errorMessage}.`;

        logger.log(
            `Failed to relay transaction. ${customMessage}`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        return [undefined, new WalletError(WalletErrorCode.DAEMON_ERROR, customMessage)];
    }

    logger.log(
        'Storing sent transaction',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    /* Store the unconfirmed transaction, update our balance */
    const returnTX: TX = await storeSentTransaction(
        tx.hash, tx.transaction.outputs, tx.transaction.transactionKeys.publicKey,
        fee, paymentID, inputs, subWallets, config,
    );

    logger.log(
        'Marking sent inputs as locked',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    /* Lock the input for spending till confirmed/cancelled */
    for (const input of inputs) {
        subWallets.markInputAsLocked(input.publicSpendKey, input.input.keyImage);
    }

    logger.log(
        'Transaction process complete.',
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    return [returnTX, undefined];
}

async function storeSentTransaction(
    hash: string,
    keyOutputs: Vout[],
    txPublicKey: string,
    fee: number,
    paymentID: string,
    ourInputs: TxInputAndOwner[],
    subWallets: SubWallets,
    config: Config): Promise<TX> {

    const transfers: Map<string, number> = new Map();

    const derivation: string = await generateKeyDerivation(
        txPublicKey, subWallets.getPrivateViewKey(), config,
    );

    const spendKeys: string[] = subWallets.getPublicSpendKeys();

    for (const [outputIndex, output] of keyOutputs.entries()) {
        /* Derive the spend key from the transaction, using the previous
           derivation */
        const derivedSpendKey = await underivePublicKey(
            derivation, outputIndex, output.key, config,
        );

        /* See if the derived spend key matches any of our spend keys */
        if (!_.includes(spendKeys, derivedSpendKey)) {
            continue;
        }

        const input: UnconfirmedInput = new UnconfirmedInput(
            output.amount, output.key, hash,
        );

        subWallets.storeUnconfirmedIncomingInput(input, derivedSpendKey);

        transfers.set(
            derivedSpendKey,
            output.amount + (transfers.get(derivedSpendKey) || 0),
        );
    }

    for (const input of ourInputs) {
        /* Amounts we have spent, subtract them from the transfers map */
        transfers.set(
            input.publicSpendKey,
            -input.input.amount + (transfers.get(input.publicSpendKey) || 0),
        );
    }

    const timestamp: number = 0;
    const blockHeight: number = 0;
    const unlockTime: number = 0;
    const isCoinbaseTransaction: boolean = false;

    const tx: TX = new TX(
        transfers, hash, fee, timestamp, blockHeight, paymentID,
        unlockTime, isCoinbaseTransaction,
    );

    subWallets.addUnconfirmedTransaction(tx);

    logger.log(
        `Stored unconfirmed transaction: ${JSON.stringify(tx)}`,
        LogLevel.TRACE,
        LogCategory.TRANSACTIONS,
    );

    return tx;
}

/**
 * Verify the transaction is small enough to fit in a block
 */
function isTransactionPayloadTooBig(
    rawTransaction: string,
    currentHeight: number,
    config: Config): WalletError {

    /* Divided by two because it's represented as hex */
    const txSize: number = rawTransaction.length / 2;

    const maxTxSize: number = getMaxTxSize(currentHeight, config.blockTargetTime);

    if (txSize > maxTxSize) {
        return new WalletError(
            WalletErrorCode.TOO_MANY_INPUTS_TO_FIT_IN_BLOCK,
            `Transaction is too large: (${prettyPrintBytes(txSize)}). Max ` +
            `allowed size is ${prettyPrintBytes(maxTxSize)}. Decrease the ` +
            `amount you are sending, or perform some fusion transactions.`,
        );
    }

    return SUCCESS;
}

/**
 * Verify all the output amounts are members of PRETTY_AMOUNTS, otherwise they
 * will not be mixable
 */
function verifyAmounts(amounts: Vout[]): boolean {
    for (const vout of amounts) {
        if (!PRETTY_AMOUNTS.includes(vout.amount)) {
            return false;
        }
    }

    return true;
}

function sumTransactionFee(transaction: Transaction): number {
    let inputTotal: number = 0;
    let outputTotal: number = 0;

    for (const input of transaction.inputs) {
        inputTotal += input.amount;
    }

    for (const output of transaction.outputs) {
        outputTotal += output.amount;
    }

    return inputTotal - outputTotal;
}

/**
 * Verify the transaction fee is the same as the requested transaction fee
 */
function verifyTransactionFee(
    transaction: CreatedTransaction,
    expectedFee: FeeType,
    actualFee: number): boolean {

    if (expectedFee.isFixedFee) {
        return expectedFee.fixedFee === actualFee;
    } else {
        /* Divided by two because it's represented as hex */
        const txSize: number = transaction.rawTransaction.length / 2;

        const calculatedFee: number = expectedFee.feePerByte * txSize;

         /* Ensure fee is greater or equal to the fee per byte specified,
          * and no more than two times the fee per byte specified. */
        return actualFee >= calculatedFee && actualFee <= calculatedFee * 2;
    }
}

/**
 * Get sufficient random outputs for the transaction. Returns an error if
 * can't get outputs or can't get enough outputs.
 */
async function getRingParticipants(
    inputs: TxInputAndOwner[],
    mixin: number,
    daemon: IDaemon,
    config: Config): Promise<WalletError | RandomOutput[][]> {

    if (mixin === 0) {
        logger.log(
            `Mixin = 0, no ring participants needed`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        return [];
    }

    /* Request one more than needed, this way if we get our own output as
       one of the mixin outs, we can skip it and still form the transaction */
    const requestedOuts: number = mixin + 1;

    const amounts: number[] = inputs.map((input) => input.input.amount);

    const outs = await daemon.getRandomOutputsByAmount(amounts, requestedOuts);

    if (outs.length === 0) {
        logger.log(
            `Failed to get any random outputs from the daemon`,
            LogLevel.DEBUG,
            LogCategory.TRANSACTIONS,
        );

        return new WalletError(WalletErrorCode.DAEMON_OFFLINE);
    }

    for (const amount of amounts) {
        /* Check each amount is present in outputs */
        const foundOutputs = _.find(outs, ([outAmount, ignore]) => amount === outAmount);

        if (foundOutputs === undefined) {
            return new WalletError(
                WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS,
                `Failed to get any matching outputs for amount ${amount} ` +
                `(${prettyPrintAmount(amount, config)}). Further explanation here: ` +
                `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`,
            );
        }

        const [, outputs] = foundOutputs;

        if (outputs.length < mixin) {
            return new WalletError(
                WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS,
                `Failed to get enough matching outputs for amount ${amount} ` +
                `(${prettyPrintAmount(amount, config)}). Needed outputs: ${mixin} ` +
                `, found outputs: ${outputs.length}. Further explanation here: ` +
                `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`,
            );
        }
    }

    if (outs.length !== amounts.length) {
        return new WalletError(WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS);
    }

    const randomOuts: RandomOutput[][] = [];

     /* Do the same check as above here, again. The reason being that
        we just find the first set of outputs matching the amount above,
        and if we requests, say, outputs for the amount 100 twice, the
        first set might be sufficient, but the second are not.

        We could just check here instead of checking above, but then we
        might hit the length message first. Checking this way gives more
        informative errors. */
    for (const [amount, outputs] of outs) {
        if (outputs.length < mixin) {
            return new WalletError(
                WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS,
                `Failed to get enough matching outputs for amount ${amount} ` +
                `(${prettyPrintAmount(amount, config)}). Needed outputs: ${mixin} ` +
                `, found outputs: ${outputs.length}. Further explanation here: ` +
                `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`,
            );
        }

        randomOuts.push(outputs.map(([index, key]) => {
            return {
                globalIndex: index,
                key: key,
            };
        }));
    }

    logger.log(
        `Finished gathering ring participants`,
        LogLevel.DEBUG,
        LogCategory.TRANSACTIONS,
    );

    return randomOuts;
}

/**
 * Validate the given transaction parameters are valid.
 *
 * @return Returns either SUCCESS or an error representing the issue
 */
function validateTransaction(
    destinations: Array<[string, number]>,
    mixin: number,
    fee: FeeType,
    paymentID: string,
    subWalletsToTakeFrom: string[],
    changeAddress: string,
    sendAll: boolean,
    currentHeight: number,
    subWallets: SubWallets,
    config: Config): WalletError {

    /* Validate the destinations are valid */
    let error: WalletError = validateDestinations(destinations, config);

    if (!_.isEqual(error, SUCCESS)) {
        return error;
    }

    /* Validate stored payment ID's in integrated addresses don't conflict */
    error = validateIntegratedAddresses(destinations, paymentID, config);

    if (!_.isEqual(error, SUCCESS)) {
        return error;
    }

    /* Verify the subwallets to take from exist */
    error = validateOurAddresses(subWalletsToTakeFrom, subWallets, config);

    if (!_.isEqual(error, SUCCESS)) {
        return error;
    }

    /* Verify we have enough money for the transaction */
    error = validateAmount(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight, config);

    if (!_.isEqual(error, SUCCESS)) {
        return error;
    }

    /* Validate mixin is within the bounds for the current height */
    error = validateMixin(mixin, currentHeight, config);

    if (!_.isEqual(error, SUCCESS)) {
        return error;
    }

    error = validatePaymentID(paymentID);

    if (!_.isEqual(error, SUCCESS)) {
        return error;
    }

    error = validateOurAddresses([changeAddress], subWallets, config);

    if (!_.isEqual(error, SUCCESS)) {
        return error;
    }

    return SUCCESS;
}

/**
 * Validate the given transaction parameters are valid.
 *
 * @return Returns either SUCCESS or an error representing the issue
 */
function validateFusionTransaction(
    mixin: number,
    subWalletsToTakeFrom: string[],
    destination: string,
    currentHeight: number,
    subWallets: SubWallets,
    config: Config): WalletError {

    /* Validate mixin is within the bounds for the current height */
    let error: WalletError = validateMixin(mixin, currentHeight, config);

    if (_.isEqual(error, SUCCESS)) {
        return error;
    }

    /* Verify the subwallets to take from exist */
    error = validateOurAddresses(subWalletsToTakeFrom, subWallets, config);

    if (_.isEqual(error, SUCCESS)) {
        return error;
    }

    /* Verify the destination address is valid and exists in the subwallets */
    error = validateOurAddresses([destination], subWallets, config);

    if (_.isEqual(error, SUCCESS)) {
        return error;
    }

    return SUCCESS;
}
