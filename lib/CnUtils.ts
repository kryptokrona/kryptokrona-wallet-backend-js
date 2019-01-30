// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoNote } from 'turtlecoin-utils';
import { Config } from './Config';

/**
 * This needs to be a function, rather than a default export, since our config
 * can change when a user calls createWallet() with a non default config.
 * Due to how the module system works, a default export is cached and so the
 * config will never update.
 */
export function CryptoUtils(): CryptoNote {
    return new CryptoNote({
        addressPrefix: Config.addressPrefix,
        coinUnitPlaces: Config.decimalPlaces,
        keccakIterations: 1,
    });
}
