// Copyright (C) 2019, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

export function assertString(param: unknown, name: string): void {
    if (!_.isString(param)) {
        throw new Error(`${name} parameter is not a string!`);
    }
}

export function assertNumber(param: unknown, name: string): void {
    if (!_.isNumber(param)) {
        throw new Error(`${name} parameter is not a number!`);
    }
}

export function assertBoolean(param: unknown, name: string): void {
    if (!_.isBoolean(param)) {
        throw new Error(`${name} parameter is not a boolean!`);
    }
}
