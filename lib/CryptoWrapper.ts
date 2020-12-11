// Copyright (c) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { CryptoUtils } from './CnUtils';
import { Config } from './Config';

const nullKey = '0'.repeat(64);

export async function generateKeyDerivation(
    transactionPublicKey: string,
    privateViewKey: string,
    config: Config): Promise<string> {

    if (config.generateKeyDerivation) {
        return config.generateKeyDerivation(transactionPublicKey, privateViewKey);
    }

    try {
        const key = await CryptoUtils(config).generateKeyDerivation(
            transactionPublicKey,
            privateViewKey,
        );
        return key;
    } catch (err) {
        return nullKey;
    }
}

export async function generateKeyImagePrimitive(
    publicSpendKey: string,
    privateSpendKey: string,
    outputIndex: number,
    derivation: string,
    config: Config): Promise<[string, string]> {

    if (config.derivePublicKey && config.deriveSecretKey && config.generateKeyImage) {
        /* Derive the transfer public key from the derived key, the output index, and our public spend key */
        const publicEphemeral = await config.derivePublicKey(
            derivation, outputIndex, publicSpendKey,
        );

        /* Derive the key image private key from the derived key, the output index, and our spend secret key */
        const privateEphemeral = await config.deriveSecretKey(
            derivation, outputIndex, privateSpendKey,
        );

        /* Generate the key image */
        const keyImage = await config.generateKeyImage(publicEphemeral, privateEphemeral);

        return [keyImage, privateEphemeral];
    }

    try {
        const keys = await CryptoUtils(config).generateKeyImagePrimitive(
            publicSpendKey, privateSpendKey, outputIndex, derivation,
        );

        return keys;
    } catch (err) {
        return [nullKey, nullKey];
    }
}

export async function generateKeyImage(
    transactionPublicKey: string,
    privateViewKey: string,
    publicSpendKey: string,
    privateSpendKey: string,
    transactionIndex: number,
    config: Config): Promise<[string, string]> {

    const derivation: string = await generateKeyDerivation(
        transactionPublicKey, privateViewKey, config,
    );

    return generateKeyImagePrimitive(
        publicSpendKey, privateSpendKey, transactionIndex, derivation, config,
    );
}

export async function underivePublicKey(
    derivation: string,
    outputIndex: number,
    outputKey: string,
    config: Config): Promise<string> {
    if (config.underivePublicKey) {
        return config.underivePublicKey(derivation, outputIndex, outputKey);
    }

    try {
        const key = await CryptoUtils(config).underivePublicKey(
            derivation, outputIndex, outputKey,
        );

        return key;
    } catch (err) {
        return nullKey;
    }
}
