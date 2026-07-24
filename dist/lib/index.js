"use strict";
// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.MixinLimits = exports.MixinLimit = exports.DaemonType = exports.TransactionInput = exports.validatePaymentID = exports.validateAddresses = exports.validateAddress = exports.LogCategory = exports.LogLevel = exports.createIntegratedAddress = exports.isValidMnemonicWord = exports.isValidMnemonic = exports.isHex64 = exports.prettyPrintAmount = exports.FeeType = exports.Daemon = exports.WalletBackend = exports.SUCCESS = exports.WalletErrorCode = exports.WalletError = void 0;
var WalletError_1 = require("./WalletError");
Object.defineProperty(exports, "WalletError", { enumerable: true, get: function () { return WalletError_1.WalletError; } });
Object.defineProperty(exports, "WalletErrorCode", { enumerable: true, get: function () { return WalletError_1.WalletErrorCode; } });
Object.defineProperty(exports, "SUCCESS", { enumerable: true, get: function () { return WalletError_1.SUCCESS; } });
var WalletBackend_1 = require("./WalletBackend");
Object.defineProperty(exports, "WalletBackend", { enumerable: true, get: function () { return WalletBackend_1.WalletBackend; } });
var Daemon_1 = require("./Daemon");
Object.defineProperty(exports, "Daemon", { enumerable: true, get: function () { return Daemon_1.Daemon; } });
var FeeType_1 = require("./FeeType");
Object.defineProperty(exports, "FeeType", { enumerable: true, get: function () { return FeeType_1.FeeType; } });
var Utilities_1 = require("./Utilities");
Object.defineProperty(exports, "prettyPrintAmount", { enumerable: true, get: function () { return Utilities_1.prettyPrintAmount; } });
Object.defineProperty(exports, "isHex64", { enumerable: true, get: function () { return Utilities_1.isHex64; } });
Object.defineProperty(exports, "isValidMnemonic", { enumerable: true, get: function () { return Utilities_1.isValidMnemonic; } });
Object.defineProperty(exports, "isValidMnemonicWord", { enumerable: true, get: function () { return Utilities_1.isValidMnemonicWord; } });
Object.defineProperty(exports, "createIntegratedAddress", { enumerable: true, get: function () { return Utilities_1.createIntegratedAddress; } });
var Logger_1 = require("./Logger");
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return Logger_1.LogLevel; } });
Object.defineProperty(exports, "LogCategory", { enumerable: true, get: function () { return Logger_1.LogCategory; } });
var ValidateParameters_1 = require("./ValidateParameters");
Object.defineProperty(exports, "validateAddress", { enumerable: true, get: function () { return ValidateParameters_1.validateAddress; } });
Object.defineProperty(exports, "validateAddresses", { enumerable: true, get: function () { return ValidateParameters_1.validateAddresses; } });
Object.defineProperty(exports, "validatePaymentID", { enumerable: true, get: function () { return ValidateParameters_1.validatePaymentID; } });
var Types_1 = require("./Types");
Object.defineProperty(exports, "TransactionInput", { enumerable: true, get: function () { return Types_1.TransactionInput; } });
Object.defineProperty(exports, "DaemonType", { enumerable: true, get: function () { return Types_1.DaemonType; } });
var MixinLimits_1 = require("./MixinLimits");
Object.defineProperty(exports, "MixinLimit", { enumerable: true, get: function () { return MixinLimits_1.MixinLimit; } });
Object.defineProperty(exports, "MixinLimits", { enumerable: true, get: function () { return MixinLimits_1.MixinLimits; } });
var Config_1 = require("./Config");
Object.defineProperty(exports, "Config", { enumerable: true, get: function () { return Config_1.Config; } });
// this is to keep pesky timeout errors away
// see https://stackoverflow.com/questions/24320578/node-js-get-request-etimedout-esockettimedout/37946324#37946324
process.env.UV_THREADPOOL_SIZE = '256';
