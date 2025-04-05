import { Injectable, Scope } from '@nestjs/common';

import { ApiResult } from '../../../shared/types';
import { ConsoleService } from '../services/console.service';

@Injectable({ scope: Scope.DEFAULT })
export class ConsoleFacade {
    constructor(private readonly consoleService: ConsoleService) {}

    formatMessage(template: string, ...args: unknown[]): string {
        return this.consoleService.formatMessage(template, ...args);
    }

    format = this.formatMessage;

    success(message: string, ...args: unknown[]): ApiResult<void> {
        return this.consoleService.success(message, ...args);
    }

    error(message: string, ...args: unknown[]): ApiResult<void> {
        return this.consoleService.error(message, ...args);
    }

    warning(message: string, ...args: unknown[]): ApiResult<void> {
        return this.consoleService.warning(message, ...args);
    }

    info(message: string, ...args: unknown[]): ApiResult<void> {
        return this.consoleService.info(message, ...args);
    }

    print(message: string, formatter?: (message: string) => string, ...args: unknown[]): ApiResult<void> {
        return this.consoleService.print(message, formatter, ...args);
    }

    log(message: unknown, ...args: unknown[]): ApiResult<void> {
        return this.consoleService.log(message, ...args);
    }

    warn(message: unknown, ...args: unknown[]): ApiResult<void> {
        return this.consoleService.warn(message, ...args);
    }

    clear(): ApiResult<void> {
        return this.consoleService.clear();
    }
}
