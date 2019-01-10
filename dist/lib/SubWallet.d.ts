import { SubWalletJSON } from './JsonSerialization';
import { TransactionInput } from './Types';
export declare class SubWallet {
    static fromJSON(json: SubWalletJSON): SubWallet;
    private unspentInputs;
    private lockedInputs;
    private spentInputs;
    private unconfirmedIncomingAmounts;
    private readonly publicSpendKey;
    private readonly privateSpendKey?;
    private syncStartTimestamp;
    private syncStartHeight;
    private readonly address;
    private readonly primaryAddress;
    constructor(address: string, scanHeight: number, timestamp: number, publicSpendKey: string, privateSpendKey?: string);
    toJSON(): SubWalletJSON;
    getPrivateSpendKey(): string;
    isPrimaryAddress(): boolean;
    getAddress(): string;
    storeTransactionInput(input: TransactionInput, isViewWallet: boolean): void;
    markInputAsSpent(keyImage: string, spendHeight: number): void;
    removeCancelledTransaction(transactionHash: string): void;
    removeForkedTransactions(forkHeight: number): void;
    convertSyncTimestampToHeight(startTimestamp: number, startHeight: number): void;
    hasKeyImage(keyImage: string): boolean;
    getTxInputKeyImage(derivation: string, outputIndex: number): string;
    getBalance(currentHeight: number): [number, number];
}
