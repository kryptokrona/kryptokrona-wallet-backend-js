export interface WalletBackendJSON {
    walletFileFormatVersion: number;
    subWallets: SubWalletsJSON;
    walletSynchronizer: WalletSynchronizerJSON;
}
export interface WalletSynchronizerJSON {
    startTimestamp: number;
    startHeight: number;
    privateViewKey: string;
    transactionSynchronizerStatus: SynchronizationStatusJSON;
}
export interface SubWalletJSON {
    unspentInputs: TransactionInputJSON[];
    lockedInputs: TransactionInputJSON[];
    spentInputs: TransactionInputJSON[];
    unconfirmedIncomingAmounts: UnconfirmedInputJSON[];
    publicSpendKey: string;
    privateSpendKey: string;
    syncStartTimestamp: number;
    syncStartHeight: number;
    address: string;
    isPrimaryAddress: boolean;
}
export interface TransactionJSON {
    transfers: TransfersJSON[];
    hash: string;
    fee: number;
    blockHeight: number;
    timestamp: number;
    paymentID: string;
    unlockTime: number;
    isCoinbaseTransaction: boolean;
}
export interface SubWalletsJSON {
    publicSpendKeys: string[];
    subWallet: SubWalletJSON[];
    transactions: TransactionJSON[];
    lockedTransactions: TransactionJSON[];
    privateViewKey: string;
    isViewWallet: boolean;
    txPrivateKeys: TxPrivateKeysJSON[];
    knownTransactions: string[];
}
export interface TxPrivateKeysJSON {
    transactionHash: string;
    txPrivateKey: string;
}
export declare function txPrivateKeysToVector(txPrivateKeys: Map<string, string>): TxPrivateKeysJSON[];
export interface TransfersJSON {
    amount: number;
    publicKey: string;
}
export declare function transfersToVector(transfers: Map<string, number>): TransfersJSON[];
export interface TransactionInputJSON {
    keyImage: string;
    amount: number;
    blockHeight: number;
    transactionPublicKey: string;
    transactionIndex: number;
    globalOutputIndex: number;
    key: string;
    spendHeight: number;
    unlockTime: number;
    parentTransactionHash: string;
    privateEphemeral?: string;
}
export interface UnconfirmedInputJSON {
    amount: number;
    key: string;
    parentTransactionHash: string;
    locked: boolean;
}
export interface SynchronizationStatusJSON {
    blockHashCheckpoints: string[];
    lastKnownBlockHashes: string[];
    lastKnownBlockHeight: number;
}
