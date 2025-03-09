import path from 'path';

import { Injectable, Scope } from '@nestjs/common';
import chalk from 'chalk';
import fs from 'fs-extra';

import { commonConfig } from '../../../shared/config';
import { CONFIG_DIR } from '../../../shared/constants';
import { ApiResult, Result } from '../../../shared/types';

enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
}
type LogLevelKey = keyof typeof LogLevel | Lowercase<keyof typeof LogLevel>;
const logColors: Record<keyof typeof LogLevel, chalk.ChalkFunction> = {
    DEBUG: chalk.blue,
    INFO: chalk.green,
    WARN: chalk.yellow,
    ERROR: chalk.red
};
@Injectable({ scope: Scope.DEFAULT })
export class LoggerService {
    private currentLogLevel: LogLevel;
    private fileLogging: boolean;
    private logFilePath: string;

    constructor() {
        const logLevel = (process.env.LOG_LEVEL as LogLevelKey) || commonConfig.LOG_LEVEL;
        this.currentLogLevel = LogLevel[this.normalizeLogLevel(logLevel)];
        this.fileLogging = process.env.LOG_TO_FILE === 'true' || false;
        this.logFilePath = path.join(CONFIG_DIR, 'prompt-library.log');

        if (process.env.LOG_TO_FILE !== 'false') {
            this.enableFileLogging(true);
        }
    }

    enableFileLogging(enabled: boolean): ApiResult<void> {
        try {
            this.fileLogging = enabled;

            if (enabled) {
                fs.ensureDirSync(CONFIG_DIR);

                if (!fs.existsSync(this.logFilePath)) {
                    const startMessage = `\n=== Prompt Library Log Started at ${new Date().toISOString()} ===\n`;
                    fs.appendFileSync(this.logFilePath, startMessage);
                }

                this.debug('File logging enabled');
            } else {
                this.debug('File logging disabled');
            }
            return Result.success(undefined);
        } catch (error) {
            console.error(`Failed to ${enabled ? 'enable' : 'disable'} file logging: ${error}`);
            return Result.failure(`Failed to ${enabled ? 'enable' : 'disable'} file logging: ${error}`);
        }
    }

    setLogFilePath(filePath: string): ApiResult<void> {
        try {
            this.logFilePath = filePath;
            this.debug(`Log file path set to ${filePath}`);
            return Result.success(undefined);
        } catch (error) {
            console.error(`Failed to set log file path: ${error}`);
            return Result.failure(`Failed to set log file path: ${error}`);
        }
    }

    setLogLevel(level: LogLevelKey): ApiResult<void> {
        try {
            this.currentLogLevel = LogLevel[this.normalizeLogLevel(level)];
            this.debug(`Log level set to ${level}`);
            return Result.success(undefined);
        } catch (error) {
            console.error(`Failed to set log level to ${level}: ${error}`);
            return Result.failure(`Failed to set log level to ${level}: ${error}`);
        }
    }

    private normalizeLogLevel(level: LogLevelKey): keyof typeof LogLevel {
        const upperLevel = level?.toUpperCase() as keyof typeof LogLevel;

        if (LogLevel[upperLevel] !== undefined) {
            return upperLevel;
        }

        console.warn(`Invalid log level "${level}", defaulting to INFO.`);
        return 'INFO';
    }

    private formatLogMessage(level: keyof typeof LogLevel, message: string, ...args: unknown[]): string {
        const timestamp = new Date().toISOString();
        const baseMessage = `[${timestamp}] [${level}]: ${message}`;
        return this.formatMessage(baseMessage, ...args);
    }

    private writeToLogFile(level: keyof typeof LogLevel, message: string, ...args: unknown[]): void {
        if (!this.fileLogging) return;

        try {
            const formattedMessage = this.formatLogMessage(level, message, ...args);
            fs.appendFileSync(this.logFilePath, `${formattedMessage}\n`);
        } catch (error) {
            console.error(`Failed to write to log file: ${error}`);
        }
    }

    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        if (level >= this.currentLogLevel) {
            const logLevelKey = LogLevel[level] as keyof typeof LogLevel;
            this.writeToLogFile(logLevelKey, message, ...args);
            const colorFunc = logColors[logLevelKey];
            const formattedMessage = this.formatLogMessage(logLevelKey, message, ...args);
            switch (level) {
                case LogLevel.DEBUG:
                    console.debug(colorFunc(formattedMessage));
                    break;
                case LogLevel.INFO:
                    console.info(colorFunc(formattedMessage));
                    break;
                case LogLevel.WARN:
                    console.warn(colorFunc(formattedMessage));
                    break;
                case LogLevel.ERROR:
                    console.error(colorFunc(formattedMessage));
                    break;
            }
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
    success(message: string, ...args: unknown[]): void {
        const successMessage = `[SUCCESS] ${message}`;
        this.log(LogLevel.INFO, successMessage, ...args);
        console.log(chalk.green(`✓ ${this.formatMessage(message, ...args)}`));
    }

    private formatMessage(template: string, ...args: any[]): string {
        if (!args || args.length === 0) return template;
        return template.replace(/{(\d+)}/g, (match, index) => {
            const i = Number(index);
            return i < args.length ? String(args[i]) : match;
        });
    }
}
