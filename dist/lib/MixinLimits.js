"use strict";
// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
class MixinLimit {
    constructor(height, minMixin, maxMixin, defaultMixin) {
        this.height = height;
        this.minMixin = minMixin;
        this.maxMixin = maxMixin === undefined ? minMixin : maxMixin;
        this.defaultMixin = defaultMixin === undefined ? minMixin : defaultMixin;
    }
}
exports.MixinLimit = MixinLimit;
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
