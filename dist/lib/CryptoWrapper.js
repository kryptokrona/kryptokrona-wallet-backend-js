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
exports.underivePublicKey = exports.generateKeyImage = exports.generateKeyImagePrimitive = exports.generateKeyDerivation = void 0;
const kryptokrona_utils_1 = require("kryptokrona-utils");
const CnUtils_1 = require("./CnUtils");
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
exports.generateKeyDerivation = generateKeyDerivation;
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
exports.generateKeyImagePrimitive = generateKeyImagePrimitive;
function generateKeyImage(transactionPublicKey, privateViewKey, publicSpendKey, privateSpendKey, transactionIndex, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const derivation = yield generateKeyDerivation(transactionPublicKey, privateViewKey, config);
        return generateKeyImagePrimitive(publicSpendKey, privateSpendKey, transactionIndex, derivation, config);
    });
}
exports.generateKeyImage = generateKeyImage;
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
exports.underivePublicKey = underivePublicKey;
