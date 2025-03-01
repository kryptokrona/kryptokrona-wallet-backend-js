// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

import axios, { AxiosRequestConfig, AxiosError } from 'axios';

import { EventEmitter } from 'events';

import {
    Block as UtilsBlock,
    Transaction as UtilsTransaction,
    TransactionOutputs,
    TransactionInputs
} from 'kryptokrona-utils';

import * as http from 'http';
import * as https from 'https';

import { assertString, assertNumber, assertBooleanOrUndefined } from './Assert';
import { Config, IConfig, MergeConfig } from './Config';
import { validateAddresses } from './ValidateParameters';
import { LogCategory, logger, LogLevel } from './Logger';
import { WalletErrorCode } from './WalletError';

import {
    Block, TopBlock, DaemonType, DaemonConnection, RawCoinbaseTransaction,
    RawTransaction, KeyOutput, KeyInput
} from './Types';

export declare interface Daemon {
    /**
     * This is emitted whenever the interface fails to contact the underlying daemon.
     * This event will only be emitted on the first disconnection. It will not
     * be emitted again, until the daemon connects, and then disconnects again.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('disconnect', (error) => {
     *     console.log('Possibly lost connection to daemon: ' + error.toString());
     * });
     * ```
     *
     * @event This is emitted whenever the interface fails to contact the underlying daemon.
     */
    on(event: 'disconnect', callback: (error: Error) => void): this;

    /**
     * This is emitted whenever the interface previously failed to contact the
     * underlying daemon, and has now reconnected.
     * This event will only be emitted on the first connection. It will not
     * be emitted again, until the daemon disconnects, and then reconnects again.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('connect', () => {
     *     console.log('Regained connection to daemon!');
     * });
     * ```
     *
     * @event This is emitted whenever the interface previously failed to contact the underlying daemon, and has now reconnected.
     */
    on(event: 'connect', callback: () => void): this;

    /**
     * This is emitted whenever either the localDaemonBlockCount or the networkDaemonBlockCount
     * changes.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('heightchange', (localDaemonBlockCount, networkDaemonBlockCount) => {
     *     console.log(localDaemonBlockCount, networkDaemonBlockCount);
     * });
     * ```
     *
     * @event This is emitted whenever either the localDaemonBlockCount or the networkDaemonBlockCount changes
     */
    on(event: 'heightchange',
       callback: (localDaemonBlockCount: number, networkDaemonBlockCount: number) => void,
    ): this;

    /**
     * This is emitted every time we download a block from the daemon. Will
     * only be emitted if the daemon is using /getrawblocks (All non blockchain
     * cache daemons should support this).
     *
     * This block object is an instance of the [Block turtlecoin-utils class](https://utils.turtlecoin.dev/classes/block.html).
     * See the Utils docs for further info on using this value.
     *
     * Note that a block emitted after a previous one could potentially have a lower
     * height, if a blockchain fork took place.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('rawblock', (block) => {
     *      console.log(`Downloaded new block ${block.hash}`);
     * });
     * ```
     *
     * @event This is emitted every time we download a block from the daemon
     */
    on(event: 'rawblock', callback: (block: UtilsBlock) => void): this;

    /**
     * This is emitted every time we download a transaction from the daemon. Will
     * only be emitted if the daemon is using /getrawblocks (All non blockchain
     * cache daemons should support this).
     *
     * This transaction object is an instance of the [Transaction turtlecoin-utils class](https://utils.turtlecoin.dev/classes/transaction.html).
     * See the Utils docs for further info on using this value.
     *
     * Note that a transaction emitted after a previous one could potentially have a lower
     * height in the chain, if a blockchain fork took place.
     *
     * Example:
     *
     * ```javascript
     * daemon.on('rawtransaction', (block) => {
     *      console.log(`Downloaded new transaction ${transaction.hash}`);
     * });
     * ```
     *
     * @event This is emitted every time we download a transaction from the daemon
     */
    on(event: 'rawtransaction', callback: (transaction: UtilsTransaction) => void): this;
}

