"use strict";
// Copyright (C) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertStringOrUndefined = assertStringOrUndefined;
exports.assertString = assertString;
exports.assertNumberOrUndefined = assertNumberOrUndefined;
exports.assertNumber = assertNumber;
exports.assertBooleanOrUndefined = assertBooleanOrUndefined;
exports.assertBoolean = assertBoolean;
exports.assertArrayOrUndefined = assertArrayOrUndefined;
exports.assertArray = assertArray;
exports.assertObjectOrUndefined = assertObjectOrUndefined;
exports.assertObject = assertObject;
exports.assertType = assertType;
const _ = require("lodash");
function assertStringOrUndefined(param, name) {
    return assertType(param, name, 'string', _.isString, true);
}
function assertString(param, name) {
    return assertType(param, name, 'string', _.isString, false);
}
function assertNumberOrUndefined(param, name) {
    return assertType(param, name, 'number', _.isNumber, true);
}
function assertNumber(param, name) {
    return assertType(param, name, 'number', _.isNumber, false);
}
function assertBooleanOrUndefined(param, name) {
    return assertType(param, name, 'boolean', _.isBoolean, true);
}
function assertBoolean(param, name) {
    return assertType(param, name, 'boolean', _.isBoolean, false);
}
function assertArrayOrUndefined(param, name) {
    return assertType(param, name, 'array', _.isArray, true);
}
function assertArray(param, name) {
    return assertType(param, name, 'array', _.isArray, false);
}
function assertObjectOrUndefined(param, name) {
    return assertType(param, name, 'object', _.isObject, true);
}
function assertObject(param, name) {
    return assertType(param, name, 'object', _.isObject, false);
}
function assertType(param, name, correctType, typeVerificationFunc, allowUndefined) {
    if (allowUndefined && param === undefined) {
        return;
    }
    if (!typeVerificationFunc(param)) {
        throw new Error(`Expected ${correctType} for '${name}' parameter, but got ${typeof param}`);
    }
}
