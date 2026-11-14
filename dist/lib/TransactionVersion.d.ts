/**
 * The transaction versions this library can build: 1 (ring signatures,
 * untagged outputs) and 2 (fork 14: view tags and single-key CLSAG
 * signatures).
 */
export declare const BUILDABLE_TRANSACTION_VERSIONS: number[];
/**
 * The first block major version whose blocks accept transaction version 2.
 * Used as a fallback signal for daemons that do not report `tx_versions`.
 */
export declare const TRANSACTION_VERSION_2_MAJOR_VERSION: number;
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
export declare function parseTransactionVersions(info: any): number[];
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
export declare function chooseTransactionVersion(allowedVersions: number[], clsagSupported: boolean, override?: number): number | undefined;
