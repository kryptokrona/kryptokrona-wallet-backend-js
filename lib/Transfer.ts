// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import deepEqual = require('deep-equal');

import * as _ from 'lodash';

import {
    CreatedTransaction, DecodedAddress, Output, RandomOutput, Transaction,
    TxDestination, Vout, Wallet,
} from 'turtlecoin-utils';

import { Config } from './Config';
import { IDaemon } from './IDaemon';
import { CryptoUtils} from './CnUtils';
import { SubWallets } from './SubWallets';
import { PRETTY_AMOUNTS } from './Constants';
import { LogCategory, logger, LogLevel } from './Logger';
import { Transaction as TX, TxInputAndOwner, UnconfirmedInput } from './Types';

import {
    addressToKeys, getMaxTxSize, prettyPrintAmount, prettyPrintBytes,
    splitAmountIntoDenominations,
} from './Utilities';

import {
    validateAddresses, validateAmount, validateDestinations,
    validateIntegratedAddresses, validateMixin, validateOurAddresses,
    validatePaymentID,
} from './ValidateParameters';

import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';

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
export async function sendTransactionBasic(
    daemon: IDaemon,
    subWallets: SubWallets,
    destination: string,
    amount: number,
    paymentID?: string): Promise<[string | undefined, WalletError | undefined]> {

    return sendTransactionAdvanced(
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
export async function sendTransactionAdvanced(
    daemon: IDaemon,
    subWallets: SubWallets,
    addressesAndAmounts: Array<[string, number]>,
    mixin?: number,
    fee?: number,
    paymentID?: string,
    subWalletsToTakeFrom?: string[],
    changeAddress?: string): Promise<[string | undefined, WalletError | undefined]> {

    if (mixin === undefined) {
        mixin = Config.mixinLimits.getDefaultMixinByHeight(
            daemon.getNetworkBlockCount(),
        );
    }

    if (fee === undefined) {
        fee = Config.minimumFee;
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
        changeAddress, daemon.getNetworkBlockCount(), subWallets,
    );

    if (!deepEqual(error, SUCCESS)) {
        return [undefined, error];
    }

    const totalAmount: number = _.sumBy(
        addressesAndAmounts, ([address, amount]) => amount,
    ) + fee;

    const amounts: Array<[string, number]> = [];

    /* Split amounts into denominations */
    addressesAndAmounts.map(([address, amount]) => {
        for (const denomination of splitAmountIntoDenominations(amount)) {
            amounts.push([address, denomination]);
        }
    });

    /* Prepare destinations keys */
    const transfers: TxDestination[] = amounts.map(([address, amount]) => {
        const decoded: DecodedAddress = CryptoUtils().decodeAddress(address);

        /* Assign payment ID from integrated address is present */
        if (decoded.paymentId !== '') {
            paymentID = decoded.paymentId;
        }

        return {
            amount: amount,
            keys: decoded,
        };
    });

    const [inputs, foundMoney] = subWallets.getTransactionInputsForAmount(
        totalAmount, subWalletsToTakeFrom, daemon.getNetworkBlockCount(),
    );

    const changeRequired: number = foundMoney - totalAmount;

    /* Need to send change back to ourselves */
    if (changeRequired > 0) {
        const decoded: DecodedAddress = CryptoUtils().decodeAddress(changeAddress);

        for (const denomination of splitAmountIntoDenominations(changeRequired)) {
            transfers.push({
                amount: denomination,
                keys: decoded,
            });
        }
    }

    const ourOutputs: Output[] = inputs.map((input) => {

        const [keyImage, tmpSecretKey] = CryptoUtils().generateKeyImage(
            input.input.transactionPublicKey,
            subWallets.getPrivateViewKey(),
            input.publicSpendKey,
            input.privateSpendKey,
            input.input.transactionIndex,
        );

        return {
            amount: input.input.amount,
            globalIndex: input.input.globalOutputIndex as number,
            index: input.input.transactionIndex,
            input: {
                privateEphemeral: tmpSecretKey,
            },
            key: input.input.key,
            keyImage: keyImage,
        };
    });

    const randomOuts: WalletError | RandomOutput[][] = await getRingParticipants(
        inputs, mixin, daemon,
    );

    if (randomOuts instanceof WalletError) {
        return [undefined, randomOuts as WalletError];
    }

    let tx: CreatedTransaction;

    try {
        tx = await CryptoUtils().createTransactionAsync(
            transfers, ourOutputs, randomOuts as RandomOutput[][], mixin, fee,
            paymentID,
        );
    } catch (err) {
        logger.log(
            'Failed to create transaction: ' + err.toString(),
            LogLevel.ERROR,
            LogCategory.TRANSACTIONS,
        );

        return [undefined, new WalletError(WalletErrorCode.UNKNOWN_ERROR, err.toString())];
    }

    /* Check the transaction isn't too large to fit in a block */
    const tooBigErr: WalletError = isTransactionPayloadTooBig(
        tx.rawTransaction, daemon.getNetworkBlockCount(),
    );

    if (!deepEqual(tooBigErr, SUCCESS)) {
        return [undefined, tooBigErr];
    }

    /* Check all the output amounts are members of 'PRETTY_AMOUNTS', otherwise
       they will not be mixable */
    if (!verifyAmounts(tx.transaction.vout)) {
        return [undefined, new WalletError(WalletErrorCode.AMOUNTS_NOT_PRETTY)];
    }

    if (!verifyTransactionFee(tx.transaction, fee)) {
        return [undefined, new WalletError(WalletErrorCode.UNEXPECTED_FEE)];
    }

    let relaySuccess: boolean;

    try {
        relaySuccess = await daemon.sendTransaction(tx.rawTransaction);

    /* Timeout */
    } catch (err) {
        return [undefined, new WalletError(WalletErrorCode.DAEMON_OFFLINE)];
    }

    if (!relaySuccess) {
        return [undefined, new WalletError(WalletErrorCode.DAEMON_ERROR)];
    }

    /* Store the unconfirmed transaction, update our balance */
    storeSentTransaction(
        tx.hash, fee, paymentID, inputs, changeAddress, changeRequired,
        subWallets,
    );

    /* Update our locked balanced with the incoming funds */
    storeUnconfirmedIncomingInputs(
        subWallets, tx.transaction.vout, tx.transaction.transactionKeys.publicKey, tx.hash,
    );

    subWallets.storeTxPrivateKey(tx.transaction.transactionKeys.privateKey, tx.hash);

    /* Lock the input for spending till confirmed/cancelled */
    for (const input of inputs) {
        subWallets.markInputAsLocked(input.publicSpendKey, input.input.keyImage);
    }

    return [tx.hash, undefined];
}

function storeSentTransaction(
    hash: string,
    fee: number,
    paymentID: string,
    ourInputs: TxInputAndOwner[],
    changeAddress: string,
    changeRequired: number,
    subWallets: SubWallets): void {

    const transfers: Map<string, number> = new Map();

    for (const input of ourInputs) {
        /* Amounts we have spent, subtract them from the transfers map */
        transfers.set(
            input.publicSpendKey,
            -input.input.amount + (transfers.get(input.publicSpendKey) || 0),
        );
    }

    if (changeRequired !== 0) {
        const [publicViewKey, publicSpendKey] = addressToKeys(changeAddress);

        transfers.set(
            publicSpendKey,
            changeRequired + (transfers.get(publicSpendKey) || 0),
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
}

function storeUnconfirmedIncomingInputs(
    subWallets: SubWallets,
    keyOutputs: Vout[],
    txPublicKey: string,
    txHash: string): void {

    const derivation: string = CryptoUtils().generateKeyDerivation(
        txPublicKey, subWallets.getPrivateViewKey(),
    );

    const spendKeys: string[] = subWallets.getPublicSpendKeys();

    let outputIndex: number = 0;

    for (const output of keyOutputs) {
        /* Derive the spend key from the transaction, using the previous
           derivation */
        const derivedSpendKey = CryptoUtils().underivePublicKey(
            derivation, outputIndex, output.target.data,
        );

        /* See if the derived spend key matches any of our spend keys */
        if (!_.includes(spendKeys, derivedSpendKey)) {
            continue;
        }

        const input: UnconfirmedInput = new UnconfirmedInput(
            output.amount, output.target.data, txHash,
        );

        subWallets.storeUnconfirmedIncomingInput(input, derivedSpendKey);

        outputIndex++;
    }
}

/**
 * Verify the transaction is small enough to fit in a block
 */
function isTransactionPayloadTooBig(
    rawTransaction: string,
    currentHeight: number): WalletError {

    /* Divided by two because it's represented as hex */
    const txSize: number = rawTransaction.length / 2;

    const maxTxSize: number = getMaxTxSize(currentHeight);

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

    for (const input of transaction.vin) {
        inputTotal += input.amount;
    }

    for (const output of transaction.vout) {
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
    daemon: IDaemon): Promise<WalletError | RandomOutput[][]> {

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
                `(${prettyPrintAmount(amount)}). Further explanation here: ` +
                `https://gist.github.com/zpalmtree/80b3e80463225bcfb8f8432043cb594c`,
            );
        }

        const [, outputs] = foundOutputs;

        if (outputs.length < mixin) {
            return new WalletError(
                WalletErrorCode.NOT_ENOUGH_FAKE_OUTPUTS,
                `Failed to get enough matching outputs for amount ${amount} ` +
                `(${prettyPrintAmount(amount)}). Needed outputs: ${mixin} ` +
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
                `(${prettyPrintAmount(amount)}). Needed outputs: ${mixin} ` +
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
    subWallets: SubWallets) {

    /* Validate the destinations are valid */
    let error: WalletError = validateDestinations(destinations);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    /* Validate stored payment ID's in integrated addresses don't conflict */
    error = validateIntegratedAddresses(destinations, paymentID);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    /* Verify the subwallets to take from exist */
    error = validateOurAddresses(subWalletsToTakeFrom, subWallets);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    /* Verify we have enough money for the transaction */
    error = validateAmount(destinations, fee, subWalletsToTakeFrom, subWallets, currentHeight);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    /* Validate mixin is within the bounds for the current height */
    error = validateMixin(mixin, currentHeight);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    error = validatePaymentID(paymentID);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    error = validateOurAddresses([changeAddress], subWallets);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    return SUCCESS;
}
