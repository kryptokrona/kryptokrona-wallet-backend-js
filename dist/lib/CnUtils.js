"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const turtlecoin_utils_1 = require("turtlecoin-utils");
const Config_1 = require("./Config");
/**
 * This needs to be a function, rather than a default export, since our config
 * can change when a user calls createWallet() with a non default config.
 * Due to how the module system works, a default export is cached and so the
 * config will never update.
 */
function CryptoUtils() {
    return new turtlecoin_utils_1.CryptoNote({
        addressPrefix: Config_1.Config.addressPrefix,
        cnFastHash: Config_1.Config.cnFastHash,
        coinUnitPlaces: Config_1.Config.decimalPlaces,
        derivePublicKey: Config_1.Config.derivePublicKey,
        deriveSecretKey: Config_1.Config.deriveSecretKey,
        generateKeyDerivation: Config_1.Config.generateKeyDerivation,
        generateKeyImage: Config_1.Config.generateKeyImage,
        generateRingSignatures: Config_1.Config.generateRingSignatures,
        keccakIterations: 1,
        secretKeyToPublicKey: Config_1.Config.secretKeyToPublicKey,
        underivePublicKey: Config_1.Config.underivePublicKey,
    });
}
exports.CryptoUtils = CryptoUtils;
