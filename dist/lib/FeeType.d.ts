import { IConfig } from './Config';
export declare class FeeType {
    /**
     * Uses the lowest fee possible. Currently is a fee per byte of 1.953125.
     */
    static MinimumFee(config?: IConfig): FeeType;
    /**
     * Specify a custom fee per byte to use. Can be a fractional amount.
     * Should be in atomic units.
     * Can not be lower than the minimum fee per byte allowed (currently 1.953125)
     *
     * Note that the fee per byte of the resulting transaction may be higher
     * than the specified fee per byte, but it will not be lower. It will also
     * not be any more than 2x higher than the specified fee per byte.
     * The fee per byte being potentially higher is due to how the transaction
     * size estimate process works.
     *
     * @param feePerByte    The custom fee per byte value to use.
     */
    static FeePerByte(feePerByte: number): FeeType;
    /**
     * Specify a fixed fee to use. The transaction will fail if the calculated
     * minimum fee per byte for the transaction is lower than the specified
     * fixed fee.
     *
     * @param fixedFee  The fixed fee to use
     */
    static FixedFee(fixedFee: number): FeeType;
    isFixedFee: boolean;
    isFeePerByte: boolean;
    fixedFee: number;
    feePerByte: number;
    private constructor();
}
