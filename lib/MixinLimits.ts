// Copyright (C) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

/**
 * @param height        Height this mixin limit becomes active at
 * @param minMixin      Minimum mixin allowed at this height
 * @param maxMixin      Maximum mixin allowed at this height
 * @param defaultMixin  Default mixin to use at this height (should be in min/max bounds)
 */
export class MixinLimit {
    public readonly height: number;
    public readonly minMixin: number;
    public readonly maxMixin: number;
    public readonly defaultMixin: number;

    constructor(
        height: number,
        minMixin: number,
        maxMixin?: number,
        defaultMixin?: number) {

        this.height = height;
        this.minMixin = minMixin;

        this.maxMixin = maxMixin === undefined ? minMixin : maxMixin;
        this.defaultMixin = defaultMixin === undefined ? minMixin : defaultMixin;
    }
}

/**
 * A table of mixin limits by height. At a height, the limit with the highest
 * activation height at or below that height applies (C++
 * `Mixins::getMixinAllowableRange`, Rust `xkr_consensus::mixin_limits`).
 *
 * @param limits        Mixin limits to apply. Can be empty
 * @param defaultMixin  Default mixin to use if no limits given or before the first limit comes into play
 */
export class MixinLimits {
    private readonly limits: MixinLimit[];
    private readonly defaultMixin: number;

    constructor(limits: MixinLimit[], defaultMixin: number) {
        /* Order limits by height (descending) */
        this.limits = _.reverse(_.sortBy(limits, (limit) => limit.height));

        this.defaultMixin = defaultMixin;
    }

    /**
     * Returns the limit that applies at the given height: the one with the
     * highest activation height at or below it. Undefined before the first limit.
     */
    public getMixinLimitByHeight(height: number): MixinLimit | undefined {
        /* Limits are ordered by height, highest first, so the first match is
           the newest applicable limit */
        for (const limit of this.limits) {
            if (height >= limit.height) {
                return limit;
            }
        }

        return undefined;
    }

    /**
     * Returns the default mixin for the given height.
     */
    public getDefaultMixinByHeight(height: number): number {
        const limit: MixinLimit | undefined = this.getMixinLimitByHeight(height);

        /* No limits defined, or height is before first limit */
        if (limit === undefined) {
            return this.defaultMixin;
        }

        return limit.defaultMixin;
    }

    /**
     * Returns the minimum and maximum mixin for the given height.
     */
    public getMixinLimitsByHeight(height: number): [number, number] {
        const limit: MixinLimit | undefined = this.getMixinLimitByHeight(height);

        if (limit === undefined) {
            return [0, 2 ** 64];
        }

        return [limit.minMixin, limit.maxMixin];
    }
}
