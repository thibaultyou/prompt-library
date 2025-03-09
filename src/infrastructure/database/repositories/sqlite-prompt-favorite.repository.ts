import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { IPromptFavoriteRepository } from '../../../core/prompt/repositories/prompt-favorite.repository.interface';
import { SQL_QUERIES } from '../../../shared/constants';
import { ApiResult, Result } from '../../../shared/types';
import { ErrorService, AppError } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';
import { DatabaseService } from '../services/database.service';

@Injectable({ scope: Scope.DEFAULT })
export class SqlitePromptFavoriteRepository implements IPromptFavoriteRepository {
    constructor(
        private readonly dbService: DatabaseService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    async getFavorites(): Promise<ApiResult<Record<string, unknown>[]>> {
        try {
            const result = await this.dbService.getAllRows<Record<string, unknown>>(SQL_QUERIES.FAVORITE.GET_ALL);

            if (!result.success) {
                return Result.failure(result.error || 'Failed to fetch favorites.');
            }

            const favorites = (result.data || []).map((item) => ({
                ...item,
                prompt_id: String(item.prompt_id)
            }));
            this.loggerService.debug(`Fetched ${favorites.length} favorite prompts.`);
            return Result.success(favorites);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to get favorites: ${message}`),
                'SqlitePromptFavoriteRepository.getFavorites'
            );
            return Result.failure(`Failed to fetch favorite prompts: ${message}`);
        }
    }

    async addToFavorites(promptId: string): Promise<ApiResult<void>> {
        try {
            const id = parseInt(promptId, 10);

            if (isNaN(id)) return Result.failure(`Invalid prompt ID: ${promptId}`);

            const result = await this.dbService.runQuery(SQL_QUERIES.FAVORITE.ADD_IGNORE_DUPLICATES, [id]);

            if (!result.success) {
                return Result.failure(result.error || `Failed to add prompt ID ${id} to favorites.`);
            }

            this.loggerService.debug(`Added prompt ID ${id} to favorites (or already existed).`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to add favorite ${promptId}: ${message}`),
                'SqlitePromptFavoriteRepository.addToFavorites'
            );
            return Result.failure(`Failed to add prompt to favorites: ${message}`);
        }
    }

    async removeFromFavorites(promptId: string): Promise<ApiResult<void>> {
        try {
            const id = parseInt(promptId, 10);

            if (isNaN(id)) return Result.failure(`Invalid prompt ID: ${promptId}`);

            const result = await this.dbService.runQuery(SQL_QUERIES.FAVORITE.DELETE, [id]);

            if (!result.success) {
                return Result.failure(result.error || `Failed to remove prompt ID ${id} from favorites.`);
            }

            if (result.data?.changes === 0) {
                this.loggerService.warn(`Prompt ID ${id} was not found in favorites.`);
            } else {
                this.loggerService.debug(`Removed prompt ID ${id} from favorites.`);
            }
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to remove favorite ${promptId}: ${message}`),
                'SqlitePromptFavoriteRepository.removeFromFavorites'
            );
            return Result.failure(`Failed to remove from favorites: ${message}`);
        }
    }

    async isInFavorites(promptId: string): Promise<boolean> {
        try {
            const id = parseInt(promptId, 10);

            if (isNaN(id)) return false;

            const result = await this.dbService.getSingleRow<{ count: number }>(SQL_QUERIES.FAVORITE.CHECK, [id]);
            return result.success && result.data ? result.data.count > 0 : false;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed check favorite status for ${promptId}: ${message}`),
                'SqlitePromptFavoriteRepository.isInFavorites'
            );
            return false;
        }
    }

    async hasFavoritePrompts(): Promise<boolean> {
        try {
            const result = await this.dbService.getSingleRow<{ count: number }>(SQL_QUERIES.FAVORITE.COUNT);
            return result.success && result.data ? result.data.count > 0 : false;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed check for any favorites: ${message}`),
                'SqlitePromptFavoriteRepository.hasFavoritePrompts'
            );
            return false;
        }
    }

    async deleteFavoritesForPrompt(promptId: string): Promise<ApiResult<void>> {
        try {
            const id = parseInt(promptId, 10);

            if (isNaN(id)) return Result.failure(`Invalid prompt ID: ${promptId}`);

            const result = await this.dbService.runQuery(SQL_QUERIES.FAVORITE.DELETE, [id]);

            if (!result.success) {
                return Result.failure(result.error || `Failed to delete favorites for prompt ID ${id}.`);
            }

            this.loggerService.debug(`Deleted favorite entries for prompt ID: ${id}`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed delete favorites for ${promptId}: ${message}`),
                'SqlitePromptFavoriteRepository.deleteFavoritesForPrompt'
            );
            return Result.failure(`Failed to delete favorite entries: ${message}`);
        }
    }
}
