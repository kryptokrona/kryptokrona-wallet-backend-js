// Copyright (c) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import {Crypto} from 'kryptokrona-utils';
import {CryptoUtils} from './CnUtils';
import {Config} from './Config';
import {normalizeViewTag} from './Types';

const TurtleCoinCrypto = new Crypto();

const nullKey = '0'.repeat(64);

export async function generateKeyDerivation(
    transactionPublicKey: string,
    privateViewKey: string,
    config: Config): Promise<string> {

    if (config.generateKeyDerivation) {
        return config.generateKeyDerivation(transactionPublicKey, privateViewKey);
    }

    try {
        return TurtleCoinCrypto.generateKeyDerivation(
            transactionPublicKey,
            privateViewKey,
        );
    } catch (err) {
        return nullKey;
    }
}

export async function generateKeyImagePrimitive(
    publicSpendKey: string,
    privateSpendKey: string,
    outputIndex: number,
    derivation: string,
    config: Config): Promise<[string, string?]> {

    if (config.derivePublicKey && config.deriveSecretKey && config.generateKeyImage) {
        /* Derive the transfer public key from the derived key, the output index, and our public spend key */
        const publicEphemeral = await config.derivePublicKey(
            derivation, outputIndex, publicSpendKey,
        );

        /* Derive the key image private key from the derived key, the output index, and our spend secret key */
        const privateEphemeral = await config.deriveSecretKey(
            derivation, outputIndex, privateSpendKey,
        );

        /* Generate the key image */
        const keyImage = await config.generateKeyImage(publicEphemeral, privateEphemeral);

        return [keyImage, privateEphemeral];
    }

    try {
        const keys = await CryptoUtils(config).generateKeyImagePrimitive(
            publicSpendKey, privateSpendKey, outputIndex, derivation,
        );

        return [keys.keyImage, keys.privateEphemeral];
    } catch (err) {
        return [nullKey, nullKey];
    }
}

export async function generateKeyImage(
    transactionPublicKey: string,
    privateViewKey: string,
    publicSpendKey: string,
    privateSpendKey: string,
    transactionIndex: number,
    config: Config): Promise<[string, string?]> {

    const derivation: string = await generateKeyDerivation(
        transactionPublicKey, privateViewKey, config,
    );

    return generateKeyImagePrimitive(
        publicSpendKey, privateSpendKey, transactionIndex, derivation, config,
    );
}

export async function underivePublicKey(
    derivation: string,
    outputIndex: number,
    outputKey: string,
    config: Config): Promise<string> {
    if (config.underivePublicKey) {
        return config.underivePublicKey(derivation, outputIndex, outputKey);
    }

    try {
        return TurtleCoinCrypto.underivePublicKey(
            derivation, outputIndex, outputKey,
        );
    } catch (err) {
        return nullKey;
    }
}

/**
 * The 8 ASCII bytes "view_tag" (no terminator): the domain separator of the
 * view tag hash.
 */
const VIEW_TAG_DOMAIN = '766965775f746167';

/**
 * Encodes a non negative integer as a CryptoNote (LEB128) varint, in hex.
 */
function varintHex(value: number): string {
    let result = '';

    do {
        let byte = value % 128;

        value = Math.floor(value / 128);

        if (value > 0) {
            byte += 128;
        }

        result += byte.toString(16).padStart(2, '0');
    } while (value > 0);

    return result;
}

/**
 * The view tag of output `outputIndex` (transaction version 2, fork 14):
 * the first byte of cn_fast_hash("view_tag" || derivation || varint(outputIndex)),
 * as two lowercase hex characters.
 *
 * Uses, in order: the `deriveViewTag` config hook, kryptokrona-crypto's
 * `deriveViewTag`, and a computation over `cn_fast_hash`.
 */
export async function deriveViewTag(
    derivation: string,
    outputIndex: number,
    config: Config): Promise<string> {

    if (config.deriveViewTag) {
        const tag = normalizeViewTag(await config.deriveViewTag(derivation, outputIndex));

        if (tag !== undefined) {
            return tag;
        }
    }

    const crypto: any = TurtleCoinCrypto;

    if (typeof crypto.deriveViewTag === 'function') {
        try {
            const tag = normalizeViewTag(await crypto.deriveViewTag(derivation, outputIndex));

            if (tag !== undefined) {
                return tag;
            }
        } catch (err) {
            /* Fall through to the cn_fast_hash computation */
        }
    }

    return computeViewTag(derivation, outputIndex, config);
}

/**
 * The view tag computed over `cn_fast_hash` (the fallback of [[deriveViewTag]]).
 *
 * @hidden
 */
export async function computeViewTag(
    derivation: string,
    outputIndex: number,
    config: Config): Promise<string> {

    const data: string = VIEW_TAG_DOMAIN + derivation.toLowerCase() + varintHex(outputIndex);

    const hash: string = config.cnFastHash
        ? await config.cnFastHash(data)
        : await TurtleCoinCrypto.cn_fast_hash(data);

    return hash.substring(0, 2).toLowerCase();
}
