// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

import request = require('request-promise-native');

import { IDaemon } from './IDaemon';
import { LogCategory, logger, LogLevel } from './Logger';
import { Block } from './Types';
import { validateAddresses } from './ValidateParameters';
import { WalletError, WalletErrorCode } from './WalletError';

import config from './Config';

/**
 * Implements the daemon interface, talking to a standard TurtleCoind.
 */
export class BlockchainCacheApi implements IDaemon {

    /**
     * The base URL for our API. Shouldn't have a trailing '/'.
     */
    private cacheBaseURL: string = '';

    /**
     * Whether we should use https for our requests
     */
    private ssl: boolean = true;

    /**
     * The address node fees will go to
     */
    private feeAddress: string = '';

    /**
     * The amount of the node fee in atomic units
     */
    private feeAmount: number = 0;

    /**
     * The amount of blocks the daemon we're connected to has
     */
    private localDaemonBlockCount = 0;

    /**
     * The amount of blocks the network has
     */
    private networkBlockCount = 0;

    /**
     * The amount of peers we have, incoming+outgoing
     */
    private peerCount = 0;

    /**
     * The hashrate of the last known local block
     */
    private lastKnownHashrate = 0;

    /**
     * @param cacheBaseURL  The base URL for our API. Shouldn't have a trailing '/'
     * @param ssl           Should we use https? Defaults to true.
     *
     * Example usage:
     * ```
     * const daemon = new BlockchainCacheApi('blockapi.turtlepay.io', true);
     * ```
     */
    constructor(cacheBaseURL: string, ssl: boolean = true) {
        this.cacheBaseURL = cacheBaseURL;
        this.ssl = ssl;
    }

    /**
     * Get the amount of blocks the network has
     */
    public getNetworkBlockCount(): number {
        return this.networkBlockCount;
    }

    /**
     * Get the amount of blocks the daemon we're connected to has
     */
    public getLocalDaemonBlockCount(): number {
        return this.localDaemonBlockCount;
    }

    /**
     * Initialize the daemon and the fee info
     */
    public async init(): Promise<void> {
        /* Note - if one promise throws, the other will be cancelled */
        await Promise.all([this.updateDaemonInfo(), this.updateFeeInfo()]);
    }

    /**
     * Update the daemon info
     */
    public async updateDaemonInfo(): Promise<void> {
        let info;

        try {
            info = await this.makeGetRequest('/info');
        } catch (err) {
            logger.log(
                'Failed to update daemon info: ' + err.toString(),
                LogLevel.INFO,
                [LogCategory.DAEMON],
            );

            return;
        }

        this.localDaemonBlockCount = info.height;
        this.networkBlockCount = info.network_height;

        /* Height returned is one more than the current height - but we
           don't want to overflow is the height returned is zero */
        if (this.networkBlockCount !== 0) {
            this.networkBlockCount--;
        }

        this.peerCount = info.incoming_connections_count + info.outgoing_connections_count;

        this.lastKnownHashrate = info.difficulty / config.blockTargetTime;
    }

    /**
     * Get the node fee and address
     */
    public nodeFee(): [string, number] {
        return [this.feeAddress, this.feeAmount];
    }

    /**
     * @param blockHashCheckpoints  Hashes of the last known blocks. Later
     *                              blocks (higher block height) should be
     *                              ordered at the front of the array.
     *
     * @param startHeight           Height to start taking blocks from
     * @param startTimestamp        Block timestamp to start taking blocks from
     *
     * Gets blocks from the daemon. Blocks are returned starting from the last
     * known block hash (if higher than the startHeight/startTimestamp)
     */
    public async getWalletSyncData(
        blockHashCheckpoints: string[],
        startHeight: number,
        startTimestamp: number): Promise<Block[]> {

        let data;

        try {
            data = await this.makePostRequest('/getwalletsyncdata', {
                blockHashCheckpoints,
                startHeight,
                startTimestamp,
            });
        } catch (err) {
            logger.log(
                'Failed to get wallet sync data: ' + err.toString(),
                LogLevel.INFO,
                [LogCategory.DAEMON],
            );

            return [];
        }

        return data.items.map(Block.fromJSON);
    }

