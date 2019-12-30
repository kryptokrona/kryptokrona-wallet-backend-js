// Copyright (c) 2018-2020, Zpalmtree
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
export function CryptoUtils(config: Config): CryptoNote {
    return new CryptoNote({
        addressPrefix: config.addressPrefix,
        checkRingSignatures: config.checkRingSignatures,
        cnFastHash: config.cnFastHash,
        coinUnitPlaces: config.decimalPlaces,
        derivePublicKey: config.derivePublicKey,
        deriveSecretKey: config.deriveSecretKey,
        generateKeyDerivation: config.generateKeyDerivation,
        generateKeyImage: config.generateKeyImage,
        generateRingSignatures: config.generateRingSignatures,
        keccakIterations: 1,
        secretKeyToPublicKey: config.secretKeyToPublicKey,
        underivePublicKey: config.underivePublicKey,
    });
}
