# Changelog

## 2.7.0

Transaction version 2 (fork 14: view tags and single-key CLSAG signatures). The public API stays
backward compatible.

### Added

- Version 2 sending: the wallet builds the highest transaction version the daemon accepts for the
  next block that the loaded cryptographic library can build (version 2 needs CLSAG support,
  kryptokrona-crypto 1.1.0). Applies to `sendTransactionBasic` / `sendTransactionAdvanced`, fusion
  transactions and prepared transactions.
- `Daemon.getTransactionVersions()` (from `/info` `tx_versions`; without the field `[1, 2]` from
  block major version 7, otherwise `[1]`) and `Daemon.getMajorVersion()`.
- `chooseTransactionVersion` and `parseTransactionVersions` exports.
- `Config.transactionVersion` (`1` or `2`) to fix the version that is built.
- Config hooks `deriveViewTag`, `clsagSign` and `clsagVerify`, forwarded to kryptokrona-utils like
  the other cryptographic hooks.
- View-tag scanning: `view_tag` of `/getwalletsyncdata` outputs is read into `KeyOutput.viewTag`;
  tagged outputs whose view tag does not match are skipped before the key derivation. Same check in
  the pool scan (`/get_pool_changes_lite`, output type `03`) and for our own change after sending.
- `WalletBackend.getScanStats()` (`ScanStats`: outputs, tagged, skipped by view tag, full checks).
- Wallet error codes `TRANSACTION_VERSION_NOT_ALLOWED` (59; also returned for the daemon's
  "transaction version not allowed" answer and for prepared transactions whose version the daemon
  no longer accepts) and `TRANSACTION_VERSION_NOT_SUPPORTED` (60).
- Mixin limit from height 1 250 000: mixin 1 to 5, default 5 (both transaction versions).
- `estimateTransactionSize` takes the transaction version (CLSAG and view tag sizes).
- Offline tests with the fork-14 vectors of the Rust node (`tests/txv2.ts`, `tests/vectors/`,
  `npm run test-v2`).

### Fixed

- Tagged outputs (type `0x03`) are counted in the amount, fee and change checks of sending and kept
  by the raw-block parser, so version 2 transactions do not end in `UNEXPECTED_FEE`.
- `MixinLimits.getMixinLimitsByHeight` returns the limits of the newest limit at or below the height
  (it returned the oldest one); limits apply from their activation height inclusive.
- The pool scan uses the output's own index for its key image (it used the next index).

### Dependencies

- kryptokrona-utils `^1.5.0`, kryptokrona-crypto `^1.1.0`.
