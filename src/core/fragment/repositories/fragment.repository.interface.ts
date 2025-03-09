import { ApiResult, PromptFragment } from '../../../shared/types';

export const IFragmentRepository = Symbol('IFragmentRepository');

export interface IFragmentRepository {
    getAllFragments(): Promise<ApiResult<PromptFragment[]>>;
    getFragmentContent(category: string, name: string): Promise<ApiResult<string>>;
    addFragment(category: string, name: string, content: string): Promise<ApiResult<void>>;
    updateFragment(category: string, name: string, content: string): Promise<ApiResult<void>>;
    deleteFragment(category: string, name: string): Promise<ApiResult<void>>;
    getFragmentCategories(): Promise<ApiResult<string[]>>;
    getFragmentsByCategory(category: string): Promise<ApiResult<PromptFragment[]>>;
    getFragmentByPath(fragmentPath: string): Promise<ApiResult<PromptFragment>>;
    fragmentExists(category: string, name: string): Promise<boolean>;
    renameFragment(category: string, name: string, newCategory: string, newName: string): Promise<ApiResult<void>>;
    copyFragment(category: string, name: string, targetCategory: string, targetName: string): Promise<ApiResult<void>>;
}
