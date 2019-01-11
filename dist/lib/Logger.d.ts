declare class Logger {
    private logLevel;
    private callback?;
    constructor(level?: LogLevel, callback?: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any);
    log(message: string, level: LogLevel, categories?: LogCategory[]): void;
    setLogLevel(logLevel: LogLevel): void;
    setLoggerCallback(callback: (prettyMessage: string, message: string, level: LogLevel, categories: LogCategory[]) => any): void;
}
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3,
    DISABLED = 4
}
export declare enum LogCategory {
    SYNC = 0,
    TRANSACTIONS = 1
}
export declare let logger: Logger;
export {};
