import chalk from 'chalk';

import { commonConfig } from '../config/common.config';

enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
}

type LogLevelKey = keyof typeof LogLevel | Lowercase<keyof typeof LogLevel>;

interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    setLogLevel(level: LogLevelKey): void;
}

const logColors: Record<keyof typeof LogLevel, chalk.ChalkFunction> = {
    DEBUG: chalk.blue,
    INFO: chalk.green,
    WARN: chalk.yellow,
    ERROR: chalk.red
};

function normalizeLogLevel(level: LogLevelKey): keyof typeof LogLevel {
    return level.toUpperCase() as keyof typeof LogLevel;
}

class ConfigurableLogger implements Logger {
    private currentLogLevel: LogLevel;

    constructor(initialLogLevel: LogLevelKey = commonConfig.LOG_LEVEL) {
        this.currentLogLevel = LogLevel[normalizeLogLevel(initialLogLevel)];
    }

    setLogLevel(level: LogLevelKey): void {
        this.currentLogLevel = LogLevel[normalizeLogLevel(level)];
    }

    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        if (level >= this.currentLogLevel) {
            const timestamp = new Date().toISOString();
            const logLevelKey = LogLevel[level] as keyof typeof LogLevel;
            const colorFunc = logColors[logLevelKey];
            console.log(colorFunc(`[${timestamp}] [${logLevelKey}]: ${message}`), ...args);
        }
    }

    debug(message: string, ...args: unknown[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    info(message: string, ...args: unknown[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        this.log(LogLevel.ERROR, message, ...args);
    }
}

const logger = new ConfigurableLogger();

export default logger;
