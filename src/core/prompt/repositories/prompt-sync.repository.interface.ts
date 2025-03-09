import { ApiResult, PromptSyncResult } from '../../../shared/types';

export const IPromptSyncRepository = Symbol('IPromptSyncRepository');

export interface IPromptSyncRepository {
    syncPromptsWithFileSystem(): Promise<ApiResult<void>>;
    syncSpecificPrompt(directoryName: string): Promise<ApiResult<PromptSyncResult>>;
    removePromptFromDatabase(directoryOrId: string): Promise<boolean>;
}
