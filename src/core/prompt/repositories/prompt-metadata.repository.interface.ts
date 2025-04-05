import { ApiResult, PromptMetadata, CategoryItem } from '../../../shared/types';

export const IPromptMetadataRepository = Symbol('IPromptMetadataRepository');

export interface IPromptMetadataRepository {
    getCategories(): Promise<ApiResult<Record<string, CategoryItem[]>>>;
    getPromptMetadata(promptId: string, options?: { cleanVariables?: boolean }): Promise<ApiResult<PromptMetadata>>;
    clearPromptFromCache(promptId: string | 'all'): void;
    getAllPromptsList(): Promise<ApiResult<CategoryItem[]>>;
}
