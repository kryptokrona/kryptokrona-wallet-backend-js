// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoNote } from 'kryptokrona-utils';
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
        coinUnitPlaces: config.decimalPlaces,
        keccakIterations: 1,
    }, {
        cn_fast_hash: config.cnFastHash,
        checkRingSignature: config.checkRingSignature,
        derivePublicKey: config.derivePublicKey,
        deriveSecretKey: config.deriveSecretKey,
        generateKeyDerivation: config.generateKeyDerivation,
        generateKeyImage: config.generateKeyImage,
        generateRingSignatures: config.generateRingSignatures,
        secretKeyToPublicKey: config.secretKeyToPublicKey,
        underivePublicKey: config.underivePublicKey,
        scReduce32: config.scReduce32,
        checkKey: config.checkKey,
        hashToEllipticCurve: config.hashToEllipticCurve,
        generateSignature: config.generateSignature,
        checkSignature: config.checkSignature,
        hashToScalar: config.hashToScalar,
        generateKeys: config.generateKeys
    });
}
