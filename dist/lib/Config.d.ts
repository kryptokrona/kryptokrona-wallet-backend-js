import { MixinLimits } from './MixinLimits';
import { IKeyPair } from 'kryptokrona-crypto';
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
     * Only some applications need to scan pool transactions
     *
     */
    scanPoolTransactions?: boolean;
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
    /**
     * The length of an integrated address for your coin - It's the same as
     * a normal address, but there is a paymentID included in there - since
     * payment ID's are 64 chars, and base58 encoding is done by encoding
     * chunks of 8 chars at once into blocks of 11 chars, we can calculate
     * this automatically
     */
    integratedAddressLength?: number;
    /**
     * The length of a standard address encoded under the alternate (legacy or
     * new) address prefix. Both prefixes encode the same keys but differ in
     * varint length, so the two address forms differ in string length by a
     * character; we accept both when validating. See addressPrefix.
     */
    standardAddressLengthAlt?: number;
    /**
     * The length of an integrated address encoded under the alternate address
     * prefix. See standardAddressLengthAlt.
     */
    integratedAddressLengthAlt?: number;
    /**
     * A replacement function for the JS/C++ underivePublicKey.
     */
    underivePublicKey?: (derivation: string, outputIndex: number, outputKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ derivePublicKey.
     */
    derivePublicKey?: (derivation: string, outputIndex: number, publicKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ deriveSecretKey.
     */
    deriveSecretKey?: (derivation: string, outputIndex: number, privateKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ generateKeyImage.
     */
    generateKeyImage?: (publicKey: string, privateKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ cnFastHash.
     */
    cnFastHash?: (input: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ generateRingSignatures.
     */
    generateRingSignatures?: (transactionPrefixHash: string, keyImage: string, inputKeys: string[], privateKey: string, realIndex: number) => Promise<string[]>;
    /**
     * A replacement function for the JS/C++ checkRingSignature.
     */
    checkRingSignature?: (transactionPrefixHash: string, keyImage: string, publicKeys: string[], signatures: string[]) => Promise<boolean>;
    /**
     * A replacement function for the JS/C++ generateKeyDerivation.
     */
    generateKeyDerivation?: (transactionPublicKey: string, privateViewKey: string) => Promise<string>;
    /**
* Converts a secret key to a public key.
*/
    secretKeyToPublicKey?: (secretKey: string) => Promise<string>;
    /**
     * Reduces a scalar to a 32-byte value.
     */
    scReduce32?: (scalar: string) => Promise<string>;
    /**
     * Checks the validity of a given key.
     */
    checkKey?: (key: string) => Promise<boolean>;
    /**
     * Maps a hash to an elliptic curve point.
     */
    hashToEllipticCurve?: (hash: string) => Promise<string>;
    /**
     * Generates a signature for a given message using the specified keys.
     */
    generateSignature?: (message: string, publicKey: string, privateKey: string) => Promise<string>;
    /**
     * Verifies the validity of a signature for a message.
     */
    checkSignature?: (message: string, publicKey: string, signature: string) => Promise<boolean>;
    /**
     * Maps a hash to a scalar value.
     */
    hashToScalar?: (hash: string) => Promise<string>;
    /**
     * Generate a keypair.
     */
    generateKeys?: () => Promise<IKeyPair>;
    /**
     * The max amount of memory to use, storing downloaded blocks to be processed.
     */
    blockStoreMemoryLimit?: number;
    /**
     * The amount of blocks to take from the daemon per request. Cannot take
     * more than 100.
     */
    blocksPerDaemonRequest?: number;
    /**
     * The amount of seconds to permit not having fetched a block from the
     * daemon before emitting 'deadnode'. Note that this just means contacting
     * the daemon for data - if you are synced and it returns TopBlock - the
     * event will not be emitted.
     */
    maxLastFetchedBlockInterval?: number;
    /**
     * The amount of seconds to permit not having fetched a new network height
     * from the daemon before emitting 'deadnode'.
     */
    maxLastUpdatedNetworkHeightInterval?: number;
    /**
     * The amount of seconds to permit not having fetched a new local height
     * from the daemon before emitting 'deadnode'.
     */
    maxLastUpdatedLocalHeightInterval?: number;
    /**
     * Allows specifying a custom user agent string to use with requests.
     */
    customUserAgentString?: string;
    /**
     * Allows specifying a custom configuration object for the request module.
     */
    customRequestOptions?: any;
    [key: string]: any;
}
/**
 * Configuration for the wallet backend
 *
 * @hidden
 */
export declare class Config implements IConfig {
    /**
     * The amount of decimal places your coin has, e.g. TurtleCoin has two
     * decimals
     */
    decimalPlaces: number;
    /**
     * The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
     * For kryptokrona, this converts to 'SEKR'.
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
    syncThreadInterval: number;
    /**
     * How often to update the daemon info
     */
    daemonUpdateInterval: number;
    /**
     * How often to check on locked transactions
     */
    lockedTransactionsCheckInterval: number;
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
     * Only some applications need to scan pool transactions
     *
     */
    scanPoolTransactions: boolean;
    /**
     * The minimum fee allowed for transactions, in ATOMIC units
     */
    minimumFee: number;
    feePerByteChunkSize: number;
    minimumFeePerByte: number;
    /**
     * Mapping of height to mixin maximum and mixin minimum
     */
    mixinLimits: MixinLimits;
    /**
     * The length of a standard address for your coin
     */
    standardAddressLength: number;
    integratedAddressLength: number;
    standardAddressLengthAlt: number;
    integratedAddressLengthAlt: number;
    /**
     * A replacement function for the JS/C++ underivePublicKey.
     */
    underivePublicKey?: (derivation: string, outputIndex: number, outputKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ derivePublicKey.
     */
    derivePublicKey?: (derivation: string, outputIndex: number, publicKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ deriveSecretKey.
     */
    deriveSecretKey?: (derivation: string, outputIndex: number, privateKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ generateKeyImage.
     */
    generateKeyImage?: (publicKey: string, privateKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ secretKeyToPublicKey.
     */
    secretKeyToPublicKey?: (privateKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ cnFastHash.
     */
    cnFastHash?: (input: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ generateRingSignatures.
     */
    generateRingSignatures?: (transactionPrefixHash: string, keyImage: string, inputKeys: string[], privateKey: string, realIndex: number) => Promise<string[]>;
    /**
     * A replacement function for the JS/C++ checkRingSignatures.
     */
    checkRingSignature?: (transactionPrefixHash: string, keyImage: string, publicKeys: string[], signatures: string[]) => Promise<boolean>;
    /**
     * A replacement function for the JS/C++ generateKeyDerivation.
     */
    generateKeyDerivation?: (transactionPublicKey: string, privateViewKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ scReduce32.
     */
    scReduce32?: (scalar: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ checkKey.
     */
    checkKey?: (key: string) => Promise<boolean>;
    /**
     * A replacement function for the JS/C++ hashToEllipticCurve.
     */
    hashToEllipticCurve?: (hash: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ generateSignature.
     */
    generateSignature?: (message: string, publicKey: string, privateKey: string) => Promise<string>;
    /**
     * A replacement function for the JS/C++ checkSignature.
     */
    checkSignature?: (message: string, publicKey: string, signature: string) => Promise<boolean>;
    /**
     * A replacement function for the JS/C++ hashToScalar.
     */
    hashToScalar?: (hash: string) => Promise<string>;
    /**
    * A replacement function for the JS/C++ generateKeys.
    */
    generateKeys?: () => Promise<IKeyPair>;
    /**
     * The amount of memory to use storing downloaded blocks - 50MB
     */
    blockStoreMemoryLimit: number;
    /**
     * The amount of blocks to take from the daemon per request. Cannot take
     * more than 100.
     */
    blocksPerDaemonRequest: number;
    /**
     * The amount of seconds to permit not having fetched a block from the
     * daemon before emitting 'deadnode'. Note that this just means contacting
     * the daemon for data - if you are synced and it returns TopBlock - the
     * event will not be emitted.
     */
    maxLastFetchedBlockInterval: number;
    /**
     * The amount of seconds to permit not having fetched a new network height
     * from the daemon before emitting 'deadnode'.
     */
    maxLastUpdatedNetworkHeightInterval: number;
    /**
     * The amount of seconds to permit not having fetched a new local height
     * from the daemon before emitting 'deadnode'.
     */
    maxLastUpdatedLocalHeightInterval: number;
    /**
     * Allows setting a customer user agent string
     */
    customUserAgentString: string;
    /**
     * Allows specifying a custom configuration object for the request module.
     */
    customRequestOptions: any;
    [key: string]: any;
}
/**
 * Merge the default config with the provided config
 *
 * @hidden
 */
export declare function MergeConfig(config?: IConfig, currentConfig?: Config): Config;
