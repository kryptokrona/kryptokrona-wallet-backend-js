"use strict";
// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const MixinLimits_1 = require("./MixinLimits");
/**
 * Configuration for the wallet backend
 *
 * @hidden
 */
class OurConfig {
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
        this.syncThreadInterval = 10;
        /**
         * How often to update the daemon info
         */
        this.daemonUpdateInterval = 5 * 1000;
        /**
         * How often to check on locked transactions
         */
        this.lockedTransactionsCheckInterval = 30 * 1000;
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
        this.integratedAddressLength = 99 + ((64 * 11) / 8);
        /**
         * A replacement function for the JS/C++ underivePublicKey.
         */
        this.underivePublicKey = undefined;
        /**
         * A replacement function for the JS/C++ derivePublicKey.
         */
        this.derivePublicKey = undefined;
        /**
         * A replacement function for the JS/C++ deriveSecretKey.
         */
        this.deriveSecretKey = undefined;
        /**
         * A replacement function for the JS/C++ generateKeyImage.
         */
        this.generateKeyImage = undefined;
        /**
         * A replacement function for the JS/C++ secretKeyToPublicKey.
         */
        this.secretKeyToPublicKey = undefined;
        /**
         * A replacement function for the JS/C++ cnFastHash.
         */
        this.cnFastHash = undefined;
        /**
         * A replacement function for the JS/C++ generateRingSignatures.
         */
        this.generateRingSignatures = undefined;
        /**
         * A replacement function for the JS/C++ generateKeyDerivation.
         */
        this.generateKeyDerivation = undefined;
        /**
         * The amount of memory to use storing downloaded blocks - 50MB
         */
        this.blockStoreMemoryLimit = 1024 * 1024 * 50;
        /**
         * The amount of blocks to take from the daemon per request. Cannot take
         * more than 100.
         */
        this.blocksPerDaemonRequest = 100;
        /**
         * Max size of a post body response - 50MB
         * Will decrease the amount of blocks requested from the daemon if this
         * is exceeded.
         */
        this.maxBodyResponseSize = 1024 * 1024 * 50;
    }
}
/**
 * @hidden
 */
exports.Config = new OurConfig();
/**
 * Merge the default config with the provided config
 *
 * @hidden
 */
function MergeConfig(config) {
    const finalConfig = new OurConfig();
    if (!config) {
        return;
    }
    for (const [key, value] of Object.entries(config)) {
        if (finalConfig[key] !== undefined) {
            finalConfig[key] = value;
        }
    }
    exports.Config = finalConfig;
}
exports.MergeConfig = MergeConfig;
