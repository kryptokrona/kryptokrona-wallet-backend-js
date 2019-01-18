// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoNote } from 'turtlecoin-utils';
import config from './Config';

export let CryptoUtils = new CryptoNote({
    addressPrefix: config.addressPrefix,
    coinUnitPlaces: config.decimalPlaces,
    keccakIterations: 1,
});