/**
 * @noInheritDoc
 */
export class Daemon extends EventEmitter {
    /**
     * Daemon/API host
     */
    private readonly host: string;

    /**
     * Daemon/API port
     */
    private readonly port: number;

    /**
     * Whether we should use https for our requests
     */
    private ssl: boolean = true;

    /**
     * Have we determined if we should be using ssl or not?
     */
    private sslDetermined: boolean = false;

    /**
     * Whether we're talking to a conventional daemon, or a blockchain cache API
     */
    private isCacheApi: boolean = false;

    /**
     * Have we determined if this is a cache API or not?
     */
    private isCacheApiDetermined: boolean = false;

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
    private localDaemonBlockCount: number = 0;

    /**
     * The amount of blocks the network has
     */
    private networkBlockCount: number = 0;

    /**
     * The amount of peers we have, incoming+outgoing
     */
    private peerCount: number = 0;

    /**
     * The hashrate of the last known local block
     */
    private lastKnownHashrate: number = 0;

    /**
     * The number of blocks to download per /getwalletsyncdata request
     */
    private blockCount: number = 100;

    /**
     * Should we use /getrawblocks instead of /getwalletsyncdata
     */
    private useRawBlocks = false;

    private config: Config = new Config();

    private httpAgent: http.Agent = new http.Agent({
        keepAlive: true,
        keepAliveMsecs: 20000,
        maxSockets: Infinity,
    });