    /**
     * @returns Returns a mapping of transaction hashes to global indexes
     *
     * Get global indexes for the transactions in the range
     * [startHeight, endHeight]
     */
    public async getGlobalIndexesForRange(
        startHeight: number,
        endHeight: number): Promise<Map<string, number[]>> {

        throw new Error(
            'This call is not supported on the cache api. The cache API ' +
            'returns global indexes directly from /getWalletSyncData',
        );
    }

    public async getCancelledTransactions(transactionHashes: string[]): Promise<string[]> {
        /*
        const data = await this.daemon.getTransactionsStatus({
            transactionHashes,
        });

        return data.transactionsUnknown || [];
        */
        return [];
    }

    /**
     * Gets random outputs for the given amounts. requestedOuts per. Usually mixin+1.
     *
     * @returns Returns an array of amounts to global indexes and keys. There
     *          should be requestedOuts indexes if the daemon fully fulfilled
     *          our request.
     */
    public async getRandomOutputsByAmount(
        amounts: number[],
        requestedOuts: number): Promise<Array<[number, Array<[number, string]>]>> {

        let data;

        try {
            data = await this.makePostRequest('/randomOutputs', {
                amounts: amounts,
                mixin: requestedOuts,
            });
        } catch (err) {
            logger.log(
                'Failed to get random outs: ' + err.toString(),
                LogLevel.ERROR,
                [LogCategory.TRANSACTIONS, LogCategory.DAEMON],
            );

            return [];
        }

        const outputs: Array<[number, Array<[number, string]>]> = [];

        for (const output of data) {
            const indexes: Array<[number, string]> = [];

            for (const outs of output.outs) {
                indexes.push([outs.global_amount_index, outs.out_key]);
            }

            /* Sort by output index to make it hard to determine real one */
            outputs.push([output.amount, _.sortBy(indexes, ([index, key]) => index)]);
        }

        return outputs;
    }

    public async sendTransaction(rawTransaction: string): Promise<boolean> {
        const result = await this.makePostRequest('/sendrawtransaction', {
            tx_as_hex: rawTransaction,
        });

        return result.status === 'OK';
    }

    /**
     * Update the fee address and amount
     */
    private async updateFeeInfo(): Promise<void> {
        let feeInfo;

        try {
            feeInfo = await this.makeGetRequest('/fee');
        } catch (err) {
            logger.log(
                'Failed to update fee info: ' + err.toString(),
                LogLevel.INFO,
                [LogCategory.DAEMON],
            );
            return;
        }

        if (feeInfo.address === '') {
            return;
        }

        const integratedAddressesAllowed: boolean = false;

        const err: WalletErrorCode = validateAddresses(
            new Array(feeInfo.address), integratedAddressesAllowed,
        ).errorCode;

        if (err !== WalletErrorCode.SUCCESS) {
            logger.log(
                'Failed to validate address from daemon fee info: ' + err.toString(),
                LogLevel.WARNING,
                [LogCategory.DAEMON],
            );

            return;
        }

        if (feeInfo.amount > 0) {
            this.feeAddress = feeInfo.address;
            this.feeAmount = feeInfo.amount;
        }
    }

    /**
     * Makes a get request to the given endpoint
     */
    private makeGetRequest(endpoint: string): request.RequestPromise<any> {
        return request({
            json: true,
            method: 'GET',
            timeout: config.requestTimeout,
            url: (this.ssl ? 'https://' : 'http://') + this.cacheBaseURL + endpoint,
        });
    }

    /**
     * Makes a post request to the given endpoint with the given body
     */
    private makePostRequest(endpoint: string, body: any): request.RequestPromise<any> {
        return request({
            body: body,
            json: true,
            method: 'POST',
            timeout: config.requestTimeout,
            url: (this.ssl ? 'https://' : 'http://') + this.cacheBaseURL + endpoint,
        });
    }
}
