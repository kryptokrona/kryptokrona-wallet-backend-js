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
        coinUnitPlaces: Config_1.Config.decimalPlaces,
        keccakIterations: 1,
    });
}
exports.CryptoUtils = CryptoUtils;
