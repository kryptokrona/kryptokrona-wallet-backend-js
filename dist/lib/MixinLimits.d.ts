export declare class MixinLimit {
    readonly height: number;
    readonly minMixin: number;
    readonly maxMixin: number;
    readonly defaultMixin: number;
    constructor(height: number, minMixin: number, maxMixin?: number, defaultMixin?: number);
}
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
