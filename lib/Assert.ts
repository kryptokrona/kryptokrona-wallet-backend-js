// Copyright (C) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

import * as _ from 'lodash';

export function assertStringOrUndefined(param: unknown, name: string): void {
    return assertType(param, name, 'string', _.isString, true);
}

export function assertString(param: unknown, name: string): void {
    return assertType(param, name, 'string', _.isString, false);
}

export function assertNumberOrUndefined(param: unknown, name: string): void {
    return assertType(param, name, 'number', _.isNumber, true);
}

export function assertNumber(param: unknown, name: string): void {
    return assertType(param, name, 'number', _.isNumber, false);
}

export function assertBooleanOrUndefined(param: unknown, name: string): void {
    return assertType(param, name, 'boolean', _.isBoolean, true);
}

export function assertBoolean(param: unknown, name: string): void {
    return assertType(param, name, 'boolean', _.isBoolean, false);
}

export function assertArrayOrUndefined(param: unknown, name: string): void {
    return assertType(param, name, 'array', _.isArray, true);
}

export function assertArray(param: unknown, name: string): void {
    return assertType(param, name, 'array', _.isArray, false);
}

export function assertObjectOrUndefined(param: unknown, name: string): void {
    return assertType(param, name, 'object', _.isObject, true);
}

export function assertObject(param: unknown, name: string): void {
    return assertType(param, name, 'object', _.isObject, false);
}

export function assertType(
    param: unknown,
    name: string,
    correctType: string,
    typeVerificationFunc: (param: unknown) => boolean,
    allowUndefined: boolean): void {

    if (allowUndefined && param === undefined) {
        return;
    }

    if (!typeVerificationFunc(param)) {
        throw new Error(`Expected ${correctType} for '${name}' parameter, but got ${typeof param}`);
    }
}
