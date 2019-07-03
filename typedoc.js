module.exports = {
  out: './docs',
  excludeExternals: true,
  excludeNotExported: true,
  excludePrivate: true,
  exclude: [
    './lib/CnUtils.ts',
    './lib/Constants.ts',
    './lib/CryptoWrapper.ts',
    './lib/JsonSerialization.ts',
    './lib/Metronome.ts',
    './lib/OpenWallet.ts',
    './lib/SubWallets.ts',
    './lib/SubWallet.ts',
    './lib/SynchronizationStatus.ts',
    './lib/WalletSynchronizer.ts',
    './lib/index.ts',
    './lib/Transfer.ts',
    './lib/WalletEncryption.ts',
    './lib/WordList.ts',
    './lib/Assert.ts'
  ],
  mode: 'modules'
}
