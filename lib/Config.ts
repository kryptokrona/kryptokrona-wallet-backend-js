// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

/* I'm gonna give an extended explanation of how mainLoopInterval,
   blockFetchInterval, and blocksPerTick interact here.
   As you may know, nodeJS is single threaded. When we run a function, it
   runs to completion and blocks any other functions waiting to be ran in
   a setTimeout/setInterval.

   Obviously we want to download and process blocks from the daemon. Processing
   blocks is somewhat slow, with it taking somewhere between 10 to 30 seconds
   to process 100 blocks.

   Obviously blocking the event loop for 10 seconds is very far from ideal -
   if we want an interactive UI, we need preferably sub second responses.

   A decent way to solve this is to fetch blocks, say, every second.
   (blockFetchInterval)
   Store these 100 blocks to process for later.

   Then, every mainLoopInterval (10 milliseconds), take blocksPerTick blocks
   from the queue, and process it. This should take less than a second,
   but potentially can be longer if we need to contact the daemon for global
   indexes. Either way, it should be pretty fast.

   Since we then timeout, any other code in the event loop waiting to run
   can proceed, for example user input.

   For my experiments, it seems like processing one block per tick is optimal.
   Depending on how many transactions are in the block, and how powerful your
   CPU is, 10 blocks can take a number of seconds. */

import { MixinLimit, MixinLimits } from './MixinLimits';

/**
 * Configuration for the wallet backend
 */
class Config {
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
    public mainLoopInterval: number = 10;

    /**
     * How often to fetch blocks from the daemon, in milliseconds
     */
    public blockFetchInterval: number = 1 * 1000;

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
}

export default new Config();
