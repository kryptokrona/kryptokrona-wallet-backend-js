// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { MixinLimit, MixinLimits } from './MixinLimits';

/**
 * Configuration for the wallet backend.
 *
 * Everything is optional.
 */
export interface IConfig {
    /**
     * The amount of decimal places your coin has, e.g. TurtleCoin has two
     * decimals
     */
    decimalPlaces?: number;

    /**
     * The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
     * In TurtleCoin, this converts to TRTL
     */
    addressPrefix?: number;

    /**
     * Request timeout for daemon operations in milliseconds
     */
    requestTimeout?: number;

    /**
     * The block time of your coin, in seconds
     */
    blockTargetTime?: number;

    /**
     * How often to process blocks, in millseconds
     */
    syncThreadInterval?: number;

    /**
     * How often to update the daemon info
     */
    daemonUpdateInterval?: number;

    /**
     * How often to check on locked transactions
     */
    lockedTransactionsCheckInterval?: number;

    /**
     * The amount of blocks to process per 'tick' of the mainloop. Note: too
     * high a value will cause the event loop to be blocked, and your interaction
     * to be laggy.
     */
    blocksPerTick?: number;

    /**
     * Your coins 'ticker', generally used to refer to the coin, i.e. 123 TRTL
     */
    ticker?: string;

    /**
     * Most people haven't mined any blocks, so lets not waste time scanning
     * them
     */
    scanCoinbaseTransactions?: boolean;

    /**
     * The minimum fee allowed for transactions, in ATOMIC units
     */
    minimumFee?: number;

    /**
     * Mapping of height to mixin maximum and mixin minimum
     */
    mixinLimits?: MixinLimits;

    /**
     * The length of a standard address for your coin
     */
    standardAddressLength?: number;

    /* The length of an integrated address for your coin - It's the same as
       a normal address, but there is a paymentID included in there - since
       payment ID's are 64 chars, and base58 encoding is done by encoding
       chunks of 8 chars at once into blocks of 11 chars, we can calculate
       this automatically */
    integratedAddressLength?: number;

    [key: string]: any;
}

/**
 * Configuration for the wallet backend
 *
 * @hidden
 */
class OurConfig implements IConfig {
    /**
     * The amount of decimal places your coin has, e.g. TurtleCoin has two
     * decimals
     */
    public decimalPlaces: number = 2;

    /**
     * The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
     * In TurtleCoin, this converts to TRTL
     */
    public addressPrefix: number = 3914525;

    /**
     * Request timeout for daemon operations in milliseconds
     */
    public requestTimeout: number = 10 * 1000;

    /**
     * The block time of your coin, in seconds
     */
    public blockTargetTime: number = 30;

    /**
     * How often to process blocks, in millseconds
     */
    public syncThreadInterval: number = 10;

    /**
     * How often to update the daemon info
     */
    public daemonUpdateInterval: number = 5 * 1000;

    /**
     * How often to check on locked transactions
     */
    public lockedTransactionsCheckInterval: number = 30 * 1000;

    /**
     * The amount of blocks to process per 'tick' of the mainloop. Note: too
     * high a value will cause the event loop to be blocked, and your interaction
     * to be laggy.
     */
    public blocksPerTick: number = 1;

    /**
     * Your coins 'ticker', generally used to refer to the coin, i.e. 123 TRTL
     */
    public ticker: string = 'TRTL';

    /**
     * Most people haven't mined any blocks, so lets not waste time scanning
     * them
     */
    public scanCoinbaseTransactions: boolean = false;

    /**
     * The minimum fee allowed for transactions, in ATOMIC units
     */
    public minimumFee: number = 10;

    /**
     * Mapping of height to mixin maximum and mixin minimum
     */
    public mixinLimits: MixinLimits = new MixinLimits([
        /* Height: 440,000, minMixin: 0, maxMixin: 100, defaultMixin: 3 */
        new MixinLimit(440000, 0, 100, 3),

        /* At height of 620000, static mixin of 7 */
        new MixinLimit(620000, 7),

        /* At height of 800000, static mixin of 3 */
        new MixinLimit(800000, 3),
    ], 3 /* Default mixin of 3 before block 440,000 */);

    /**
     * The length of a standard address for your coin
     */
    public standardAddressLength: number = 99;

    /* The length of an integrated address for your coin - It's the same as
       a normal address, but there is a paymentID included in there - since
       payment ID's are 64 chars, and base58 encoding is done by encoding
       chunks of 8 chars at once into blocks of 11 chars, we can calculate
       this automatically */
    public integratedAddressLength: number = this.standardAddressLength + ((64 * 11) / 8);

    [key: string]: any;
}

/**
 * @hidden
 */
export let Config: OurConfig = new OurConfig();

/**
 * Merge the default config with the provided config
 *
 * @hidden
 */
export function MergeConfig(config?: IConfig): void {
    const finalConfig = new OurConfig();

    if (!config) {
        return;
    }

    for (const [key, value] of Object.entries(config)) {
        if (finalConfig[key] !== undefined) {
            finalConfig[key] = value;
        }
    }

    Config = finalConfig;
}
