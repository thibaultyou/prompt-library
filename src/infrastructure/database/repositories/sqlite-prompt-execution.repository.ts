import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { IPromptExecutionRepository } from '../../../core/prompt/repositories/prompt-execution.repository.interface';
import { SQL_QUERIES } from '../../../shared/constants';
import { ApiResult, Result } from '../../../shared/types';
import { ErrorService, AppError } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';
import { DatabaseService } from '../services/database.service';

@Injectable({ scope: Scope.DEFAULT })
export class SqlitePromptExecutionRepository implements IPromptExecutionRepository {
    constructor(
        private readonly dbService: DatabaseService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    async recordExecution(promptId: string): Promise<ApiResult<void>> {
        try {
            const id = parseInt(promptId, 10);

            if (isNaN(id)) return Result.failure(`Invalid prompt ID: ${promptId}`);

            const result = await this.dbService.runQuery(SQL_QUERIES.EXECUTION.RECORD, [id]);

            if (!result.success) {
                return Result.failure(result.error || 'Failed to record execution.');
            }

            this.loggerService.debug(`Recorded execution for prompt ID: ${id}`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed record execution for ${promptId}: ${message}`),
                'SqlitePromptExecutionRepository.recordExecution'
            );
            return Result.failure(`Failed to record execution: ${message}`);
        }
    }

    async getRecentExecutions(limit: number = 10): Promise<ApiResult<Record<string, unknown>[]>> {
        try {
            const result = await this.dbService.getAllRows<Record<string, unknown>>(SQL_QUERIES.EXECUTION.GET_RECENT, [
                limit
            ]);

            if (!result.success) {
                return Result.failure(result.error || 'Failed to fetch recent executions.');
            }

            const executions = (result.data || []).map((item) => ({
                ...item,
                prompt_id: String(item.prompt_id)
            }));
            this.loggerService.debug(`Fetched ${executions.length} recent executions.`);
            return Result.success(executions);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed get recent executions: ${message}`),
                'SqlitePromptExecutionRepository.getRecentExecutions'
            );
            return Result.failure(`Failed to get recent executions: ${message}`);
        }
    }

    async deleteExecutionsForPrompt(promptId: string): Promise<ApiResult<void>> {
        try {
            const id = parseInt(promptId, 10);

            if (isNaN(id)) return Result.failure(`Invalid prompt ID: ${promptId}`);

            const result = await this.dbService.runQuery(SQL_QUERIES.EXECUTION.DELETE, [id]);

            if (!result.success) {
                return Result.failure(result.error || `Failed to delete executions for prompt ID ${id}.`);
            }

            this.loggerService.debug(`Deleted execution history for prompt ID: ${id}`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed delete executions for ${promptId}: ${message}`),
                'SqlitePromptExecutionRepository.deleteExecutionsForPrompt'
            );
            return Result.failure(`Failed to delete execution history: ${message}`);
        }
    }
}
