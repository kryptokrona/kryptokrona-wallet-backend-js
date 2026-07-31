"use strict";
// Copyright (C) 2019-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertType = exports.assertObject = exports.assertObjectOrUndefined = exports.assertArray = exports.assertArrayOrUndefined = exports.assertBoolean = exports.assertBooleanOrUndefined = exports.assertNumber = exports.assertNumberOrUndefined = exports.assertString = exports.assertStringOrUndefined = void 0;
const _ = require("lodash");
function assertStringOrUndefined(param, name) {
    return assertType(param, name, 'string', _.isString, true);
}
exports.assertStringOrUndefined = assertStringOrUndefined;
function assertString(param, name) {
    return assertType(param, name, 'string', _.isString, false);
}
exports.assertString = assertString;
function assertNumberOrUndefined(param, name) {
    return assertType(param, name, 'number', _.isNumber, true);
}
exports.assertNumberOrUndefined = assertNumberOrUndefined;
function assertNumber(param, name) {
    return assertType(param, name, 'number', _.isNumber, false);
}
exports.assertNumber = assertNumber;
function assertBooleanOrUndefined(param, name) {
    return assertType(param, name, 'boolean', _.isBoolean, true);
}
exports.assertBooleanOrUndefined = assertBooleanOrUndefined;
function assertBoolean(param, name) {
    return assertType(param, name, 'boolean', _.isBoolean, false);
}
exports.assertBoolean = assertBoolean;
function assertArrayOrUndefined(param, name) {
    return assertType(param, name, 'array', _.isArray, true);
}
exports.assertArrayOrUndefined = assertArrayOrUndefined;
function assertArray(param, name) {
    return assertType(param, name, 'array', _.isArray, false);
}
exports.assertArray = assertArray;
function assertObjectOrUndefined(param, name) {
    return assertType(param, name, 'object', _.isObject, true);
}
exports.assertObjectOrUndefined = assertObjectOrUndefined;
function assertObject(param, name) {
    return assertType(param, name, 'object', _.isObject, false);
}
exports.assertObject = assertObject;
function assertType(param, name, correctType, typeVerificationFunc, allowUndefined) {
    if (allowUndefined && param === undefined) {
        return;
    }
    if (!typeVerificationFunc(param)) {
        throw new Error(`Expected ${correctType} for '${name}' parameter, but got ${typeof param}`);
    }
}
exports.assertType = assertType;
