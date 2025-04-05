import { editor } from '@inquirer/prompts';
import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { ERROR_MESSAGES, WARNING_MESSAGES } from '../../../shared/constants';
import { ApiResult, Result } from '../../../shared/types';
import { ErrorService } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class EditorService {
    constructor(
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    public async editInEditor(
        content: string,
        options: { message?: string; postfix?: string } = {}
    ): Promise<ApiResult<string>> {
        try {
            const defaultMessage = 'Edit content in your editor';
            const result = await editor({
                message: options.message || defaultMessage,
                default: content,
                postfix: options.postfix || '.txt'
            });
            return Result.success(result);
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                this.loggerService.warn(WARNING_MESSAGES.EDITOR_FAILED);
                return Result.failure('Editor cancelled by user', { data: content });
            }

            this.errorService.handleError(error, 'opening editor');
            this.loggerService.warn(WARNING_MESSAGES.EDITOR_FAILED);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return Result.failure(ERROR_MESSAGES.EDITOR_OPEN_FAILED.replace('{0}', errorMessage), { data: content });
        }
    }
}
