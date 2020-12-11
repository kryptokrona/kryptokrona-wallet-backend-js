// Copyright (c) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { IConfig, Config, MergeConfig } from './Config';

export class FeeType {
    /**
     * Uses the lowest fee possible. Currently is a fee per byte of 1.953125.
     */
    public static MinimumFee(config: IConfig = new Config()): FeeType {
        const tempConfig: Config = MergeConfig(config);

        return FeeType.FeePerByte(tempConfig.minimumFeePerByte);
    }

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
    public static FeePerByte(feePerByte: number): FeeType {
        const fee = new FeeType();

        fee.isFeePerByte = true;
        fee.feePerByte = feePerByte;

        return fee;
    }

    /**
     * Specify a fixed fee to use. The transaction will fail if the calculated
     * minimum fee per byte for the transaction is lower than the specified
     * fixed fee.
     *
     * @param fixedFee  The fixed fee to use
     */
    public static FixedFee(fixedFee: number): FeeType {
        const fee = new FeeType();

        fee.isFixedFee = true;
        fee.fixedFee = fixedFee;

        return fee;
    }

    public isFixedFee: boolean = false;

    public isFeePerByte: boolean = false;

    public fixedFee: number = 0;

    public feePerByte: number = 0;

    private constructor() {
    }
}
