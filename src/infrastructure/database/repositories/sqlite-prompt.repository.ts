import path from 'path';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { DatabaseRepository } from './database.repository';
import { IPromptMetadataRepository } from '../../../core/prompt/repositories/prompt-metadata.repository.interface';
import { IPromptRepository } from '../../../core/prompt/repositories/prompt.repository.interface';
import { SQL_QUERIES, PROMPTS_DIR, CACHE_TTL } from '../../../shared/constants';
import { ApiResult, PromptMetadata, Result } from '../../../shared/types';
import { ErrorService, AppError } from '../../error/services/error.service';
import { readFileContent } from '../../file-system/utils/file-system.utils';
import { LoggerService } from '../../logger/services/logger.service';
import { DatabaseService } from '../services/database.service';

@Injectable({ scope: Scope.DEFAULT })
export class SqlitePromptRepository implements IPromptRepository {
    constructor(
        private readonly dbService: DatabaseService,
        @Inject(IPromptMetadataRepository) private readonly metadataRepo: IPromptMetadataRepository,
        private readonly dbRepo: DatabaseRepository,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    async getPromptById(promptId: string): Promise<ApiResult<PromptMetadata | null>> {
        this.loggerService.debug(`SqlitePromptRepository: Getting prompt by ID: ${promptId}`);
        const result = await this.metadataRepo.getPromptMetadata(promptId);
        return result.success ? Result.success(result.data ?? null) : result;
    }

    async getPromptFiles(
        promptIdOrDir: string,
        options: { cleanVariables?: boolean } = {}
    ): Promise<ApiResult<{ promptContent: string; metadata: PromptMetadata }>> {
        this.loggerService.debug(`SqlitePromptRepository: Getting prompt files for identifier: ${promptIdOrDir}`);

        try {
            const resolvedIdResult = await this.resolvePromptIdAndDir(promptIdOrDir);

            if (!resolvedIdResult.success || !resolvedIdResult.data) {
                return Result.failure(resolvedIdResult.error || `Prompt not found: ${promptIdOrDir}`);
            }

            const { id: promptId, directory } = resolvedIdResult.data;
            const metadataResult = await this.metadataRepo.getPromptMetadata(promptId, options);

            if (!metadataResult.success || !metadataResult.data) {
                return Result.failure(metadataResult.error || 'Failed to retrieve prompt metadata.');
            }

            const metadata = metadataResult.data;
            const promptPath = path.join(PROMPTS_DIR, directory, 'prompt.md');
            this.loggerService.debug(`Reading prompt content from: ${promptPath}`);
            const promptContent = await readFileContent(promptPath);
            this.loggerService.debug(`Successfully retrieved files for prompt ID: ${promptId}`);
            return Result.success({ promptContent, metadata });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('PROMPT_ACCESS_ERROR', `Failed to get files for ${promptIdOrDir}: ${message}`),
                'SqlitePromptRepository.getPromptFiles'
            );
            return Result.failure(`Failed to get prompt files: ${message}`);
        }
    }

