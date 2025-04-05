import { ApiResult, PromptMetadata } from '../../../shared/types';

export const IPromptServiceToken = Symbol('IPromptService');

export interface IPromptService {
    getPromptFiles(
        promptIdOrDir: string,
        options?: { cleanVariables?: boolean }
    ): Promise<ApiResult<{ promptContent: string; metadata: PromptMetadata }>>;
    getPromptById(promptId: string): Promise<ApiResult<PromptMetadata | null>>;
}
