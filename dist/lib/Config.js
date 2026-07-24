"use strict";
// Copyright (C) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeConfig = exports.Config = void 0;
const MixinLimits_1 = require("./MixinLimits");
const version = require('../../package.json').version;
/**
 * Configuration for the wallet backend
 *
 * @hidden
 */
class Config {
    constructor() {
        /**
         * The amount of decimal places your coin has, e.g. TurtleCoin has two
         * decimals
         */
        this.decimalPlaces = 5;
        /**
         * The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
         * For kryptokrona, this converts to 'SEKR'.
         */
        this.addressPrefix = 2239254;
        /**
         * Request timeout for daemon operations in milliseconds
         */
        this.requestTimeout = 10 * 1000;
        /**
         * The block time of your coin, in seconds
         */
        this.blockTargetTime = 90;
        /**
         * How often to process blocks, in millseconds
         */
        this.syncThreadInterval = 100;
        /**
         * How often to update the daemon info
         */
        this.daemonUpdateInterval = 10 * 1000;
        /**
         * How often to check on locked transactions
         */
        this.lockedTransactionsCheckInterval = 30 * 1000;
        /**
         * The amount of blocks to process per 'tick' of the mainloop. Note: too
         * high a value will cause the event loop to be blocked, and your interaction
         * to be laggy.
         */
        this.blocksPerTick = 20;
        /**
         * Your coins 'ticker', generally used to refer to the coin, i.e. 123 TRTL
         */
        this.ticker = 'XKR';
        /**
         * Most people haven't mined any blocks, so lets not waste time scanning
         * them
         */
        this.scanCoinbaseTransactions = false;
        /**
         * Only some applications need to scan pool transactions
         *
         */
        this.scanPoolTransactions = true;
        /**
         * The minimum fee allowed for transactions, in ATOMIC units
         */
        this.minimumFee = 10;
        /* Fee per byte is rounded up in chunks. This helps makes estimates
         * more accurate. It's suggested to make this a power of two, to relate
         * to the underlying storage cost / page sizes for storing a transaction. */
        this.feePerByteChunkSize = 256;
        /* Fee to charge per byte of transaction. Will be applied in chunks, see
         * above. This value comes out to 1.953125. We use this value instead of
         * something like 2 because it makes for pretty resulting fees
         * - 5 TRTL vs 5.12 TRTL. You can read this as.. the fee per chunk
         * is 500 atomic units. The fee per byte is 500 / chunk size. */
        this.minimumFeePerByte = 500.00 / this.feePerByteChunkSize;
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
        /* The length of a standard/integrated address under the alternate address
           prefix. The legacy (SEKR) and new (Xkr) prefixes encode the same keys but
           their varints differ in length, so the address strings differ by one
           character. Both forms are accepted when validating so a prefix switch
           stays backwards compatible. See standardAddressLength / addressPrefix. */
        this.standardAddressLengthAlt = 98;
        this.integratedAddressLengthAlt = 98 + ((64 * 11) / 8);
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
         * A replacement function for the JS/C++ checkRingSignatures.
         */
        this.checkRingSignature = undefined;
        /**
         * A replacement function for the JS/C++ generateKeyDerivation.
         */
        this.generateKeyDerivation = undefined;
        /**
         * A replacement function for the JS/C++ scReduce32.
         */
        this.scReduce32 = undefined;
        /**
         * A replacement function for the JS/C++ checkKey.
         */
        this.checkKey = undefined;
        /**
         * A replacement function for the JS/C++ hashToEllipticCurve.
         */
        this.hashToEllipticCurve = undefined;
        /**
         * A replacement function for the JS/C++ generateSignature.
         */
        this.generateSignature = undefined;
        /**
         * A replacement function for the JS/C++ checkSignature.
         */
        this.checkSignature = undefined;
        /**
         * A replacement function for the JS/C++ hashToScalar.
         */
        this.hashToScalar = undefined;
        /**
        * A replacement function for the JS/C++ generateKeys.
        */
        this.generateKeys = undefined;
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
         * The amount of seconds to permit not having fetched a block from the
         * daemon before emitting 'deadnode'. Note that this just means contacting
         * the daemon for data - if you are synced and it returns TopBlock - the
         * event will not be emitted.
         */
        this.maxLastFetchedBlockInterval = 60 * 3;
        /**
         * The amount of seconds to permit not having fetched a new network height
         * from the daemon before emitting 'deadnode'.
         */
        this.maxLastUpdatedNetworkHeightInterval = 60 * 3;
        /**
         * The amount of seconds to permit not having fetched a new local height
         * from the daemon before emitting 'deadnode'.
         */
        this.maxLastUpdatedLocalHeightInterval = 60 * 3;
        /**
         * Allows setting a customer user agent string
         */
        this.customUserAgentString = `${this.ticker.toLowerCase()}-wallet-backend-${version}`;
        /**
         * Allows specifying a custom configuration object for the request module.
         */
        this.customRequestOptions = {};
    }
}
exports.Config = Config;
/**
 * Merge the default config with the provided config
 *
 * @hidden
 */
function MergeConfig(config, currentConfig = new Config()) {
    /* Clone the given config so we don't alter it */
    const finalConfig = Object.create(Object.getPrototypeOf(currentConfig), Object.getOwnPropertyDescriptors(currentConfig));
    if (!config) {
        return finalConfig;
    }
    for (const [key, value] of Object.entries(config)) {
        finalConfig[key] = value;
    }
    return finalConfig;
}
exports.MergeConfig = MergeConfig;
