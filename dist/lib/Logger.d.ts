declare class Logger {
    /**
     * Level to log at
     */
    private logLevel;
    /**
     * Callback to use instead of console.log
     */
    private callback?;
    constructor(level?: LogLevel, callback?: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any);
    /**
     * @param message       The message to log
     * @param level         The level to log at
     * @param categories    The category or categories this message belongs to, if any
     *
     * Logs a message either to console.log, or the callback if defined
     */
    log(message: string, level: LogLevel, categories?: (LogCategory | LogCategory[])): void;
    /**
     * Sets the log level. Log messages below this level are not shown.
     */
    setLogLevel(logLevel: LogLevel): void;
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
    setLoggerCallback(callback: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any): void;
}
/**
 * Levels to log at
 */
export declare enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARNING = 3,
    ERROR = 4,
    DISABLED = 5
}
/**
 * Possible categories log messages can be in
 */
export declare enum LogCategory {
    SYNC = 0,
    TRANSACTIONS = 1,
    FILESYSTEM = 2,
    SAVE = 3,
    DAEMON = 4,
    GENERAL = 5
}
export declare let logger: Logger;
export {};
