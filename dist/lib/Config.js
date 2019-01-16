"use strict";
// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
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
const MixinLimits_1 = require("./MixinLimits");
/**
 * Configuration for the wallet backend
 */
class Config {
    constructor() {
        /**
         * The amount of decimal places your coin has, e.g. TurtleCoin has two
         * decimals
         */
        this.decimalPlaces = 2;
        /**
         * The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
         * In TurtleCoin, this converts to TRTL
         */
        this.addressPrefix = 3914525;
        /**
         * Request timeout for daemon operations in milliseconds
         */
        this.requestTimeout = 10 * 1000;
        /**
         * The block time of your coin, in seconds
         */
        this.blockTargetTime = 30;
        /**
         * How often to process blocks, in millseconds
         */
        this.mainLoopInterval = 10;
        /**
         * How often to fetch blocks from the daemon, in milliseconds
         */
        this.blockFetchInterval = 1 * 1000;
        /**
         * The amount of blocks to process per 'tick' of the mainloop. Note: too
         * high a value will cause the event loop to be blocked, and your interaction
         * to be laggy.
         */
        this.blocksPerTick = 1;
        /**
         * Your coins 'ticker', generally used to refer to the coin, i.e. 123 TRTL
         */
        this.ticker = 'TRTL';
        /**
         * Most people haven't mined any blocks, so lets not waste time scanning
         * them
         */
        this.scanCoinbaseTransactions = false;
        /**
         * The minimum fee allowed for transactions, in ATOMIC units
         */
        this.minimumFee = 10;
        /**
         * Mapping of height to mixin maximum and mixin minimum
         */
        this.mixinLimits = new MixinLimits_1.MixinLimits([
            /* Height: 440,000, minMixin: 0, maxMixin: 100, defaultMixin: 3 */
            new MixinLimits_1.MixinLimit(440000, 0, 100, 3),
            /* At height of 620000, static mixin of 7 */
            new MixinLimits_1.MixinLimit(620000, 7),
            /* At height of 800000, static mixin of 3 */
            new MixinLimits_1.MixinLimit(800000, 3),
        ], 3 /* Default mixin of 3 before block 440,000 */);
        /**
         * The length of a standard address for your coin
         */
        this.standardAddressLength = 99;
        /* The length of an integrated address for your coin - It's the same as
           a normal address, but there is a paymentID included in there - since
           payment ID's are 64 chars, and base58 encoding is done by encoding
           chunks of 8 chars at once into blocks of 11 chars, we can calculate
           this automatically */
        this.integratedAddressLength = this.standardAddressLength + ((64 * 11) / 8);
    }
}
exports.default = new Config();
