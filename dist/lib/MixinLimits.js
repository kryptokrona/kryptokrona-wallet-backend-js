"use strict";
// Copyright (C) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MixinLimits = exports.MixinLimit = void 0;
const _ = require("lodash");
/**
 * @param height        Height this mixin limit becomes active at
 * @param minMixin      Minimum mixin allowed at this height
 * @param maxMixin      Maximum mixin allowed at this height
 * @param defaultMixin  Default mixin to use at this height (should be in min/max bounds)
 */
class MixinLimit {
    constructor(height, minMixin, maxMixin, defaultMixin) {
        this.height = height;
        this.minMixin = minMixin;
        this.maxMixin = maxMixin === undefined ? minMixin : maxMixin;
        this.defaultMixin = defaultMixin === undefined ? minMixin : defaultMixin;
    }
}
exports.MixinLimit = MixinLimit;
/**
 * @param limits        Mixin limits to apply. Can be empty
 * @param defaultMixin  Default mixin to use if no limits given or before the first limit comes into play
 */
class MixinLimits {
    constructor(limits, defaultMixin) {
        /* Order limits by height (descending) */
        this.limits = _.reverse(_.sortBy(limits, (limit) => limit.height));
        this.defaultMixin = defaultMixin;
    }
    /**
     * Returns the default mixin for the given height.
     */
    getDefaultMixinByHeight(height) {
        /* No limits defined, or height is before first limit */
        if (this.limits.length === 0 || _.last(this.limits).height > height) {
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
    getMixinLimitsByHeight(height) {
        let minimumMixin = 0;
        let maximumMixin = Math.pow(2, 64);
        for (const limit of this.limits) {
            if (height > limit.height) {
                minimumMixin = limit.minMixin;
                maximumMixin = limit.maxMixin;
            }
        }
        return [minimumMixin, maximumMixin];
    }
}
exports.MixinLimits = MixinLimits;
