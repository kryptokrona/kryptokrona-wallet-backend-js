// Copyright (c) 2026, The Kryptokrona Developers
//
// Please see the included LICENSE file for more information.

/**
 * The transaction versions this library can build: 1 (ring signatures,
 * untagged outputs) and 2 (fork 14: view tags and single-key CLSAG
 * signatures).
 */
export const BUILDABLE_TRANSACTION_VERSIONS: number[] = [1, 2];

/**
 * The first block major version whose blocks accept transaction version 2.
 * Used as a fallback signal for daemons that do not report `tx_versions`.
 */
export const TRANSACTION_VERSION_2_MAJOR_VERSION: number = 7;

/**
 * Reads the transaction versions the daemon accepts for the next block from a
 * `/info` (or `/getinfo`) answer.
 *
 * - `tx_versions` present (xkrd): that list, keeping only integers 0..255
 * - no `tx_versions`, `major_version` >= 7: `[1, 2]`
 * - otherwise (C++ daemons, older xkrd, blockchain cache APIs): `[1]`
 *
 * This mirrors `daemon_fork_info` of the reference client `xkr-testwallet`.
 *
 * @param info The parsed JSON answer of `/info` or `/getinfo`
 */
export function parseTransactionVersions(info: any): number[] {
    if (info && Array.isArray(info.tx_versions)) {
        return info.tx_versions.filter((version: any) => {
            return typeof version === 'number' && Number.isInteger(version) && version >= 0 && version <= 255;
        });
    }

    if (info && typeof info.major_version === 'number'
     && info.major_version >= TRANSACTION_VERSION_2_MAJOR_VERSION) {
        return [1, 2];
    }

    return [1];
}

/**
 * Chooses the transaction version to build.
 *
 * Without an override this is the highest version the daemon allows that this
 * library can build, where version 2 also needs CLSAG support in the loaded
 * cryptographic library. With an override the override is used (also when the
 * daemon does not list it), provided it can be built.
 *
 * @param allowedVersions   The versions the daemon accepts for the next block
 *                          (see [[parseTransactionVersions]])
 * @param clsagSupported    Whether CLSAG signing is available (version 2)
 * @param override          A fixed version to build (`Config.transactionVersion`)
 *
 * @returns The version to build, or undefined if no allowed version can be built
 */
export function chooseTransactionVersion(
    allowedVersions: number[],
    clsagSupported: boolean,
    override?: number): number | undefined {

    const canBuild = (version: number): boolean => {
        return BUILDABLE_TRANSACTION_VERSIONS.includes(version)
            && (version < 2 || clsagSupported);
    };

    if (override !== undefined && override !== null) {
        return canBuild(override) ? override : undefined;
    }

    const candidates: number[] = allowedVersions.filter(canBuild);

    if (candidates.length === 0) {
        return undefined;
    }

    return Math.max(...candidates);
}
