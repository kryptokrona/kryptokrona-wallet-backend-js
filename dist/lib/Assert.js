"use strict";
// Copyright (C) 2019, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
function assertString(param, name) {
    if (!_.isString(param)) {
        throw new Error(`${name} parameter is not a string!`);
    }
}
exports.assertString = assertString;
function assertNumber(param, name) {
    if (!_.isNumber(param)) {
        throw new Error(`${name} parameter is not a number!`);
    }
}
exports.assertNumber = assertNumber;
function assertBoolean(param, name) {
    if (!_.isBoolean(param)) {
        throw new Error(`${name} parameter is not a boolean!`);
    }
}
exports.assertBoolean = assertBoolean;
