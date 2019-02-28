import { IDaemon } from './IDaemon';
import { SubWallets } from './SubWallets';
import { Transaction as TX } from './Types';
import { WalletError } from './WalletError';
/**
 * Sends a transaction of amount to the address destination, using the
 * given payment ID, if specified.
 *
 * Network fee is set to default, mixin is set to default, all subwallets
 * are taken from, primary address is used as change address.
 *
 * If you need more control, use `sendTransactionAdvanced()`
 *
 * @param destination   The address to send the funds to
 * @param amount        The amount to send, in ATOMIC units
 * @param paymentID     The payment ID to include with this transaction. Optional.
 *
 * @return Returns either an error, or the transaction hash.
 */
export declare function sendTransactionBasic(daemon: IDaemon, subWallets: SubWallets, destination: string, amount: number, paymentID?: string): Promise<[TX | undefined, string | undefined, WalletError | undefined]>;
/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon, subWallets, and addressesAndAmounts.
 *
 * @param addressesAndAmounts   An array of destinations, and amounts to send to that
 *                              destination.
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param fee                   The network fee to use with this transaction. In ATOMIC units.
 * @param paymentID             The payment ID to include with this transaction.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param changeAddress         The address to send any returned change to.
 */
export declare function sendTransactionAdvanced(daemon: IDaemon, subWallets: SubWallets, addressesAndAmounts: Array<[string, number]>, mixin?: number, fee?: number, paymentID?: string, subWalletsToTakeFrom?: string[], changeAddress?: string): Promise<[TX | undefined, string | undefined, WalletError | undefined]>;
