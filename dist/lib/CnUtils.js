"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const turtlecoin_utils_1 = require("turtlecoin-utils");
const Config_1 = require("./Config");
exports.CryptoUtils = new turtlecoin_utils_1.CryptoNote({
    addressPrefix: Config_1.default.addressPrefix,
    coinUnitPlaces: Config_1.default.decimalPlaces,
    keccakIterations: 1,
});
