import { MixinLimits } from './MixinLimits';
/**
 * Configuration for the wallet backend
 */
declare class Config {
    /**
     * The amount of decimal places your coin has, e.g. TurtleCoin has two
     * decimals
     */
    decimalPlaces: number;
    /**
     * The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
     * In TurtleCoin, this converts to TRTL
     */
    addressPrefix: number;
    /**
     * Request timeout for daemon operations in milliseconds
     */
    requestTimeout: number;
    /**
     * The block time of your coin, in seconds
     */
    blockTargetTime: number;
    /**
     * How often to process blocks, in millseconds
     */
    mainLoopInterval: number;
    /**
     * How often to fetch blocks from the daemon, in milliseconds
     */
    blockFetchInterval: number;
    /**
     * The amount of blocks to process per 'tick' of the mainloop. Note: too
     * high a value will cause the event loop to be blocked, and your interaction
     * to be laggy.
     */
    blocksPerTick: number;
    /**
     * Your coins 'ticker', generally used to refer to the coin, i.e. 123 TRTL
     */
    ticker: string;
    /**
     * Most people haven't mined any blocks, so lets not waste time scanning
     * them
     */
    scanCoinbaseTransactions: boolean;
    /**
     * The minimum fee allowed for transactions, in ATOMIC units
     */
    minimumFee: number;
    /**
     * Mapping of height to mixin maximum and mixin minimum
     */
    mixinLimits: MixinLimits;
    /**
     * The length of a standard address for your coin
     */
    standardAddressLength: number;
    integratedAddressLength: number;
}
declare const _default: Config;
export default _default;