    private httpsAgent: https.Agent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 20000,
        maxSockets: Infinity,
    });

    /**
     * Last time the network height updated. If this goes over the configured
     * limit, we'll emit deadnode.
     */
    private lastUpdatedNetworkHeight: Date = new Date();

    /**
     * Last time the daemon height updated. If this goes over the configured
     * limit, we'll emit deadnode.
     */
    private lastUpdatedLocalHeight: Date = new Date();

    /**
     * Did our last contact with the daemon succeed. Set to true initially
     * so initial failure to connect will fire disconnect event.
     */
    private connected: boolean = true;

    /**
     * @param host The host to access the API on. Can be an IP, or a URL, for
     *             example, 1.1.1.1, or blockapi.turtlepay.io
     *
     * @param port The port to access the API on. Normally 11898 for a TurtleCoin
     *             daemon, 80 for a HTTP api, or 443 for a HTTPS api.
     *
     * @param isCacheApi You can optionally specify whether this API is a
     *                   blockchain cache API to save a couple of requests.
     *                   If you're not sure, do not specify this parameter -
     *                   we will work it out automatically.
     *
     * @param ssl        You can optionally specify whether this API supports
     *                   ssl/tls/https to save a couple of requests.
     *                   If you're not sure, do not specify this parameter -
     *                   we will work it out automatically.
     */
    constructor(host: string, port: number, isCacheApi?: boolean, ssl?: boolean) {
        super();

        this.setMaxListeners(0);

        assertString(host, 'host');
        assertNumber(port, 'port');
        assertBooleanOrUndefined(isCacheApi, 'isCacheApi');
        assertBooleanOrUndefined(ssl, 'ssl');

        this.host = host;
        this.port = port;

        /* Raw IP's very rarely support SSL. This fixes the warning from
           https://github.com/nodejs/node/pull/23329 */
        if (/^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(this.host) && ssl === undefined) {
            ssl = false;
        }

        if (isCacheApi !== undefined) {
            this.isCacheApi = isCacheApi;
            this.isCacheApiDetermined = true;
        }

        if (ssl !== undefined) {
            this.ssl = ssl;
            this.sslDetermined = true;
        }
    }

    public updateConfig(config: IConfig) {
        this.config = MergeConfig(config);
        this.blockCount = this.config.blocksPerDaemonRequest;
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

        if (this.networkBlockCount === 0) {
            this.emit('deadnode');
        }
    }

    /**
     * Update the daemon info
     */
    public async updateDaemonInfo(): Promise<void> {
        let info;

        const haveDeterminedSsl = this.sslDetermined;

        try {
            info = await this.makeGetRequest('/info');
        } catch (err) {
            logger.log(
                'Failed to update daemon info: ' + err.toString(),
                LogLevel.INFO,
                [LogCategory.DAEMON],
            );

            const diff1 = (new Date().getTime() - this.lastUpdatedNetworkHeight.getTime()) / 1000;
            const diff2 = (new Date().getTime() - this.lastUpdatedLocalHeight.getTime()) / 1000;

            if (diff1 > this.config.maxLastUpdatedNetworkHeightInterval
             || diff2 > this.config.maxLastUpdatedLocalHeightInterval) {
                this.emit('deadnode');
            }

            return;
        }

        /* Possibly determined daemon type was HTTPS, got a valid response,
           but not valid data. Manually set to http and try again. */
        if (info.height === undefined && !haveDeterminedSsl) {
            this.sslDetermined = true;
            this.ssl = false;

            const diff1 = (new Date().getTime() - this.lastUpdatedNetworkHeight.getTime()) / 1000;
            const diff2 = (new Date().getTime() - this.lastUpdatedLocalHeight.getTime()) / 1000;

            if (diff1 > this.config.maxLastUpdatedNetworkHeightInterval
             || diff2 > this.config.maxLastUpdatedLocalHeightInterval) {
                this.emit('deadnode');
            }

            return this.updateDaemonInfo();
        }

        /* Are we talking to a cache API or not? */
        if (!this.isCacheApiDetermined) {
            if (info.isCacheApi !== undefined && _.isBoolean(info.isCacheApi)) {
                this.isCacheApi = info.isCacheApi;
                this.isCacheApiDetermined = true;
            } else {
                this.isCacheApi = false;
                this.isCacheApiDetermined = true;
            }
        }

        /* Height returned is one more than the current height - but we
           don't want to overflow if the height returned is zero */
        if (info.network_height !== 0) {
            info.network_height--;
        }

        if (this.localDaemonBlockCount !== info.height
         || this.networkBlockCount !== info.network_height) {
            this.emit('heightchange', info.height, info.network_height);

            this.lastUpdatedNetworkHeight = new Date();
            this.lastUpdatedLocalHeight = new Date();
        } else {
            const diff1 = (new Date().getTime() - this.lastUpdatedNetworkHeight.getTime()) / 1000;
            const diff2 = (new Date().getTime() - this.lastUpdatedLocalHeight.getTime()) / 1000;

            if (diff1 > this.config.maxLastUpdatedNetworkHeightInterval
             || diff2 > this.config.maxLastUpdatedLocalHeightInterval) {
                this.emit('deadnode');
            }
        }

        this.localDaemonBlockCount = info.height;
        this.networkBlockCount = info.network_height;

        this.peerCount = info.incoming_connections_count + info.outgoing_connections_count;

        this.lastKnownHashrate = info.difficulty / this.config.blockTargetTime;
    }

    /**
     * Get the node fee and address
     */
    public nodeFee(): [string, number] {
        return [this.feeAddress, this.feeAmount];
    }

    public async getPoolChanges(knownTxs: any[]) {
        const endpoint = "/get_pool_changes_lite"
        let data
        try {
            data = await this.makePostRequest(endpoint, {
                knownTxsIds: knownTxs,
            });
   
        logger.log(
            `Making pool changes request, got data ${JSON.stringify(data)}`,
            LogLevel.DEBUG,
            [LogCategory.DAEMON],
        );
        
        let json = data
        json = JSON.stringify(json)
        .replaceAll('transactionPrefixInfo.txPrefix', 'transactionPrefixInfo')
        .replaceAll('transactionPrefixInfo.txHash', 'transactionPrefixInfotxHash')
        const parsed = JSON.parse(json)
        if (parsed.addedTxs.length === 0) return false
        return parsed
        
        } catch (err) {
            return false
        }

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
        startTimestamp: number): Promise<[Block[], TopBlock | boolean]> {

        const endpoint: string = this.useRawBlocks ? '/getrawblocks' : '/getwalletsyncdata';

        let data;

        try {
            data = await this.makePostRequest(endpoint, {
                blockCount: this.blockCount,
                blockHashCheckpoints,
                skipCoinbaseTransactions: !this.config.scanCoinbaseTransactions,
                startHeight,
                startTimestamp,
            });
        } catch (err) {
            this.blockCount = Math.ceil(this.blockCount / 4);

            /* Daemon doesn't support /getrawblocks, full back to /getwalletsyncdata */
            if (err.statusCode === 404 && this.useRawBlocks) {
                logger.log(
                    `Daemon responded 404 to /getrawblocks, reverting to /getwalletsyncdata`,
                    LogLevel.DEBUG,
                    [LogCategory.DAEMON],
                );

                this.useRawBlocks = false;

                return this.getWalletSyncData(
                    blockHashCheckpoints,
                    startHeight,
                    startTimestamp,
                );
            }

            logger.log(
                `Failed to get wallet sync data: ${err.toString()}. Lowering block count to ${this.blockCount}`,
                LogLevel.INFO,
                [LogCategory.DAEMON],
            );

            return [[], false];
        }

        /* The node is not dead if we're fetching blocks. */
        if (data.items.length >= 0) {
            logger.log(
                `Fetched ${data.items.length} blocks from the daemon`,
                LogLevel.DEBUG,
                [LogCategory.DAEMON],
            );

            if (this.blockCount !== this.config.blocksPerDaemonRequest) {
                this.blockCount = Math.min(this.config.blocksPerDaemonRequest, this.blockCount * 2);

                logger.log(
                    `Successfully fetched sync data, raising block count to ${this.blockCount}`,
                    LogLevel.DEBUG,
                    [LogCategory.DAEMON],
                );
            }

            this.lastUpdatedNetworkHeight = new Date();
            this.lastUpdatedLocalHeight = new Date();
        }

        if (data.synced && data.topBlock && data.topBlock.height && data.topBlock.hash) {
            if (this.useRawBlocks) {
                return [await this.rawBlocksToBlocks(data.items), data.topBlock];
            } else {
                return [data.items.map(Block.fromJSON), data.topBlock];
            }
        }

        if (this.useRawBlocks) {
            return [await this.rawBlocksToBlocks(data.items), true];
        } else {
            return [data.items.map(Block.fromJSON), true];
        }
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

        if (this.isCacheApi) {
            throw new Error(
                'This call is not supported on the cache api. The cache API ' +
                'returns global indexes directly from /getWalletSyncData',
            );
        }

        try {
            const data = await this.makePostRequest('/get_global_indexes_for_range', {
                endHeight,
                startHeight,
            });

            const indexes: Map<string, number[]> = new Map();

            for (const index of data.indexes) {
                indexes.set(index.key, index.value);
            }

            return indexes;
        } catch (err) {
            logger.log(
                'Failed to get global indexes: ' + err.toString(),
                LogLevel.ERROR,
                LogCategory.DAEMON,
            );

            return new Map();
        }
    }

    public async getCancelledTransactions(transactionHashes: string[]): Promise<string[]> {
        try {
            const data = await this.makePostRequest('/get_transactions_status', {
                transactionHashes,
            });

            return data.transactionsUnknown || [];
        } catch (err) {
            logger.log(
                'Failed to get transactions status: ' + err.toString(),
                LogLevel.ERROR,
                LogCategory.DAEMON,
            );

            return [];
        }
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
        requestedOuts: number): Promise<[number, [number, string][]][]> {

        let data;

        try {
            if (this.isCacheApi) {
                data = await this.makePostRequest('/randomOutputs', {
                    amounts: amounts,
                    mixin: requestedOuts,
                });
            } else {
                const tmp = await this.makePostRequest('/getrandom_outs', {
                    amounts: amounts,
                    outs_count: requestedOuts,
                });

                data = tmp.outs || [];
            }
        } catch (err) {
            logger.log(
                'Failed to get random outs: ' + err.toString(),
                LogLevel.ERROR,
                [LogCategory.TRANSACTIONS, LogCategory.DAEMON],
            );

            return [];
        }

        const outputs: [number, [number, string][]][] = [];

        for (const output of data) {
            const indexes: [number, string][] = [];

            for (const outs of output.outs) {
                indexes.push([outs.global_amount_index, outs.out_key]);
            }

            /* Sort by output index to make it hard to determine real one */
            outputs.push([output.amount, _.sortBy(indexes, ([index]) => index)]);
        }

        return outputs;
    }

    public async sendTransaction(rawTransaction: string): Promise<[boolean, string | undefined]> {
        const result = await this.makePostRequest('/sendrawtransaction', {
            tx_as_hex: rawTransaction,
        });

        /* Success. */
        if (result.status.toUpperCase() === 'OK') {
            return [true, undefined];
        }

        /* Fail, no extra error message. */
        if (!result || !result.status || !result.error) {
            return [false, undefined];
        }

        /* Fail, extra error message */
        return [false, result.error];
    }

    public getConnectionInfo(): DaemonConnection {
        return {
            daemonType: this.isCacheApi ? DaemonType.BlockchainCacheApi : DaemonType.ConventionalDaemon,
            daemonTypeDetermined: this.isCacheApiDetermined,
            host: this.host,
            port: this.port,
            ssl: this.ssl,
            sslDetermined: this.sslDetermined,
        };
    }

    public getConnectionString(): string {
        return this.host + ':' + this.port;
    }

    private async rawBlocksToBlocks(rawBlocks: any): Promise<Block[]> {
        const result: Block[] = [];

        for (const rawBlock of rawBlocks) {
            const block = await UtilsBlock.from(rawBlock.block, this.config);

            this.emit('rawblock', block);
            this.emit('rawtransaction', block.minerTransaction);

            let coinbaseTransaction: RawCoinbaseTransaction | undefined;

            if (this.config.scanCoinbaseTransactions) {
                const keyOutputs: KeyOutput[] = [];

                for (const output of block.minerTransaction.outputs) {
                    if (output.type === TransactionOutputs.OutputType.KEY) {
                        const o = output as TransactionOutputs.KeyOutput;

                        keyOutputs.push(new KeyOutput(
                            o.key,
                            o.amount.toJSNumber(),
                        ));
                    }
                }

                coinbaseTransaction = new RawCoinbaseTransaction(
                    keyOutputs,
                    await block.minerTransaction.hash(),
                    block.minerTransaction.publicKey!,
                    block.minerTransaction.unlockTime as number > Number.MAX_SAFE_INTEGER
                        ? (block.minerTransaction.unlockTime as any).toJSNumber()
                        : block.minerTransaction.unlockTime,
                );
            }

            const transactions: RawTransaction[] = [];

            for (const tx of rawBlock.transactions) {
                const rawTX = await UtilsTransaction.from(tx);

                this.emit('rawtransaction', tx);

                const keyOutputs: KeyOutput[] = [];
                const keyInputs: KeyInput[] = [];

                for (const output of rawTX.outputs) {
                    if (output.type === TransactionOutputs.OutputType.KEY) {
                        const o = output as TransactionOutputs.KeyOutput;

                        keyOutputs.push(new KeyOutput(
                            o.key,
                            o.amount.toJSNumber(),
                        ));
                    }
                }

                for (const input of rawTX.inputs) {
                    if (input.type === TransactionInputs.InputType.KEY) {
                        const i = input as TransactionInputs.KeyInput;

                        keyInputs.push(new KeyInput(
                            i.amount.toJSNumber(),
                            i.keyImage,
                            i.keyOffsets.map((x) => x.toJSNumber()),
                        ));
                    }
                }

                transactions.push(new RawTransaction(
                    keyOutputs,
                    await rawTX.hash(),
                    rawTX.publicKey!,
                    rawTX.unlockTime as number > Number.MAX_SAFE_INTEGER
                        ? (rawTX.unlockTime as any).toJSNumber()
                        : rawTX.unlockTime,
                    rawTX.paymentId || '',
                    keyInputs,
                ));
            }

            result.push(new Block(
                transactions,
                block.height,
                await block.hash(),
                Math.floor(block.timestamp.getTime() / 1000),
                coinbaseTransaction,
            ));
        }

        return result;
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

        const err: WalletErrorCode = (await validateAddresses(
            new Array(feeInfo.address), integratedAddressesAllowed, this.config,
        )).errorCode;

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

    private async makeGetRequest(endpoint: string): Promise<any> {
        return this.makeRequest(endpoint, 'get');
    }

    private async makePostRequest(endpoint: string, body: any): Promise<any> {
        return this.makeRequest(endpoint, 'post', body);
    }

    /**
     * Makes a get request to the given endpoint
     */
    private async makeRequest(endpoint: string, method: string, body?: any): Promise<any> {
        const options: AxiosRequestConfig = {
            method,
            data: body,
            timeout: this.config.requestTimeout,
        };

        try {
            /* Start by trying HTTPS if we haven't determined whether it's
            HTTPS or HTTP yet. */
            const protocol = this.sslDetermined ? (this.ssl ? 'https' : 'http') : 'https';
            const url: string = `${protocol}://${this.host}:${this.port}${endpoint}`;

            logger.log(
                `Making request to ${url} with params ${body ? JSON.stringify(body) : '{}'}`,
                LogLevel.TRACE,
                [LogCategory.DAEMON],
            );

            // const response = await axios({
            //     ...options,
            //     url,
            //     httpsAgent: protocol === 'https' ? this.httpsAgent : undefined,
            //     httpAgent: protocol === 'http' ? this.httpAgent : undefined,
            //     ...this.config.customRequestOptions,
            // });

            const response = await axios({
                ...options,
                url
              });

            /* Cool, HTTPS works. Store for later. */
            if (!this.sslDetermined) {
                this.ssl = true;
                this.sslDetermined = true;
            }

            if (!this.connected) {
                this.emit('connect');
                this.connected = true;
            }

            logger.log(
                `Got response from ${url} with body ${JSON.stringify(response.data)}`,
                LogLevel.TRACE,
                [LogCategory.DAEMON],
            );

            return response.data;
        } catch (err: any) {
            /* No point trying again with SSL - we already have decided what
            type it is. */
            if (this.sslDetermined) {
                if (this.connected) {
                    this.emit('disconnect', err);
                    this.connected = false;
                }
                throw err;
            }

            try {
                /* Let's try HTTP now. */
                const url: string = `http://${this.host}:${this.port}${endpoint}`;

                logger.log(
                    `Making request to ${url} with params ${body ? JSON.stringify(body) : '{}'}`,
                    LogLevel.TRACE,
                    [LogCategory.DAEMON],
                );

                const response = await axios({
                    ...options,
                    url
                });

                this.ssl = false;
                this.sslDetermined = true;

                if (!this.connected) {
                    this.emit('connect');
                    this.connected = true;
                }

                logger.log(
                    `Got response from ${url} with body ${JSON.stringify(response.data)}`,
                    LogLevel.TRACE,
                    [LogCategory.DAEMON],
                );

                return response.data;
            } catch (err: any) {
                this.emit('deadnode');
                if (this.connected) {
                    this.emit('disconnect', err);
                    this.connected = false;
                }
                throw err;
            }
        }
    }

}
