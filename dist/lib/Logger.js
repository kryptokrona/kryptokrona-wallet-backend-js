"use strict";
// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
class Logger {
    constructor(level, callback) {
        this.logLevel = LogLevel.DISABLED;
        if (level) {
            this.logLevel = level;
        }
    }
    log(message, level, categories) {
        if (level === LogLevel.DISABLED) {
            throw new Error('You cannot log at the "DISABLED" level!');
        }
        if (!categories) {
            categories = [];
        }
        const date = new Date().toUTCString();
        let output = `[${date}] [${logLevelToString(level)}]`;
        for (const category of categories) {
            output += ` [${logCategoryToString(category)}]`;
        }
        output += `: ${message}`;
        if (level >= this.logLevel) {
            /* If the user provides a callback, log to that instead */
            if (this.callback) {
                this.callback(output, message, level, categories);
            }
            else {
                console.log(output);
            }
        }
    }
    setLogLevel(logLevel) {
        this.logLevel = logLevel;
    }
    setLoggerCallback(callback) {
        this.callback = callback;
    }
}
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARNING"] = 2] = "WARNING";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["DISABLED"] = 4] = "DISABLED";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
function logLevelToString(level) {
    switch (level) {
        case LogLevel.DISABLED: {
            return 'Disabled';
        }
        case LogLevel.DEBUG: {
            return 'Debug';
        }
        case LogLevel.INFO: {
            return 'Info';
        }
        case LogLevel.WARNING: {
            return 'Warning';
        }
        case LogLevel.ERROR: {
            return 'Error';
        }
    }
}
var LogCategory;
(function (LogCategory) {
    LogCategory[LogCategory["SYNC"] = 0] = "SYNC";
    LogCategory[LogCategory["TRANSACTIONS"] = 1] = "TRANSACTIONS";
})(LogCategory = exports.LogCategory || (exports.LogCategory = {}));
function logCategoryToString(category) {
    switch (category) {
        case LogCategory.SYNC: {
            return 'Sync';
        }
        case LogCategory.TRANSACTIONS: {
            return 'Transactions';
        }
    }
}
exports.logger = new Logger();
