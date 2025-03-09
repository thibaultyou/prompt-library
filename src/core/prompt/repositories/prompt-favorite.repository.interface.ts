import { ApiResult } from '../../../shared/types';

export const IPromptFavoriteRepository = Symbol('IPromptFavoriteRepository');

export interface IPromptFavoriteRepository {
    getFavorites(): Promise<ApiResult<Record<string, unknown>[]>>;
    addToFavorites(promptId: string): Promise<ApiResult<void>>;
    removeFromFavorites(promptId: string): Promise<ApiResult<void>>;
    isInFavorites(promptId: string): Promise<boolean>;
    hasFavoritePrompts(): Promise<boolean>;
    deleteFavoritesForPrompt(promptId: string): Promise<ApiResult<void>>;
}
