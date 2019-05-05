"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const CnUtils_1 = require("./CnUtils");
const Config_1 = require("./Config");
const nullKey = '0'.repeat(64);
function generateKeyDerivation(transactionPublicKey, privateViewKey) {
    return __awaiter(this, void 0, void 0, function* () {
        if (Config_1.Config.generateKeyDerivation) {
            return Config_1.Config.generateKeyDerivation(transactionPublicKey, privateViewKey);
        }
        try {
            const key = yield CnUtils_1.CryptoUtils().generateKeyDerivation(transactionPublicKey, privateViewKey);
            return key;
        }
        catch (err) {
            return nullKey;
        }
    });
}
exports.generateKeyDerivation = generateKeyDerivation;
function generateKeyImagePrimitive(publicSpendKey, privateSpendKey, outputIndex, derivation) {
    return __awaiter(this, void 0, void 0, function* () {
        if (Config_1.Config.derivePublicKey && Config_1.Config.deriveSecretKey && Config_1.Config.generateKeyImage) {
            /* Derive the transfer public key from the derived key, the output index, and our public spend key */
            const publicEphemeral = yield Config_1.Config.derivePublicKey(derivation, outputIndex, publicSpendKey);
            /* Derive the key image private key from the derived key, the output index, and our spend secret key */
            const privateEphemeral = yield Config_1.Config.deriveSecretKey(derivation, outputIndex, privateSpendKey);
            /* Generate the key image */
            const keyImage = yield Config_1.Config.generateKeyImage(publicEphemeral, privateEphemeral);
            return [keyImage, privateEphemeral];
        }
        try {
            const keys = yield CnUtils_1.CryptoUtils().generateKeyImagePrimitive(publicSpendKey, privateSpendKey, outputIndex, derivation);
            return keys;
        }
        catch (err) {
            return [nullKey, nullKey];
        }
    });
}
exports.generateKeyImagePrimitive = generateKeyImagePrimitive;
function generateKeyImage(transactionPublicKey, privateViewKey, publicSpendKey, privateSpendKey, transactionIndex) {
    return __awaiter(this, void 0, void 0, function* () {
        const derivation = yield generateKeyDerivation(transactionPublicKey, privateViewKey);
        return generateKeyImagePrimitive(publicSpendKey, privateSpendKey, transactionIndex, derivation);
    });
}
exports.generateKeyImage = generateKeyImage;
function underivePublicKey(derivation, outputIndex, outputKey) {
    return __awaiter(this, void 0, void 0, function* () {
        if (Config_1.Config.underivePublicKey) {
            return Config_1.Config.underivePublicKey(derivation, outputIndex, outputKey);
        }
        try {
            const key = yield CnUtils_1.CryptoUtils().underivePublicKey(derivation, outputIndex, outputKey);
            return key;
        }
        catch (err) {
            return nullKey;
        }
    });
}
exports.underivePublicKey = underivePublicKey;