    async updateVariable(promptId: string, variableName: string, value: string): Promise<ApiResult<void>> {
        this.loggerService.debug(
            `SqlitePromptRepository: Updating variable "${variableName}" for prompt ID ${promptId}.`
        );

        try {
            const result = await this.dbService.runQuery(SQL_QUERIES.VARIABLE.UPDATE_VALUE, [
                value,
                promptId,
                variableName
            ]);

            if (!result.success) {
                return Result.failure(result.error || 'Database error during variable update.');
            }

            if (result.data?.changes === 0) {
                this.loggerService.warn(
                    `No variable found to update for prompt ${promptId} with name ${variableName}.`
                );
                return Result.success(undefined);
            }

            this.metadataRepo.clearPromptFromCache(promptId);
            this.loggerService.debug(`Variable updated successfully. Cache cleared for prompt ID ${promptId}.`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to update variable ${variableName}: ${message}`),
                'SqlitePromptRepository.updateVariable'
            );
            return Result.failure(`Failed to update variable: ${message}`);
        }
    }

    async createPrompt(promptMetadata: PromptMetadata, content: string): Promise<ApiResult<number>> {
        this.loggerService.debug(`SqlitePromptRepository: Creating prompt titled "${promptMetadata.title}".`);

        try {
            const tagsString = Array.isArray(promptMetadata.tags)
                ? promptMetadata.tags.join(',')
                : promptMetadata.tags || '';
            const promptInsertResult = await this.dbService.runQuery(SQL_QUERIES.PROMPT.INSERT, [
                promptMetadata.title,
                content,
                promptMetadata.primary_category,
                promptMetadata.directory,
                promptMetadata.one_line_description,
                promptMetadata.description,
                promptMetadata.content_hash || '',
                tagsString
            ]);

            if (!promptInsertResult.success || !promptInsertResult.data?.lastID) {
                throw new AppError(
                    'DB_INSERT_ERROR',
                    promptInsertResult.error || 'Failed to insert main prompt record.'
                );
            }

            const promptId = promptInsertResult.data.lastID;
            this.loggerService.debug(`Inserted main prompt record with ID: ${promptId}`);
            await this.insertRelatedPromptData(promptId, promptMetadata);
            this.metadataRepo.clearPromptFromCache('all');
            this.loggerService.info(`Successfully created prompt "${promptMetadata.title}" with ID ${promptId}.`);
            return Result.success(promptId);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to create prompt: ${message}`),
                'SqlitePromptRepository.createPrompt'
            );
            throw new AppError('DB_ERROR', `Failed to create prompt: ${message}`);
        }
    }

    async updatePrompt(promptId: string, promptMetadata: PromptMetadata, content: string): Promise<ApiResult<void>> {
        this.loggerService.debug(
            `SqlitePromptRepository: Updating prompt ID ${promptId} titled "${promptMetadata.title}".`
        );

        try {
            const tagsString = Array.isArray(promptMetadata.tags)
                ? promptMetadata.tags.join(',')
                : promptMetadata.tags || '';
            const promptUpdateResult = await this.dbService.runQuery(SQL_QUERIES.PROMPT.UPDATE, [
                promptMetadata.title,
                content,
                promptMetadata.primary_category,
                promptMetadata.directory,
                promptMetadata.one_line_description,
                promptMetadata.description,
                promptMetadata.content_hash || '',
                tagsString,
                promptId
            ]);

            if (!promptUpdateResult.success) {
                throw new AppError(
                    'DB_UPDATE_ERROR',
                    promptUpdateResult.error || 'Failed to update main prompt record.'
                );
            }

            if (promptUpdateResult.data?.changes === 0) {
                this.loggerService.warn(
                    `Prompt ID ${promptId} not found for update, but proceeding with related data.`
                );
            } else {
                this.loggerService.debug(`Updated main prompt record for ID: ${promptId}`);
            }

            const existingVars = await this.getExistingVariableValues(promptId);
            await this.deleteRelatedPromptData(promptId);
            await this.insertRelatedPromptData(Number(promptId), promptMetadata, existingVars);
            this.metadataRepo.clearPromptFromCache(promptId);
            this.loggerService.info(`Successfully updated prompt ID ${promptId}.`);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to update prompt ${promptId}: ${message}`),
                'SqlitePromptRepository.updatePrompt'
            );
            throw new AppError('DB_ERROR', `Failed to update prompt: ${message}`);
        }
    }

    private async getExistingVariableValues(promptId: string): Promise<Map<string, string>> {
        const existingVarsMap = new Map<string, string>();

        try {
            const existingVarsResult = await this.dbService.getAllRows<{ name: string; value: string }>(
                SQL_QUERIES.VARIABLE.GET_VALUES,
                [promptId]
            );

            if (existingVarsResult.success && existingVarsResult.data) {
                existingVarsResult.data.forEach((v) => {
                    if (v?.name && v.value !== null && v.value !== undefined) {
                        existingVarsMap.set(v.name, v.value);
                    }
                });
            }
        } catch (error) {
            this.loggerService.warn(`Could not retrieve existing variable values for prompt ${promptId}: ${error}`);
        }
        return existingVarsMap;
    }

    private async deleteRelatedPromptData(promptId: string): Promise<void> {
        this.loggerService.debug(`Deleting related data for prompt ID: ${promptId}`);
        const results = await Promise.allSettled([
            this.dbService.runQuery(SQL_QUERIES.SUBCATEGORY.DELETE, [promptId]),
            this.dbService.runQuery(SQL_QUERIES.VARIABLE.DELETE, [promptId]),
            this.dbService.runQuery(SQL_QUERIES.FRAGMENT.DELETE, [promptId])
        ]);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const tableName = ['subcategories', 'variables', 'fragments'][index];
                this.loggerService.warn(`Error deleting ${tableName} for prompt ${promptId}: ${result.reason}`);
                throw new AppError('DB_DELETE_ERROR', `Failed to delete ${tableName} for prompt ${promptId}`);
            }
        });
        this.loggerService.debug(
            `Finished deleting related data (subcats, vars, fragments) for prompt ID: ${promptId}`
        );
    }

    private async insertRelatedPromptData(
        promptId: number,
        promptMetadata: PromptMetadata,
        existingVarValues: Map<string, string> = new Map()
    ): Promise<void> {
        this.loggerService.debug(`Inserting related data for prompt ID: ${promptId}`);
        const insertPromises: Promise<any>[] = [];

        if (Array.isArray(promptMetadata.subcategories)) {
            promptMetadata.subcategories.forEach((subcategory) => {
                if (subcategory && typeof subcategory === 'string') {
                    insertPromises.push(
                        this.dbService.runQuery(SQL_QUERIES.SUBCATEGORY.INSERT, [promptId, subcategory.trim()])
                    );
                }
            });
        }

        if (Array.isArray(promptMetadata.variables)) {
            promptMetadata.variables.forEach((variable) => {
                if (!variable || typeof variable.name !== 'string' || typeof variable.role !== 'string') return;

                const existingValue = existingVarValues.get(variable.name);
                const valueToInsert = existingValue !== undefined ? existingValue : (variable.value ?? null);
                const optionalFlag = variable.optional_for_user ? 1 : 0;
                insertPromises.push(
                    this.dbService.runQuery(SQL_QUERIES.VARIABLE.INSERT_WITH_VALUE, [
                        promptId,
                        variable.name,
                        variable.role,
                        optionalFlag,
                        valueToInsert
                    ])
                );
            });
        }

        if (Array.isArray(promptMetadata.fragments)) {
            promptMetadata.fragments.forEach((fragment) => {
                if (
                    !fragment ||
                    typeof fragment.category !== 'string' ||
                    typeof fragment.name !== 'string' ||
                    typeof fragment.variable !== 'string'
                )
                    return;

                insertPromises.push(
                    this.dbService.runQuery(SQL_QUERIES.FRAGMENT.INSERT, [
                        promptId,
                        fragment.category,
                        fragment.name,
                        fragment.variable
                    ])
                );
            });
        }

        const results = await Promise.allSettled(insertPromises);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.loggerService.warn(
                    `Error inserting related data item #${index + 1} for prompt ${promptId}: ${result.reason}`
                );
                throw new AppError('DB_INSERT_ERROR', `Failed to insert related data for prompt ${promptId}`);
            }
        });
        this.loggerService.debug(`Finished inserting related data for prompt ID: ${promptId}`);
    }

    async deletePrompt(promptIdOrDir: string): Promise<ApiResult<void>> {
        this.loggerService.debug(`SqlitePromptRepository: Deleting prompt with identifier: ${promptIdOrDir}`);

        try {
            const resolvedIdResult = await this.resolvePromptIdAndDir(promptIdOrDir);

            if (!resolvedIdResult.success || !resolvedIdResult.data) {
                this.loggerService.warn(`Prompt identifier "${promptIdOrDir}" could not be resolved for deletion.`);
                return Result.success(undefined, { message: `Prompt "${promptIdOrDir}" not found.` });
            }

            const promptId = resolvedIdResult.data.id;
            this.metadataRepo.clearPromptFromCache(promptId);
            return await this.dbService.executeTransaction(async () => {
                this.loggerService.debug(`Starting transaction to delete prompt ID: ${promptId}`);

                const deleteResult = await this.dbService.runQuery(SQL_QUERIES.PROMPT.DELETE, [promptId]);

                if (!deleteResult.success) {
                    throw new AppError(
                        'DB_DELETE_ERROR',
                        deleteResult.error || `Failed delete prompt record ID ${promptId}.`
                    );
                }

                if (deleteResult.data?.changes === 0) {
                    this.loggerService.warn(`Main prompt record ID ${promptId} already deleted or not found.`);
                } else {
                    this.loggerService.info(`Successfully deleted prompt ID ${promptId} from database.`);
                }

                this.metadataRepo.clearPromptFromCache('all');
                return Result.success(undefined);
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to delete prompt ${promptIdOrDir}: ${message}`),
                'SqlitePromptRepository.deletePrompt'
            );
            return Result.failure(`Failed to delete prompt: ${message}`);
        }
    }

    async getAllPrompts(): Promise<ApiResult<PromptMetadata[]>> {
        this.loggerService.debug('SqlitePromptRepository: Getting all prompts with full metadata.');

        try {
            const promptsResult = await this.dbService.getAllRows<{ id: number }>(`SELECT id FROM prompts`);

            if (!promptsResult.success || !promptsResult.data) {
                return Result.failure(promptsResult.error || 'Failed to retrieve prompt IDs.');
            }

            const metadataPromises = promptsResult.data.map((prompt) =>
                this.metadataRepo.getPromptMetadata(String(prompt.id))
            );
            const metadataResults = await Promise.all(metadataPromises);
            const prompts: PromptMetadata[] = metadataResults
                .filter((result) => result.success && result.data)
                .map((result) => result.data!);

            if (prompts.length !== promptsResult.data.length) {
                this.loggerService.warn(`Fetched metadata for ${prompts.length}/${promptsResult.data.length} prompts.`);
            }

            this.loggerService.debug(`Successfully retrieved full metadata for ${prompts.length} prompts.`);
            return Result.success(prompts);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed to get all prompts: ${message}`),
                'SqlitePromptRepository.getAllPrompts'
            );
            return Result.failure(`Failed to get all prompts: ${message}`);
        }
    }

    async listPromptDirectories(): Promise<string[]> {
        const cacheKey = 'prompt_directories';
        this.loggerService.debug(`Listing prompt directories, cache key: ${cacheKey}`);

        try {
            const cachedData = this.dbRepo.getCache<string[]>(cacheKey);

            if (cachedData) {
                this.loggerService.debug(`Cache hit: ${cacheKey}`);
                return cachedData;
            }

            this.loggerService.debug(`Cache miss: ${cacheKey}. Fetching...`);
            const result = await this.dbService.getAllRows<{ directory: string }>(SQL_QUERIES.PROMPT.GET_DIRECTORIES);

            if (!result.success || !result.data) {
                this.loggerService.warn(`Failed list prompt directories: ${result.error || 'No data'}`);
                return [];
            }

            const directories = result.data.map((item) => item.directory);
            this.dbRepo.setCache(cacheKey, directories, CACHE_TTL.MEDIUM);
            this.loggerService.debug(`Stored ${directories.length} prompt directories in cache.`);
            return directories;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_ERROR', `Failed list prompt directories: ${message}`),
                'SqlitePromptRepository.listPromptDirectories'
            );
            return [];
        }
    }

    private async resolvePromptIdAndDir(directoryOrId: string): Promise<ApiResult<{ id: string; directory: string }>> {
        this.loggerService.debug(`Resolving prompt identifier: ${directoryOrId}`);

        if (/^\d+$/.test(directoryOrId)) {
            const promptId = directoryOrId;
            const promptResult = await this.dbService.getSingleRow<{ directory: string }>(
                SQL_QUERIES.PROMPT.GET_DIRECTORY_BY_ID,
                [promptId]
            );

            if (promptResult.success && promptResult.data?.directory) {
                this.loggerService.debug(`Resolved ID ${promptId} -> Dir ${promptResult.data.directory}`);
                return Result.success({ id: promptId, directory: promptResult.data.directory });
            } else {
                return Result.failure(`Prompt ID ${promptId} not found or missing directory.`);
            }
        } else {
            const directory = directoryOrId;
            const promptResult = await this.dbService.getSingleRow<{ id: number }>(
                SQL_QUERIES.PROMPT.GET_BY_DIRECTORY,
                [directory]
            );

            if (promptResult.success && promptResult.data?.id) {
                this.loggerService.debug(`Resolved Dir ${directory} -> ID ${promptResult.data.id}`);
                return Result.success({ id: String(promptResult.data.id), directory });
            } else {
                return Result.failure(`Prompt directory "${directory}" not found.`);
            }
        }
    }
}
