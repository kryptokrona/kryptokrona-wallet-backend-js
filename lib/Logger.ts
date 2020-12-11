// Copyright (C) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

class Logger {
    /**
     * Level to log at
     */
    private logLevel: LogLevel = LogLevel.DISABLED;

    /**
     * Callback to use instead of console.log
     */
    private callback?: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any;

    constructor(
        level?: LogLevel,
        callback?: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any) {

        if (level) {
            this.logLevel = level;
        }
    }

    /**
     * @param message       The message to log
     * @param level         The level to log at
     * @param categories    The category or categories this message belongs to, if any
     *
     * Logs a message either to console.log, or the callback if defined
     */
    public log(message: string, level: LogLevel, categories?: (LogCategory | LogCategory[])) {
        if (level === LogLevel.DISABLED) {
            throw new Error('You cannot log at the "DISABLED" level!');
        }

        if (!categories) {
            categories = [];
        } else if (!Array.isArray(categories)) {
            categories = [categories];
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

    /**
     * Sets the log level. Log messages below this level are not shown.
     */
    public setLogLevel(logLevel: LogLevel) {
        this.logLevel = logLevel;
    }

    /**
     * @param callback The callback to use for log messages
     * @param callback.prettyMessage A nicely formatted log message, with timestamp, levels, and categories
     * @param callback.message       The raw log message
     * @param callback.level         The level at which the message was logged at
     * @param callback.categories    The categories this log message falls into
     *
     * Sets a callback to be used instead of console.log for more fined control
     * of the logging output.
     *
     * Usage:
     * ```
     * wallet.setLoggerCallback((prettyMessage, message, level, categories) => {
     *       if (categories.includes(LogCategory.SYNC)) {
     *           console.log(prettyMessage);
     *       }
     *   });
     * ```
     *
     */
    public setLoggerCallback(
        callback: (prettyMessage: string,
                   message: string,
                   level: LogLevel,
                   categories: LogCategory[]) => any) {

        this.callback = callback;
    }
}

/**
 * Levels to log at
 */
export enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARNING = 3,
    ERROR = 4,
    DISABLED = 5,
}

/**
 * Convert a log level to a string
 */
function logLevelToString(level: LogLevel) {
    switch (level) {
        case LogLevel.DISABLED: {
            return 'Disabled';
        }
        case LogLevel.TRACE: {
            return 'Trace';
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

/**
 * Possible categories log messages can be in
 */
export enum LogCategory {
    SYNC,
    TRANSACTIONS,
    FILESYSTEM,
    SAVE,
    DAEMON,
    GENERAL,
}

/**
 * Convert a log category to a string
 */
function logCategoryToString(category: LogCategory) {
    switch (category) {
        case LogCategory.SYNC: {
            return 'Sync';
        }
        case LogCategory.TRANSACTIONS: {
            return 'Transactions';
        }
        case LogCategory.FILESYSTEM: {
            return 'Filesystem';
        }
        case LogCategory.SAVE: {
            return 'Save';
        }
        case LogCategory.DAEMON: {
            return 'Daemon';
        }
        case LogCategory.GENERAL: {
            return 'General';
        }
    }
}

export let logger = new Logger();
