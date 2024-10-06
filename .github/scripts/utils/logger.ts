import config from '../config';

/**
 * Enum representing different log levels.
 */
enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

/**
 * Type for log level keys, including both uppercase and lowercase versions.
 */
type LogLevelKey = keyof typeof LogLevel | Lowercase<keyof typeof LogLevel>;

/**
 * Interface for the logger object.
 */
interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    setLogLevel(level: LogLevelKey): void;
}

/**
 * Mapping of log level keys to console methods.
 */
const logMethods: Record<Uppercase<LogLevelKey>, keyof Console> = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
};

/**
 * Function to normalize log level key to uppercase.
 */
function normalizeLogLevel(level: LogLevelKey): keyof typeof LogLevel {
    return level.toUpperCase() as keyof typeof LogLevel;
}

/**
 * Class representing a logger with configurable log levels.
 */
class ConfigurableLogger implements Logger {
    private currentLogLevel: LogLevel;

    constructor(initialLogLevel: LogLevelKey = config.LOG_LEVEL) {
        this.currentLogLevel = LogLevel[normalizeLogLevel(initialLogLevel)];
    }

    /**
     * Sets the current log level.
     * @param level - The log level to set.
     */
    setLogLevel(level: LogLevelKey): void {
        this.currentLogLevel = LogLevel[normalizeLogLevel(level)];
    }

    /**
     * Logs a message if the current log level allows it.
     * @param level - The log level of the message.
     * @param message - The message to log.
     * @param args - Additional arguments to log.
     */
    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        if (level >= this.currentLogLevel) {
            const timestamp = new Date().toISOString();
            const logLevelKey = LogLevel[level] as keyof typeof LogLevel;
            const logMethod = logMethods[logLevelKey];

            // Explicitly type the console method
            const consoleMethod = console[logMethod] as (...args: unknown[]) => void;
            consoleMethod(`[${timestamp}] [${logLevelKey}]:`, message, ...args);
        }
    }

    /**
     * Logs a debug message.
     * @param message - The message to log.
     * @param args - Additional arguments to log.
     */
    debug(message: string, ...args: unknown[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    /**
     * Logs an info message.
     * @param message - The message to log.
     * @param args - Additional arguments to log.
     */
    info(message: string, ...args: unknown[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    /**
     * Logs a warning message.
     * @param message - The message to log.
     * @param args - Additional arguments to log.
     */
    warn(message: string, ...args: unknown[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    /**
     * Logs an error message.
     * @param message - The message to log.
     * @param args - Additional arguments to log.
     */
    error(message: string, ...args: unknown[]): void {
        this.log(LogLevel.ERROR, message, ...args);
    }
}

// Create and export a single instance of the logger
const logger = new ConfigurableLogger();
export default logger;
