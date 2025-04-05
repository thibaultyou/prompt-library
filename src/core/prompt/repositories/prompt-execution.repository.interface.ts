import { ApiResult } from '../../../shared/types';

export const IPromptExecutionRepository = Symbol('IPromptExecutionRepository');

export interface IPromptExecutionRepository {
    recordExecution(promptId: string): Promise<ApiResult<void>>;
    getRecentExecutions(limit?: number): Promise<ApiResult<Record<string, unknown>[]>>;
    deleteExecutionsForPrompt(promptId: string): Promise<ApiResult<void>>;
}
