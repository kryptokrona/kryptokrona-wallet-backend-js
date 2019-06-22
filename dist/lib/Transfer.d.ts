import { Config } from './Config';
import { IDaemon } from './IDaemon';
import { SubWallets } from './SubWallets';
import { Transaction as TX } from './Types';
import { WalletError } from './WalletError';
/**
 * Sends a fusion transaction.
 * If you need more control, use `sendFusionTransactionAdvanced`
 * Note that if your wallet is fully optimized, this will be indicated in the
 * returned error code.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
export declare function sendFusionTransactionBasic(config: Config, daemon: IDaemon, subWallets: SubWallets): Promise<([TX, string, undefined]) | ([undefined, undefined, WalletError])>;
/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon and subWallets.
 * @param daemon                A daemon instance we can send the transaction to
 * @param subWallets            The subwallets instance to draw funds from
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param destination           The destination for the fusion transactions to be sent to.
 *                              Must be a subwallet in this container.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
export declare function sendFusionTransactionAdvanced(config: Config, daemon: IDaemon, subWallets: SubWallets, mixin?: number, subWalletsToTakeFrom?: string[], destination?: string): Promise<([TX, string, undefined]) | ([undefined, undefined, WalletError])>;
/**
 * Sends a transaction of amount to the address destination, using the
 * given payment ID, if specified.
 *
 * Network fee is set to default, mixin is set to default, all subwallets
 * are taken from, primary address is used as change address.
 *
 * If you need more control, use `sendTransactionAdvanced()`
 *
 * @param daemon        A daemon instance we can send the transaction to
 * @param subWallets    The subwallets instance to draw funds from
 * @param destination   The address to send the funds to
 * @param amount        The amount to send, in ATOMIC units
 * @param paymentID     The payment ID to include with this transaction. Optional.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
export declare function sendTransactionBasic(config: Config, daemon: IDaemon, subWallets: SubWallets, destination: string, amount: number, paymentID?: string): Promise<([TX, string, undefined]) | ([undefined, undefined, WalletError])>;
/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon, subWallets, and addressesAndAmounts.
 * @param daemon                A daemon instance we can send the transaction to
 * @param subWallets            The subwallets instance to draw funds from
 * @param addressesAndAmounts   An array of destinations, and amounts to send to that
 *                              destination.
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param fee                   The network fee to use with this transaction. In ATOMIC units.
 * @param paymentID             The payment ID to include with this transaction.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param changeAddress         The address to send any returned change to.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
export declare function sendTransactionAdvanced(config: Config, daemon: IDaemon, subWallets: SubWallets, addressesAndAmounts: Array<[string, number]>, mixin?: number, fee?: number, paymentID?: string, subWalletsToTakeFrom?: string[], changeAddress?: string): Promise<([TX, string, undefined]) | ([undefined, undefined, WalletError])>;
