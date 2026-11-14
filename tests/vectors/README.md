Test vectors for transaction version 2 (fork 14), copied byte for byte from the Kryptokrona Rust
node repository (`xkr`, `docs/test-vectors/`, commit `fe10b3e`). Do not edit them here; regenerate
them on the Rust side and copy them again.

| file | content | generated and checked by (in `xkr`) | SHA-256 |
|---|---|---|---|
| `tx-v2-walletsync.json` | recorded `/getwalletsyncdata`, `/get_global_indexes_for_range`, `/getinfo` and `/get_pool_changes_lite` answers of an in-process testnet chain (fork 14 at height 4, grace 3), the wallet keys and the expected scan results | `crates/xkr-rpc/tests/tx_v2_walletsync/` | `b133786e65ff7d6edd6b362723795b65e81fdc924fb603ae40fa6f95ed7625d8` |
| `tx-v2-view-tags.json` | view tags: the 70 Monero `derive_view_tag` vectors and Kryptokrona wallets and transaction keys | `crates/xkr-wallet-core/tests/tx_v2_view_tags.rs` | `109ffcfe78f4bda98e79d825548315dc7e436eb3e77bfd70c9ef976b6582ac4c` |

Used by `tests/txv2.ts` (`npm run test-v2`).
