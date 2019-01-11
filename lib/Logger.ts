// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

class Logger {
    private logLevel: LogLevel = LogLevel.DISABLED;

    private callback?: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any;

    constructor(
        level?: LogLevel,
        callback?: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any) {

        if (level) {
            this.logLevel = level;
        }
    }

    public log(message: string, level: LogLevel, categories?: LogCategory[]) {
        if (level === LogLevel.DISABLED) {
            throw new Error('You cannot log at the "DISABLED" level!');
        }

        if (!categories) {
            categories = [];
        }

        const date: string = new Date().toUTCString();

        let output: string = `[${date}] [${logLevelToString(level)}]`;

        for (const category of categories) {
            output += ` [${logCategoryToString(category)}]`;
        }

        output += `: ${message}`;

        if (level >= this.logLevel) {
            /* If the user provides a callback, log to that instead */
            if (this.callback) {
                this.callback(output, message, level, categories);
            } else {
                console.log(output);
            }
        }
    }

    public setLogLevel(logLevel: LogLevel) {
        this.logLevel = logLevel;
    }

    public setLoggerCallback(
        callback: (prettyMessage: string,
                   message: string,
                   level: LogLevel,
                   categories: LogCategory[]) => any) {

        this.callback = callback;
    }
}

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3,
    DISABLED = 4,
}

function logLevelToString(level: LogLevel) {
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

export enum LogCategory {
    SYNC,
    TRANSACTIONS,
}

function logCategoryToString(category: LogCategory) {
    switch (category) {
        case LogCategory.SYNC: {
            return 'Sync';
        }
        case LogCategory.TRANSACTIONS: {
            return 'Transactions';
        }
    }
}

export let logger = new Logger();
