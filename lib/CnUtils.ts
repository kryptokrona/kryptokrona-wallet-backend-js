// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

const config = require('./Config');

const CryptoUtils = require('turtlecoin-utils');

module.exports = new CryptoUtils({
    coinUnitPlaces: config.decimalPlaces,
    addressPrefix: config.addressPrefix,
    keccakIterations: 1
});
