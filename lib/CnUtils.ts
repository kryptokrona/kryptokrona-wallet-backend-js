// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import config from './Config';
import CryptoNote = require('turtlecoin-utils');

export let CryptoUtils = new CryptoNote({
    coinUnitPlaces: config.decimalPlaces,
    addressPrefix: config.addressPrefix,
    keccakIterations: 1
});
