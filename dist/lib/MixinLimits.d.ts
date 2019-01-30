/**
 * @param height        Height this mixin limit becomes active at
 * @param minMixin      Minimum mixin allowed at this height
 * @param maxMixin      Maximum mixin allowed at this height
 * @param defaultMixin  Default mixin to use at this height (should be in min/max bounds)
 */
export declare class MixinLimit {
    readonly height: number;
    readonly minMixin: number;
    readonly maxMixin: number;
    readonly defaultMixin: number;
    constructor(height: number, minMixin: number, maxMixin?: number, defaultMixin?: number);
}
/**
 * @param limits        Mixin limits to apply. Can be empty
 * @param defaultMixin  Default mixin to use if no limits given or before the first limit comes into play
 */
export declare class MixinLimits {
    private readonly limits;
    private readonly defaultMixin;
    constructor(limits: MixinLimit[], defaultMixin: number);
    /**
     * Returns the default mixin for the given height.
     */
    getDefaultMixinByHeight(height: number): number;
    /**
     * Returns the minimum and maximum mixin for the given height.
     */
    getMixinLimitsByHeight(height: number): [number, number];
}
