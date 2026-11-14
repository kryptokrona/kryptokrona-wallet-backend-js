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
 * A table of mixin limits by height. At a height, the limit with the highest
 * activation height at or below that height applies (C++
 * `Mixins::getMixinAllowableRange`, Rust `xkr_consensus::mixin_limits`).
 *
 * @param limits        Mixin limits to apply. Can be empty
 * @param defaultMixin  Default mixin to use if no limits given or before the first limit comes into play
 */
export declare class MixinLimits {
    private readonly limits;
    private readonly defaultMixin;
    constructor(limits: MixinLimit[], defaultMixin: number);
    /**
     * Returns the limit that applies at the given height: the one with the
     * highest activation height at or below it. Undefined before the first limit.
     */
    getMixinLimitByHeight(height: number): MixinLimit | undefined;
    /**
     * Returns the default mixin for the given height.
     */
    getDefaultMixinByHeight(height: number): number;
    /**
     * Returns the minimum and maximum mixin for the given height.
     */
    getMixinLimitsByHeight(height: number): [number, number];
}
