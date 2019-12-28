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
     * Returns the default mixin for the given height.
     */
    public getDefaultMixinByHeight(height: number): number {
        /* No limits defined, or height is before first limit */
        if (this.limits.length === 0 || (_.last(this.limits) as MixinLimit).height > height) {
            return this.defaultMixin;
        }

        for (const limit of this.limits) {
            if (height > limit.height) {
                return limit.defaultMixin;
            }
        }

        throw new Error('Something happened :^)');
    }

    /**
     * Returns the minimum and maximum mixin for the given height.
     */
    public getMixinLimitsByHeight(height: number): [number, number] {
        let minimumMixin = 0;
        let maximumMixin = 2 ** 64;

        for (const limit of this.limits) {
            if (height > limit.height) {
                minimumMixin = limit.minMixin;
                maximumMixin = limit.maxMixin;
            }
        }

        return [minimumMixin, maximumMixin];
    }
}
