// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoNote, LedgerNote, ICryptoNote } from 'turtlecoin-utils';
import { Config } from './Config';
import * as _ from 'lodash';

/** @ignore */
interface ICnUtilsCache {
    interface?: ICryptoNote;
    config?: Config;
}

/** @ignore */
const cached: ICnUtilsCache = {};

/**
 * This needs to be a function, rather than a default export, since our config
 * can change when a user calls createWallet() with a non default config.
 * Due to how the module system works, a default export is cached and so the
 * config will never update.
 */
export function CryptoUtils(config: Config): ICryptoNote {
    if (!_.isEqual(cached.config, config) || !cached.config || !cached.interface) {
        cached.config = config;

        if (!config.ledgerTransport) {
            cached.interface = new CryptoNote({
                addressPrefix: config.addressPrefix,
                coinUnitPlaces: config.decimalPlaces,
                keccakIterations: 1,
            }, {
                cn_fast_hash: config.cnFastHash,
                checkRingSignatures: config.checkRingSignatures,
                derivePublicKey: config.derivePublicKey,
                deriveSecretKey: config.deriveSecretKey,
                generateKeyDerivation: config.generateKeyDerivation,
                generateKeyImage: config.generateKeyImage,
                generateRingSignatures: config.generateRingSignatures,
                secretKeyToPublicKey: config.secretKeyToPublicKey,
                underivePublicKey: config.underivePublicKey,
            });
        } else {
            cached.interface = new LedgerNote(config.ledgerTransport, {
                addressPrefix: config.addressPrefix,
                coinUnitPlaces: config.decimalPlaces,
                keccakIterations: 1,
            }, {
                cn_fast_hash: config.cnFastHash,
                checkRingSignatures: config.checkRingSignatures,
                derivePublicKey: config.derivePublicKey,
                deriveSecretKey: config.deriveSecretKey,
                generateKeyDerivation: config.generateKeyDerivation,
                generateKeyImage: config.generateKeyImage,
                generateRingSignatures: config.generateRingSignatures,
                secretKeyToPublicKey: config.secretKeyToPublicKey,
                underivePublicKey: config.underivePublicKey,
            })
        }

        return cached.interface;
    } else {
        return cached.interface;
    }
}
