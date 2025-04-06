import { Injectable, Scope } from '@nestjs/common';

import { COMMON_UI } from '../../../shared/constants';
import { ApiResult, Result } from '../../../shared/types';
import { StringFormatterService } from '../../common/services/string-formatter.service';

type MessageLevel = 'success' | 'error' | 'warning' | 'info';

@Injectable({ scope: Scope.DEFAULT })
export class ConsoleService {
    constructor(private readonly stringFormatterService: StringFormatterService) {}

    formatMessage(template: string, ...args: unknown[]): string {
        return this.stringFormatterService.formatMessage(template, ...args);
    }

    private displayMessage(level: MessageLevel, message: string, ...args: unknown[]): ApiResult<void> {
        try {
            const formattedMessage = this.formatMessage(message, ...args);
            let styledMessage: string;
            let outputMethod: 'log' | 'error' | 'warn' = 'log';
            switch (level) {
                case 'success':
                    styledMessage = COMMON_UI.FORMATTERS.formatSuccess(formattedMessage);
                    break;
                case 'error':
                    styledMessage = COMMON_UI.FORMATTERS.formatError(formattedMessage);
                    outputMethod = 'error';
                    break;
                case 'warning':
                    styledMessage = COMMON_UI.FORMATTERS.formatWarning(formattedMessage);
                    outputMethod = 'warn';
                    break;
                case 'info':
                    styledMessage = COMMON_UI.FORMATTERS.formatInfo(formattedMessage);
                    break;
                default:
                    styledMessage = formattedMessage;
            }
            console[outputMethod](styledMessage);
            return Result.success(undefined);
        } catch (error) {
            if (level === 'error') {
                try {
                    console.error(`Error (formatting failed): ${message}`);
                    // eslint-disable-next-line unused-imports/no-unused-vars
                } catch (_unused) {
                    // Empty catch block - last resort error handling
                }
                return Result.failure(`Failed to format error message: ${error}`);
            }
            return Result.failure(`Failed to display ${level} message: ${error}`);
        }
    }

    success(message: string, ...args: unknown[]): ApiResult<void> {
        return this.displayMessage('success', message, ...args);
    }

    error(message: string, ...args: unknown[]): ApiResult<void> {
        return this.displayMessage('error', message, ...args);
    }

    warning(message: string, ...args: unknown[]): ApiResult<void> {
        return this.displayMessage('warning', message, ...args);
    }

    info(message: string, ...args: unknown[]): ApiResult<void> {
        return this.displayMessage('info', message, ...args);
    }

    print(message: string, formatter?: (message: string) => string, ...args: unknown[]): ApiResult<void> {
        try {
            const formattedMessage = this.formatMessage(message, ...args);
            const finalMessage = formatter ? formatter(formattedMessage) : formattedMessage;
            console.log(finalMessage);
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(`Failed to print message: ${error}`);
        }
    }

    log(message: unknown, ...args: unknown[]): ApiResult<void> {
        try {
            console.log(message, ...args);
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(`Failed to log message: ${error}`);
        }
    }

    warn(message: unknown, ...args: unknown[]): ApiResult<void> {
        try {
            console.warn(message, ...args);
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(`Failed to warn message: ${error}`);
        }
    }

    clear(): ApiResult<void> {
        try {
            process.stdout.write('\x1Bc');
            return Result.success(undefined);
        } catch (error) {
            return Result.failure(`Failed to clear console: ${error}`);
        }
    }
}
