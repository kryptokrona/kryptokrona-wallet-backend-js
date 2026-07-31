import { SubWalletJSON } from './JsonSerialization';
import { TransactionInput, TxInputAndOwner, UnconfirmedInput } from './Types';
import { Config } from './Config';
export declare class SubWallet {
    static fromJSON(json: SubWalletJSON): SubWallet;
    /**
     * A vector of the stored transaction input data, to be used for
     * sending transactions later
     */
    private unspentInputs;
    /**
     * Inputs which have been used in a transaction, and are waiting to
     * either be put into a block, or return to our wallet
     */
    private lockedInputs;
    /**
     * Inputs which have been spent in a transaction
     */
    private spentInputs;
    /**
     * Inputs which have come in from a transaction we sent - either from
     * change or from sending to ourself - we use this to display unlocked
     * balance correctly
     */
    private unconfirmedIncomingAmounts;
    /**
     * This subwallet's public spend key
     */
    private readonly publicSpendKey;
    /**
     * The subwallet's private spend key (undefined if view wallet)
     */
    private readonly privateSpendKey?;
    /**
     * The timestamp to begin syncing the wallet at
     * (usually creation time or zero)
     */
    private syncStartTimestamp;
    /**
     * The height to begin syncing the wallet at
     */
    private syncStartHeight;
    /**
     * This subwallet's public address
     */
    private readonly address;
    /**
     * The wallet has one 'main' address which we will use by default
     * when treating it as a single user wallet
     */
    private readonly primaryAddress;
    private config;
    constructor(config: Config, address: string, scanHeight: number, timestamp: number, publicSpendKey: string, privateSpendKey?: string, primaryAddress?: boolean);
    toJSON(): SubWalletJSON;
    pruneSpentInputs(pruneHeight: number): void;
    reset(scanHeight: number, scanTimestamp: number): void;
    /**
     * Get the private spend key, or null key if view wallet
     */
    getPrivateSpendKey(): string;
    /**
     * Whether this address is the primary wallet address
     */
    isPrimaryAddress(): boolean;
    /**
     * Get this wallets address
     */
    getAddress(): string;
    /**
     * Store an unspent input
     */
    storeTransactionInput(input: TransactionInput, isViewWallet: boolean): void;
    /**
     * Move input from unspent/locked to spend container
     */
    markInputAsSpent(keyImage: string, spendHeight: number): void;
    /**
     * Move an input from the unspent container to the locked container
     */
    markInputAsLocked(keyImage: string, transactionHash: string): void;
    /**
     * Remove inputs belonging to a cancelled transaction and mark them as
     * unspent
     */
    removeCancelledTransaction(transactionHash: string): void;
    /**
     * Remove transactions and inputs that occured after a fork height
     */
    removeForkedTransactions(forkHeight: number): string[];
    /**
     * Convert a timestamp to a height
     */
    convertSyncTimestampToHeight(startTimestamp: number, startHeight: number): void;
    /**
     * Gets every stored key image
     */
    getKeyImages(): string[];
    /**
     * Generate the key image for this input
     */
    getTxInputKeyImage(derivation: string, outputIndex: number): Promise<[string, string?]>;
    /**
     * Get the unlocked/locked balance at a given height
     */
    getBalance(currentHeight: number): [number, number];
    /**
    * Gets the amount of incoming and outgoing funds locked in the mempool, uses this to subtract from locked amount
    * so we do not get a negative number when displaying available balance.
    */
    getLockedMessageBalance(): number;
    /**
     * Gets the amount of funds returning to us as change from outgoing
     * unconfirmed transactions
     */
    getUnconfirmedChange(): number;
    haveSpendableInput(input: TransactionInput, currentHeight: number): boolean;
    /**
     * Get inputs that are available to be spent, and their keys
     */
    getSpendableInputs(currentHeight: number): TxInputAndOwner[];
    storeUnconfirmedIncomingInput(input: UnconfirmedInput): void;
    initAfterLoad(config: Config): void;
}
