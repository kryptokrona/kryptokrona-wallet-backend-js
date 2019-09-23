// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

import {
    CreatedTransaction, DecodedAddress, Output, RandomOutput, Transaction,
    TxDestination, Vout, Wallet,
} from 'turtlecoin-utils';

import { Config } from './Config';
import { IDaemon } from './IDaemon';
import { CryptoUtils} from './CnUtils';
import { SubWallets } from './SubWallets';

import { LogCategory, logger, LogLevel } from './Logger';

import { Transaction as TX, TxInputAndOwner, UnconfirmedInput } from './Types';

import {
    generateKeyImage, generateKeyDerivation, underivePublicKey,
} from './CryptoWrapper';

import {
    addressToKeys, getMaxTxSize, prettyPrintAmount, prettyPrintBytes,
    splitAmountIntoDenominations, isHex64,
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
    subWallets: SubWallets): Promise<
        ([TX, string, undefined]) |
        ([undefined, undefined, WalletError])
    > {

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
    destination?: string): Promise<
        ([TX, string, undefined]) |
        ([undefined, undefined, WalletError])
    > {

    if (mixin === undefined) {
        mixin = config.mixinLimits.getDefaultMixinByHeight(
            daemon.getNetworkBlockCount(),
        );
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
    const error: WalletError = validateFusionTransaction(
        mixin, subWalletsToTakeFrom, destination,
        daemon.getNetworkBlockCount(), subWallets, config,
    );

    if (!_.isEqual(error, SUCCESS)) {
        return [undefined, undefined, error];
    }

    /* Get the random inputs for this tx */
    const [ourInputs, foundMoney] = subWallets.getFusionTransactionInputs(
        subWalletsToTakeFrom, mixin, daemon.getNetworkBlockCount(),
    );

    /* Payment ID's are not needed with fusion transactions */
    const paymentID: string = '';

    /* Fusion transactions are free */
    const fee: number = 0;

    let fusionTX: CreatedTransaction;

    while (true) {
        /* Not enough unspent inputs for a fusion TX, we're fully optimized */
        if (ourInputs.length < FUSION_TX_MIN_INPUT_COUNT) {
            return [undefined, undefined, new WalletError(WalletErrorCode.FULLY_OPTIMIZED)];
        }

        /* Amount of the transaction */
        const amount = _.sumBy(ourInputs, (input) => input.input.amount);

        /* Number of outputs this transaction will create */
        const numOutputs = splitAmountIntoDenominations(amount).length;

        /* Need to have at least 4x more inputs than outputs */
        if (numOutputs === 0
        || (ourInputs.length / numOutputs) < FUSION_TX_MIN_IN_OUT_COUNT_RATIO) {
            /* Remove last input */
            ourInputs.pop();

            /* And try again */
            continue;
        }

        const addressesAndAmounts: Array<[string, number]> = [[destination, amount]];

        const [tx, creationError] = await makeTransaction(
            mixin,
            fee,
            paymentID,
            ourInputs,
            addressesAndAmounts,
            subWallets,
            daemon,
            config,
        );

        if (creationError || tx === undefined) {
            return [undefined, undefined, creationError as WalletError];
        }

        /* Divided by two because it's represented as hex */
        if (tx.rawTransaction.length / 2 > MAX_FUSION_TX_SIZE) {
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

    return verifyAndSendTransaction(
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
}

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
export async function sendTransactionBasic(
    config: Config,
    daemon: IDaemon,
    subWallets: SubWallets,
    destination: string,
    amount: number,
    paymentID?: string): Promise<
        ([TX, string, undefined]) |
        ([undefined, undefined, WalletError])
    > {

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
 * @param fee                   The network fee to use with this transaction. In ATOMIC units.
 * @param paymentID             The payment ID to include with this transaction.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param changeAddress         The address to send any returned change to.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
export async function sendTransactionAdvanced(
    config: Config,
    daemon: IDaemon,
    subWallets: SubWallets,
    addressesAndAmounts: Array<[string, number]>,
    mixin?: number,
    fee?: number,
    paymentID?: string,
    subWalletsToTakeFrom?: string[],
    changeAddress?: string): Promise<
        ([TX, string, undefined]) |
        ([undefined, undefined, WalletError])
    > {

    if (mixin === undefined) {
        mixin = config.mixinLimits.getDefaultMixinByHeight(
            daemon.getNetworkBlockCount(),
        );
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

    const error: WalletError = validateTransaction(
        addressesAndAmounts, mixin, fee, paymentID, subWalletsToTakeFrom,
        changeAddress, daemon.getNetworkBlockCount(), subWallets, config,
    );

    if (!_.isEqual(error, SUCCESS)) {
        return [undefined, undefined, error];
    }

    /* Total amount we're sending */
    const totalAmount: number = _.sumBy(
        addressesAndAmounts, ([address, amount]) => amount,
    ) + fee;

    const [inputs, foundMoney] = subWallets.getTransactionInputsForAmount(
        totalAmount, subWalletsToTakeFrom, daemon.getNetworkBlockCount(),
    );

    /* Amount to send back to ourself */
    const changeRequired: number = foundMoney - totalAmount;

    if (changeRequired > 0) {
        addressesAndAmounts.push([changeAddress, changeRequired]);
    }

    const [tx, creationError] = await makeTransaction(
        mixin,
        fee,
        paymentID,
        inputs,
        addressesAndAmounts,
        subWallets,
        daemon,
        config,
    );

    /* Checking for undefined to keep the compiler from complaining later.. */
    if (creationError || tx === undefined) {
        return [undefined, undefined, creationError as WalletError];
    }

    /* Perform some final checks, and send the transaction */
    return verifyAndSendTransaction(
        tx,
        fee,
        paymentID,
        inputs,
        changeAddress,
        changeRequired,
        subWallets,
        daemon,
        config,
    );
}

async function makeTransaction(
    mixin: number,
    fee: number,
    paymentID: string,
    ourInputs: TxInputAndOwner[],
    addressesAndAmounts: Array<[string, number]>,
    subWallets: SubWallets,
    daemon: IDaemon,
    config: Config): Promise<([CreatedTransaction, undefined]) | ([undefined, WalletError])> {

    let amounts: Array<[string, number]> = [];

    /* Split amounts into denominations */
    addressesAndAmounts.map(([address, amount]) => {
        for (const denomination of splitAmountIntoDenominations(amount)) {
            amounts.push([address, denomination]);
        }
    });

    amounts = _.sortBy(amounts, ([address, amount]) => amount);

    /* Prepare destinations keys */
    const transfers: TxDestination[] = amounts.map(([address, amount]) => {
        const decoded: DecodedAddress = CryptoUtils(config).decodeAddress(address);

        /* Assign payment ID from integrated address if present */
        if (decoded.paymentId !== '') {
            paymentID = decoded.paymentId;
        }

        return {
            amount: amount,
            keys: decoded,
        };
    });

    ourInputs = _.sortBy(ourInputs, (input) => input.input.amount);

    const randomOuts: WalletError | RandomOutput[][] = await getRingParticipants(
        ourInputs, mixin, daemon, config,
    );

    if (randomOuts instanceof WalletError) {
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
        const tx = await CryptoUtils(config).createTransactionAsync(
            transfers, ourOutputs, randomOuts as RandomOutput[][], mixin, fee,
            paymentID,
        );

        return [tx, undefined];
    } catch (err) {
        return [undefined, new WalletError(WalletErrorCode.UNKNOWN_ERROR, err.toString())];
    }
}

async function verifyAndSendTransaction(
    tx: CreatedTransaction,
    fee: number,
    paymentID: string,
    inputs: TxInputAndOwner[],
    changeAddress: string,
    changeRequired: number,
    subWallets: SubWallets,
    daemon: IDaemon,
    config: Config): Promise<([TX, string, undefined]) | ([undefined, undefined, WalletError])> {

    logger.log(
        `Created transaction: ${JSON.stringify(tx.transaction)}`,
        LogLevel.TRACE,
        LogCategory.TRANSACTIONS
    );

    /* Check the transaction isn't too large to fit in a block */
    const tooBigErr: WalletError = isTransactionPayloadTooBig(
        tx.rawTransaction, daemon.getNetworkBlockCount(), config
    );

    if (!_.isEqual(tooBigErr, SUCCESS)) {
        return [undefined, undefined, tooBigErr];
    }

    /* Check all the output amounts are members of 'PRETTY_AMOUNTS', otherwise
       they will not be mixable */
    if (!verifyAmounts(tx.transaction.outputs)) {
        return [undefined, undefined, new WalletError(WalletErrorCode.AMOUNTS_NOT_PRETTY)];
    }

    /* Check the transaction has the fee that we expect (0 for fusion) */
    if (!verifyTransactionFee(tx.transaction, fee)) {
        return [undefined, undefined, new WalletError(WalletErrorCode.UNEXPECTED_FEE)];
    }

    let relaySuccess: boolean;
    let errorMessage: string | undefined;

    try {
        [relaySuccess, errorMessage] = await daemon.sendTransaction(tx.rawTransaction);

    /* Timeout */
    } catch (err) {
        if (err.statusCode === 504) {
            return [undefined, undefined, new WalletError(WalletErrorCode.DAEMON_STILL_PROCESSING)];
        }

        return [undefined, undefined, new WalletError(WalletErrorCode.DAEMON_OFFLINE)];
    }

    if (!relaySuccess) {
        const customMessage = errorMessage === undefined 
            ? ''
            : `The daemon did not accept our transaction. Error: ${errorMessage}. You may need to resync your wallet.`;

        return [undefined, undefined, new WalletError(WalletErrorCode.DAEMON_ERROR, customMessage)];
    }

    /* Store the unconfirmed transaction, update our balance */
    const returnTX: TX = await storeSentTransaction(
        tx.hash, tx.transaction.outputs, tx.transaction.transactionKeys.publicKey, 
        fee, paymentID, inputs, subWallets, config
    );

    /* Lock the input for spending till confirmed/cancelled */
    for (const input of inputs) {
        subWallets.markInputAsLocked(input.publicSpendKey, input.input.keyImage);
    }

    return [returnTX, tx.hash, undefined];
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
        txPublicKey, subWallets.getPrivateViewKey(), config
    );

    const spendKeys: string[] = subWallets.getPublicSpendKeys();

    for (const [outputIndex, output] of keyOutputs.entries()) {
        /* Derive the spend key from the transaction, using the previous
           derivation */
        const derivedSpendKey = await underivePublicKey(
            derivation, outputIndex, output.key, config
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
            output.amount + (transfers.get(derivedSpendKey) || 0)
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

/**
 * Verify the transaction fee is the same as the requested transaction fee
 */
function verifyTransactionFee(transaction: Transaction, expectedFee: number): boolean {
    let inputTotal: number = 0;
    let outputTotal: number = 0;

    for (const input of transaction.inputs) {
        inputTotal += input.amount;
    }

    for (const output of transaction.outputs) {
        outputTotal += output.amount;
    }

    const actualFee: number = inputTotal - outputTotal;

    return actualFee === expectedFee;
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
        return [];
    }

    /* Request one more than needed, this way if we get our own output as
       one of the mixin outs, we can skip it and still form the transaction */
    const requestedOuts: number = mixin + 1;

    const amounts: number[] = inputs.map((input) => input.input.amount);

    const outs = await daemon.getRandomOutputsByAmount(amounts, requestedOuts);

    if (outs.length === 0) {
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
    fee: number,
    paymentID: string,
    subWalletsToTakeFrom: string[],
    changeAddress: string,
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
