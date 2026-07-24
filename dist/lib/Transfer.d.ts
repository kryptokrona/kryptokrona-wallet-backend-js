import { Config } from './Config';
import { FeeType } from './FeeType';
import { Daemon } from './Daemon';
import { SubWallets } from './SubWallets';
import { PreparedTransactionInfo, PreparedTransaction } from './Types';
/**
 * Sends a fusion transaction.
 * If you need more control, use `sendFusionTransactionAdvanced`
 * Note that if your wallet is fully optimized, this will be indicated in the
 * returned error code.
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
export declare function sendFusionTransactionBasic(config: Config, daemon: Daemon, subWallets: SubWallets): Promise<PreparedTransactionInfo>;
/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon and subWallets.
 * @param config
 * @param daemon                A daemon instance we can send the transaction to
 * @param subWallets            The subwallets instance to draw funds from
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param destination           The destination for the fusion transactions to be sent to.
 *                              Must be a subwallet in this container.
 * @param extraData             Extra arbitrary data to include in the transaction
 *
 * @return Returns either [transaction, transaction hash, undefined], or [undefined, undefined, error]
 */
export declare function sendFusionTransactionAdvanced(config: Config, daemon: Daemon, subWallets: SubWallets, mixin?: number, subWalletsToTakeFrom?: string[], destination?: string, extraData?: string): Promise<PreparedTransactionInfo>;
/**
 * Sends a transaction of amount to the address destination, using the
 * given payment ID, if specified.
 *
 * Network fee is set to default, mixin is set to default, all subwallets
 * are taken from, primary address is used as change address.
 *
 * If you need more control, use [[sendTransactionAdvanced]]
 *
 * @param config
 * @param daemon            A daemon instance we can send the transaction to
 * @param subWallets        The subwallets instance to draw funds from
 * @param destination       The address to send the funds to
 * @param amount            The amount to send, in ATOMIC units
 * @param paymentID         The payment ID to include with this transaction. Optional.
 * @param relayToNetwork
 * @param sendAll
 */
export declare function sendTransactionBasic(config: Config, daemon: Daemon, subWallets: SubWallets, destination: string, amount: number, paymentID?: string, relayToNetwork?: boolean, sendAll?: boolean): Promise<PreparedTransactionInfo>;
/**
 * Sends a transaction, which permits multiple amounts to different destinations,
 * specifying the mixin, fee, subwallets to draw funds from, and change address.
 *
 * All parameters are optional aside from daemon, subWallets, and addressesAndAmounts.
 * @param config
 * @param daemon                A daemon instance we can send the transaction to
 * @param subWallets            The subwallets instance to draw funds from
 * @param addressesAndAmounts   An array of destinations, and amounts to send to that
 *                              destination.
 * @param mixin                 The amount of input keys to hide your input with.
 *                              Your network may enforce a static mixin.
 * @param fee                   The network fee, fee per byte, or minimum fee to use
 *                              with this transaction. Defaults to minimum fee.
 * @param paymentID             The payment ID to include with this transaction.
 * @param subWalletsToTakeFrom  The addresses of the subwallets to draw funds from.
 * @param changeAddress         The address to send any returned change to.
 *
 * @param relayToNetwork        Whether we should submit the transaction to the network or not.
 *                              If set to false, allows you to review the transaction fee before sending it.
 *                              Use [[sendPreparedTransaction]] to send a transaction that you have not
 *                              relayed to the network. Defaults to true.
 *
 * @param sendAll               Whether we should send the entire balance available. Since fee per
 *                              byte means estimating fees is difficult, we can handle that process
 *                              on your behalf. The entire balance minus fees will be sent to the
 *                              first destination address. The amount given in the first destination
 *                              address will be ignored. Any following destinations will have
 *                              the given amount sent. For example, if your destinations array was
 *                              ```
 *                              [['address1', 0], ['address2', 50], ['address3', 100]]
 *                              ```
 *                              Then address2 would be sent 50, address3 would be sent 100,
 *                              and address1 would get whatever remains of the balance
 *                              after paying node/network fees.
 *                              Defaults to false.
 * @param extraData             Extra arbitrary data to include in the transaction
 */
export declare function sendTransactionAdvanced(config: Config, daemon: Daemon, subWallets: SubWallets, addressesAndAmounts: [string, number][], mixin?: number, fee?: FeeType, paymentID?: string, subWalletsToTakeFrom?: string[], changeAddress?: string, relayToNetwork?: boolean, sendAll?: boolean, extraData?: string): Promise<PreparedTransactionInfo>;
export declare function sendPreparedTransaction(transaction: PreparedTransaction, subWallets: SubWallets, daemon: Daemon, config: Config): Promise<PreparedTransactionInfo>;
