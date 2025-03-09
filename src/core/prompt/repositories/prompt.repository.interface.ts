import { ApiResult, PromptMetadata } from '../../../shared/types';

export const IPromptRepository = Symbol('IPromptRepository');

export interface IPromptRepository {
    getPromptById(promptId: string): Promise<ApiResult<PromptMetadata | null>>;
    getPromptFiles(
        promptIdOrDir: string,
        options?: { cleanVariables?: boolean }
    ): Promise<ApiResult<{ promptContent: string; metadata: PromptMetadata }>>;
    updateVariable(promptId: string, variableName: string, value: string): Promise<ApiResult<void>>;
    createPrompt(promptMetadata: PromptMetadata, content: string): Promise<ApiResult<number>>;
    updatePrompt(promptId: string, promptMetadata: PromptMetadata, content: string): Promise<ApiResult<void>>;
    deletePrompt(promptIdOrDir: string): Promise<ApiResult<void>>;
    getAllPrompts(): Promise<ApiResult<PromptMetadata[]>>;
    listPromptDirectories(): Promise<string[]>;
}
