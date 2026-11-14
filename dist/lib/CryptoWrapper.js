"use strict";
// Copyright (c) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeyDerivation = generateKeyDerivation;
exports.generateKeyImagePrimitive = generateKeyImagePrimitive;
exports.generateKeyImage = generateKeyImage;
exports.underivePublicKey = underivePublicKey;
exports.deriveViewTag = deriveViewTag;
exports.computeViewTag = computeViewTag;
const kryptokrona_utils_1 = require("kryptokrona-utils");
const CnUtils_1 = require("./CnUtils");
const Types_1 = require("./Types");
const TurtleCoinCrypto = new kryptokrona_utils_1.Crypto();
const nullKey = '0'.repeat(64);
function generateKeyDerivation(transactionPublicKey, privateViewKey, config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.generateKeyDerivation) {
            return config.generateKeyDerivation(transactionPublicKey, privateViewKey);
        }
        try {
            return TurtleCoinCrypto.generateKeyDerivation(transactionPublicKey, privateViewKey);
        }
        catch (err) {
            return nullKey;
        }
    });
}
function generateKeyImagePrimitive(publicSpendKey, privateSpendKey, outputIndex, derivation, config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.derivePublicKey && config.deriveSecretKey && config.generateKeyImage) {
            /* Derive the transfer public key from the derived key, the output index, and our public spend key */
            const publicEphemeral = yield config.derivePublicKey(derivation, outputIndex, publicSpendKey);
            /* Derive the key image private key from the derived key, the output index, and our spend secret key */
            const privateEphemeral = yield config.deriveSecretKey(derivation, outputIndex, privateSpendKey);
            /* Generate the key image */
            const keyImage = yield config.generateKeyImage(publicEphemeral, privateEphemeral);
            return [keyImage, privateEphemeral];
        }
        try {
            const keys = yield (0, CnUtils_1.CryptoUtils)(config).generateKeyImagePrimitive(publicSpendKey, privateSpendKey, outputIndex, derivation);
            return [keys.keyImage, keys.privateEphemeral];
        }
        catch (err) {
            return [nullKey, nullKey];
        }
    });
}
function generateKeyImage(transactionPublicKey, privateViewKey, publicSpendKey, privateSpendKey, transactionIndex, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const derivation = yield generateKeyDerivation(transactionPublicKey, privateViewKey, config);
        return generateKeyImagePrimitive(publicSpendKey, privateSpendKey, transactionIndex, derivation, config);
    });
}
function underivePublicKey(derivation, outputIndex, outputKey, config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.underivePublicKey) {
            return config.underivePublicKey(derivation, outputIndex, outputKey);
        }
        try {
            return TurtleCoinCrypto.underivePublicKey(derivation, outputIndex, outputKey);
        }
        catch (err) {
            return nullKey;
        }
    });
}
/**
 * The 8 ASCII bytes "view_tag" (no terminator): the domain separator of the
 * view tag hash.
 */
const VIEW_TAG_DOMAIN = '766965775f746167';
/**
 * Encodes a non negative integer as a CryptoNote (LEB128) varint, in hex.
 */
function varintHex(value) {
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
function deriveViewTag(derivation, outputIndex, config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.deriveViewTag) {
            const tag = (0, Types_1.normalizeViewTag)(yield config.deriveViewTag(derivation, outputIndex));
            if (tag !== undefined) {
                return tag;
            }
        }
        const crypto = TurtleCoinCrypto;
        if (typeof crypto.deriveViewTag === 'function') {
            try {
                const tag = (0, Types_1.normalizeViewTag)(yield crypto.deriveViewTag(derivation, outputIndex));
                if (tag !== undefined) {
                    return tag;
                }
            }
            catch (err) {
                /* Fall through to the cn_fast_hash computation */
            }
        }
        return computeViewTag(derivation, outputIndex, config);
    });
}
/**
 * The view tag computed over `cn_fast_hash` (the fallback of [[deriveViewTag]]).
 *
 * @hidden
 */
function computeViewTag(derivation, outputIndex, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = VIEW_TAG_DOMAIN + derivation.toLowerCase() + varintHex(outputIndex);
        const hash = config.cnFastHash
            ? yield config.cnFastHash(data)
            : yield TurtleCoinCrypto.cn_fast_hash(data);
        return hash.substring(0, 2).toLowerCase();
    });
}
