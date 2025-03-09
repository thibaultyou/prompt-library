import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { ERROR_MESSAGES, WARNING_MESSAGES } from '../../../shared/constants';
import { AppErrorType } from '../../../shared/types/errors/app-error';
import { LoggerService } from '../../logger/services/logger.service';

export class AppError extends Error implements AppErrorType {
    constructor(
        public code: string,
        message: string
    ) {
        super(message);
        this.name = 'AppError';
    }
}

@Injectable({ scope: Scope.DEFAULT })
export class ErrorService {
    constructor(
        @Inject(forwardRef(() => LoggerService))
        private readonly loggerService: LoggerService
    ) {}

    public createAppError(code: string, message: string): AppError {
        return new AppError(code, message);
    }

    private formatMessage(template: string, ...args: any[]): string {
        if (!args || args.length === 0) return template;
        return template.replace(/{(\d+)}/g, (match, index) => {
            const i = Number(index);
            return i < args.length ? String(args[i]) : match;
        });
    }

    public handleError(error: unknown, context: string): void {
        this.loggerService.error(`Error in ${context}:`);

        if (error instanceof AppError) {
            this.loggerService.error(`[${error.code}] ${error.message}`);
        } else if (error instanceof Error) {
            this.loggerService.error(error.message);

            if (error.stack) {
                this.loggerService.debug('Stack trace:');
                this.loggerService.debug(error.stack);
            }
        } else if (typeof error === 'string') {
            this.loggerService.error(error);
        } else {
            const errorString = JSON.stringify(error);
            this.loggerService.error(`Unknown error: ${errorString}`);
        }

        this.loggerService.info(ERROR_MESSAGES.FEEDBACK_SUGGESTION);
    }

    public logError(message: string, context: string, ...params: unknown[]): void {
        const finalMessage = this.formatMessage(message, ...params);
        this.loggerService.error(`[${context}] ${finalMessage}`);
    }

    public logWarning(message: string, context: string, ...params: unknown[]): void {
        const finalMessage = this.formatMessage(message, ...params);
        this.loggerService.warn(`[${context}] ${finalMessage}`);
    }

    public throwError(code: string, message: string, ...params: unknown[]): never {
        const finalMessage = this.formatMessage(message, ...params);
        throw this.createAppError(code, finalMessage);
    }

    public handleCommandError(error: unknown, context: string): void {
        this.loggerService.error(`Error during ${context}:`);

        if (error instanceof Error) {
            this.loggerService.error(error.message);

            if (error.stack) {
                const stackTrace = error.stack.split('\n')[1] || '';
                this.loggerService.debug(`Stack trace: ${stackTrace}`);
            }
        } else {
            this.loggerService.error(String(error));
        }

        this.handleError(error, `command:${context}`);
    }

    public handleGlobalError(error: unknown): void {
        this.loggerService.error(ERROR_MESSAGES.GLOBAL_ERROR);

        if (error instanceof Error) {
            this.loggerService.error(error.message);

            if (error.stack) {
                const stackLines = error.stack.split('\n').slice(1, 5);
                this.loggerService.debug('Stack trace:');
                stackLines.forEach((line) => {
                    this.loggerService.debug(`  ${line.trim()}`);
                });
            }
        } else {
            this.loggerService.error(String(error));
        }

        this.loggerService.info(ERROR_MESSAGES.FEEDBACK_SUGGESTION);
    }

    public handleUserCancellation(): void {
        this.loggerService.warn(WARNING_MESSAGES.USER_CANCELLATION);
    }

    public showInitializationError(details: string): void {
        this.loggerService.error(`${ERROR_MESSAGES.INITIALIZATION} ${details}`);
    }

    public showDatabaseError(details: string): void {
        this.loggerService.error(`${ERROR_MESSAGES.DATABASE} ${details}`);
    }
}
