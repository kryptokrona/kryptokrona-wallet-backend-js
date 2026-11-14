import { Config } from './Config';
export declare function generateKeyDerivation(transactionPublicKey: string, privateViewKey: string, config: Config): Promise<string>;
export declare function generateKeyImagePrimitive(publicSpendKey: string, privateSpendKey: string, outputIndex: number, derivation: string, config: Config): Promise<[string, string?]>;
export declare function generateKeyImage(transactionPublicKey: string, privateViewKey: string, publicSpendKey: string, privateSpendKey: string, transactionIndex: number, config: Config): Promise<[string, string?]>;
export declare function underivePublicKey(derivation: string, outputIndex: number, outputKey: string, config: Config): Promise<string>;
/**
 * The view tag of output `outputIndex` (transaction version 2, fork 14):
 * the first byte of cn_fast_hash("view_tag" || derivation || varint(outputIndex)),
 * as two lowercase hex characters.
 *
 * Uses, in order: the `deriveViewTag` config hook, kryptokrona-crypto's
 * `deriveViewTag`, and a computation over `cn_fast_hash`.
 */
export declare function deriveViewTag(derivation: string, outputIndex: number, config: Config): Promise<string>;
/**
 * The view tag computed over `cn_fast_hash` (the fallback of [[deriveViewTag]]).
 *
 * @hidden
 */
export declare function computeViewTag(derivation: string, outputIndex: number, config: Config): Promise<string>;
