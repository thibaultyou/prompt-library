import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { DatabaseRepository } from './database.repository';
import { IPromptMetadataRepository } from '../../../core/prompt/repositories/prompt-metadata.repository.interface';
import { CACHE_TTL, SQL_QUERIES } from '../../../shared/constants';
import { ApiResult, PromptMetadata, PromptVariable, Result, CategoryItem } from '../../../shared/types';
import { ErrorService, AppError } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';
import { DatabaseService } from '../services/database.service';

@Injectable({ scope: Scope.DEFAULT })
export class SqlitePromptMetadataRepository implements IPromptMetadataRepository {
    private readonly CACHE_KEYS = {
        CATEGORIES: 'all_prompts_by_category',
        PROMPT_METADATA_BY_ID: (id: string) => `prompt_metadata_${id}`,
        ALL_PROMPTS_LIST: 'all_prompts_list'
    };

    constructor(
        private readonly dbRepo: DatabaseRepository,
        private readonly dbService: DatabaseService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    async getCategories(): Promise<ApiResult<Record<string, CategoryItem[]>>> {
        const cacheKey = this.CACHE_KEYS.CATEGORIES;
        this.loggerService.debug(`Attempting to get categories, cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<Record<string, CategoryItem[]>>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit for categories key: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss for categories key: ${cacheKey}. Fetching...`);
            const result = await this.buildCategoriesFromDatabase();

            if (result.success && result.data) {
                this.dbRepo.setCache(cacheKey, result.data, CACHE_TTL.MEDIUM);
                this.loggerService.debug(`Stored fetched categories in cache with key: ${cacheKey}`);
            }
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to get categories: ${message}`),
                'SqlitePromptMetadataRepository.getCategories'
            );
            return Result.failure(`Failed to fetch categories: ${message}`);
        }
    }

    private async buildCategoriesFromDatabase(): Promise<ApiResult<Record<string, CategoryItem[]>>> {
        try {
            const categories: Record<string, CategoryItem[]> = {};
            const result = await this.dbService.getAllRows<{
                id: number;
                title: string;
                primary_category: string;
                directory: string;
                one_line_description?: string;
                description?: string;
                subcategories_concat?: string;
            }>(SQL_QUERIES.PROMPT.GET_ALL_WITH_DETAILS);

            if (!result.success || !result.data) {
                return Result.failure(result.error || 'Failed to fetch prompts from database.');
            }

            this.loggerService.debug(`Processing ${result.data.length} prompts from database.`);

            for (const prompt of result.data) {
                const category = prompt.primary_category || 'uncategorized';

                if (!categories[category]) categories[category] = [];

                const subcategories = prompt.subcategories_concat
                    ? prompt.subcategories_concat.split(',').filter(Boolean)
                    : [];
                categories[category].push({
                    id: String(prompt.id),
                    title: prompt.title,
                    primary_category: category,
                    category: category,
                    subcategories: subcategories,
                    path: prompt.directory,
                    description: prompt.one_line_description || prompt.description || ''
                });
            }

            for (const category in categories) {
                categories[category].sort((a, b) => a.title.localeCompare(b.title));
            }
            this.loggerService.debug(`Built categories structure with ${Object.keys(categories).length} categories.`);
            return Result.success(categories);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return Result.failure(`Error building categories from database: ${message}`);
        }
    }

    async getPromptMetadata(
        promptId: string,
        options: { cleanVariables?: boolean } = {}
    ): Promise<ApiResult<PromptMetadata>> {
        const cacheKey = this.CACHE_KEYS.PROMPT_METADATA_BY_ID(promptId);
        const useCache = !options.cleanVariables;
        this.loggerService.debug(`Getting prompt metadata for ID: ${promptId}. Use cache: ${useCache}`);

        try {
            if (useCache) {
                const cachedData = this.dbRepo.getCache<PromptMetadata>(cacheKey);

                if (cachedData) {
                    this.loggerService.debug(`Cache hit for prompt metadata key: ${cacheKey}`);
                    return Result.success(cachedData);
                }

                this.loggerService.debug(`Cache miss for prompt metadata key: ${cacheKey}. Fetching...`);
            } else {
                this.loggerService.debug(`Fetching prompt metadata without caching (cleanVariables=true).`);
            }

            const result = await this.fetchAndBuildPromptMetadata(promptId, options.cleanVariables);

            if (result.success && result.data && useCache) {
                this.dbRepo.setCache(cacheKey, result.data, CACHE_TTL.DEFAULT);
                this.loggerService.debug(`Stored fetched prompt metadata in cache with key: ${cacheKey}`);
            }
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed get metadata for ${promptId}: ${message}`),
                'SqlitePromptMetadataRepository.getPromptMetadata'
            );
            return Result.failure(`Failed to get prompt metadata: ${message}`);
        }
    }

    async fetchAndBuildPromptMetadata(
        promptId: string,
        cleanVariables: boolean = false
    ): Promise<ApiResult<PromptMetadata>> {
        this.loggerService.debug(`Fetching/building metadata for prompt ID: ${promptId}. Clean: ${cleanVariables}`);

        try {
            const promptResult = await this.dbService.getSingleRow<PromptMetadata>(SQL_QUERIES.PROMPT.GET_BY_ID, [
                promptId
            ]);

            if (!promptResult.success || !promptResult.data)
                return Result.failure(promptResult.error || `Prompt ID ${promptId} not found.`);

            const basePromptData = promptResult.data;
            const subcategoriesResult = await this.dbService.getAllRows<{ name: string }>(SQL_QUERIES.SUBCATEGORY.GET, [
                promptId
            ]);
            const subcategories =
                subcategoriesResult.success && subcategoriesResult.data
                    ? subcategoriesResult.data.map((s) => s.name)
                    : [];
            const variablesQuery = cleanVariables ? SQL_QUERIES.VARIABLE.GET : SQL_QUERIES.VARIABLE.GET_WITH_VALUES;
            const variablesResult = await this.dbService.getAllRows<PromptVariable>(variablesQuery, [promptId]);
            const variables = (variablesResult.success && variablesResult.data ? variablesResult.data : []).map(
                (variable) => ({
                    ...variable,
                    value: cleanVariables ? '' : (variable.value ?? '')
                })
            );
            const fragmentsResult = await this.dbService.getAllRows<{
                category: string;
                name: string;
                variable: string;
            }>(SQL_QUERIES.FRAGMENT.GET, [promptId]);
            const fragments = fragmentsResult.success && fragmentsResult.data ? fragmentsResult.data : [];
            const tags =
                typeof basePromptData.tags === 'string'
                    ? basePromptData.tags
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean)
                    : [];
            const fullPromptData: PromptMetadata = {
                ...basePromptData,
                id: String(basePromptData.id),
                subcategories,
                variables,
                fragments,
                tags
            };
            this.loggerService.debug(`Successfully built metadata for prompt ID: ${promptId}`);
            return Result.success(fullPromptData);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error fetching/building metadata for prompt ID ${promptId}: ${message}`);
            return Result.failure(`Failed to build prompt metadata: ${message}`);
        }
    }

    clearPromptFromCache(promptId: string | 'all'): void {
        this.loggerService.debug(`Clearing cache for prompt ID: ${promptId}`);

        try {
            if (promptId === 'all') {
                this.dbRepo.removeFromCache(this.CACHE_KEYS.CATEGORIES);
                this.dbRepo.removeFromCache(this.CACHE_KEYS.ALL_PROMPTS_LIST);
                this.loggerService.info('Cleared all general prompt-related caches.');
            } else {
                this.dbRepo.removeFromCache(this.CACHE_KEYS.PROMPT_METADATA_BY_ID(promptId));
                this.dbRepo.removeFromCache(this.CACHE_KEYS.CATEGORIES);
                this.dbRepo.removeFromCache(this.CACHE_KEYS.ALL_PROMPTS_LIST);
                this.loggerService.debug(`Cleared specific cache entries for prompt ID: ${promptId}`);
            }
        } catch (error) {
            this.loggerService.warn(`Error clearing prompt cache for ID ${promptId}: ${error}`);
        }
    }

    async getAllPromptsList(): Promise<ApiResult<CategoryItem[]>> {
        const cacheKey = this.CACHE_KEYS.ALL_PROMPTS_LIST;
        this.loggerService.debug(`Attempting to get all prompts list, cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<CategoryItem[]>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit for all prompts list key: ${cacheKey}`);
                return Result.success(cachedData);
            }

            this.loggerService.debug(`Cache miss for all prompts list key: ${cacheKey}. Fetching...`);
            const categoriesResult = await this.getCategories();

            if (!categoriesResult.success || !categoriesResult.data) {
                return Result.failure(categoriesResult.error || 'Failed to retrieve categories.');
            }

            const allPrompts = Object.values(categoriesResult.data)
                .flat()
                .sort((a, b) => a.title.localeCompare(b.title));
            this.dbRepo.setCache(cacheKey, allPrompts, CACHE_TTL.MEDIUM);
            this.loggerService.debug(`Stored fetched prompts list in cache with key: ${cacheKey}`);
            return Result.success(allPrompts);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed get all prompts list: ${message}`),
                'SqlitePromptMetadataRepository.getAllPromptsList'
            );
            return Result.failure(`Failed to get all prompts list: ${message}`);
        }
    }
}
