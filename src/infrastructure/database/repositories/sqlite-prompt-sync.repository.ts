import path from 'path';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import fs from 'fs-extra';

import { IPromptMetadataRepository } from '../../../core/prompt/repositories/prompt-metadata.repository.interface';
import { IPromptSyncRepository } from '../../../core/prompt/repositories/prompt-sync.repository.interface';
import { IPromptRepository } from '../../../core/prompt/repositories/prompt.repository.interface';
import { SQL_QUERIES, PROMPTS_DIR } from '../../../shared/constants';
import { ApiResult, PromptMetadata, PromptSyncResult, Result, SimplePromptMetadata } from '../../../shared/types';
import { ErrorService, AppError } from '../../error/services/error.service';
import { parseYaml, readFileContent } from '../../file-system/utils/file-system.utils';
import { LoggerService } from '../../logger/services/logger.service';
import { DatabaseService } from '../services/database.service';

@Injectable({ scope: Scope.DEFAULT })
export class SqlitePromptSyncRepository implements IPromptSyncRepository {
    constructor(
        private readonly dbService: DatabaseService,
        @Inject(IPromptRepository) private readonly promptRepo: IPromptRepository,
        @Inject(IPromptMetadataRepository) private readonly metadataRepo: IPromptMetadataRepository,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    async syncPromptsWithFileSystem(): Promise<ApiResult<void>> {
        this.loggerService.info('Starting synchronization between filesystem and database...');
        return await this.dbService.executeTransaction(async () => {
            try {
                if (!(await fs.pathExists(PROMPTS_DIR))) {
                    this.loggerService.info(`Prompts directory (${PROMPTS_DIR}) not found. Creating.`);
                    await fs.ensureDir(PROMPTS_DIR);
                }

                let fsDirs: string[] = [];

                try {
                    fsDirs = (await fs.readdir(PROMPTS_DIR, { withFileTypes: true }))
                        .filter((dirent) => dirent.isDirectory())
                        .map((dirent) => dirent.name);
                    this.loggerService.info(`Found ${fsDirs.length} potential prompt directories in filesystem.`);
                } catch (readDirError) {
                    this.loggerService.error(`Error reading prompts directory ${PROMPTS_DIR}: ${readDirError}`);
                }

                const syncPromises = fsDirs.map((dir) => this.syncSpecificPrompt(dir));
                const syncResults = await Promise.all(syncPromises);
                let successCount = 0;
                let failCount = 0;
                let firstError: string | undefined;
                syncResults.forEach((result, index) => {
                    if (!result.success) {
                        this.loggerService.warn(`Failed to sync directory "${fsDirs[index]}": ${result.error}`);
                        failCount++;

                        if (!firstError) firstError = result.error;
                    } else {
                        successCount++;
                    }
                });
                this.loggerService.info(
                    `Individual directory sync results: ${successCount} succeeded, ${failCount} failed.`
                );

                if (failCount > 0) {
                    throw new AppError(
                        'SYNC_ERROR',
                        `Sync failed for ${failCount} directories. Rolling back. First error: ${firstError}`
                    );
                }

                this.loggerService.debug('Starting cleanup of orphaned database entries...');
                const cleanupResult = await this.cleanupOrphanedData(fsDirs);

                if (!cleanupResult.success) {
                    throw new AppError(
                        'DB_CLEANUP_ERROR',
                        cleanupResult.error || 'Database cleanup failed during sync.'
                    );
                }

                this.metadataRepo.clearPromptFromCache('all');
                this.loggerService.info('Prompt synchronization with filesystem completed.');
                return Result.success(undefined);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.errorService.handleError(
                    error,
                    'SqlitePromptSyncRepository.syncPromptsWithFileSystem (Transaction)'
                );
                throw new AppError('SYNC_ERROR', `Filesystem sync failed: ${message}`);
            }
        });
    }
    async syncSpecificPrompt(directoryName: string): Promise<ApiResult<PromptSyncResult>> {
        this.loggerService.debug(`Syncing directory: ${directoryName}`);
        const promptDir = path.join(PROMPTS_DIR, directoryName);
        const metadataPath = path.join(promptDir, 'metadata.yml');
        const promptPath = path.join(promptDir, 'prompt.md');

        try {
            if (!(await fs.pathExists(metadataPath)) || !(await fs.pathExists(promptPath))) {
                return Result.failure(`Skipping "${directoryName}": Missing metadata.yml or prompt.md`);
            }

            let metadata: SimplePromptMetadata;
            let content: string;

            try {
                metadata = await parseYaml<SimplePromptMetadata>(metadataPath);
                content = await readFileContent(promptPath);
            } catch (readError) {
                return Result.failure(
                    `Error reading files in "${directoryName}": ${readError instanceof Error ? readError.message : String(readError)}`
                );
            }

            if (!metadata || !metadata.title || !metadata.primary_category) {
                return Result.failure(`Skipping "${directoryName}": Invalid/missing metadata.`);
            }

            metadata.directory = directoryName;

            const existingPromptResult = await this.dbService.getSingleRow<{ id: number }>(
                SQL_QUERIES.PROMPT.GET_BY_DIRECTORY,
                [directoryName]
            );
            let promptId: number;
            let operation: 'create' | 'update' = 'create';

            if (existingPromptResult.success && existingPromptResult.data) {
                promptId = existingPromptResult.data.id;
                operation = 'update';
                this.loggerService.debug(`Prompt found (ID: ${promptId}). Updating.`);

                const updateResult = await this.promptRepo.updatePrompt(
                    String(promptId),
                    metadata as PromptMetadata,
                    content
                );

                if (!updateResult.success)
                    return Result.failure(updateResult.error || `Failed to update prompt ID ${promptId}.`);
            } else {
                this.loggerService.debug(`Prompt "${directoryName}" not found. Creating.`);

                const createResult = await this.promptRepo.createPrompt(metadata as PromptMetadata, content);

                if (!createResult.success || createResult.data === undefined) {
                    return Result.failure(createResult.error || `Failed to insert prompt "${directoryName}".`);
                }

                promptId = createResult.data;
            }

            this.loggerService.debug(`Successfully ${operation}d prompt "${metadata.title}" (ID: ${promptId}).`);
            return Result.success({ promptId: String(promptId) });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('SYNC_ERROR', `Failed sync for "${directoryName}": ${message}`),
                'SqlitePromptSyncRepository.syncSpecificPrompt'
            );
            return Result.failure(`Failed to sync prompt "${directoryName}": ${message}`);
        }
    }

    private async cleanupOrphanedData(existingDirectories: string[]): Promise<ApiResult<void>> {
        this.loggerService.debug('Checking for orphaned database entries...');

        try {
            const dbDirsResult = await this.dbService.getAllRows<{ id: number; directory: string }>(
                SQL_QUERIES.PROMPT.GET_ALL_DIRECTORIES
            );

            if (!dbDirsResult.success) return Result.failure(dbDirsResult.error || 'Failed to get DB directories.');

            const dbPrompts = dbDirsResult.data || [];
            this.loggerService.debug(`Found ${dbPrompts.length} prompts in database.`);
            const orphanedPrompts = dbPrompts.filter((dbPrompt) => !existingDirectories.includes(dbPrompt.directory));

            if (orphanedPrompts.length === 0) {
                this.loggerService.debug('No orphaned prompts found.');
                return Result.success(undefined);
            }

            this.loggerService.warn(
                `Found ${orphanedPrompts.length} orphaned prompts to remove: ${orphanedPrompts.map((p) => `${p.directory}(${p.id})`).join(', ')}`
            );
            let failCount = 0;

            for (const prompt of orphanedPrompts) {
                this.loggerService.debug(`Deleting orphaned prompt ID: ${prompt.id}, Dir: ${prompt.directory}`);

                const deleteResult = await this.promptRepo.deletePrompt(String(prompt.id));

                if (!deleteResult.success) {
                    this.loggerService.error(
                        `Failed delete orphaned ${prompt.directory}(${prompt.id}): ${deleteResult.error}`
                    );
                    failCount++;
                } else {
                    this.loggerService.info(`Removed orphaned ${prompt.directory}(${prompt.id}).`);
                }
            }

            if (failCount > 0) {
                throw new AppError('DB_CLEANUP_ERROR', `${failCount} orphaned prompts could not be removed.`);
            }

            this.loggerService.info('Orphaned data cleanup completed.');
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_CLEANUP_ERROR', `Cleanup failed: ${message}`),
                'SqlitePromptSyncRepository.cleanupOrphanedData'
            );
            throw new AppError('DB_CLEANUP_ERROR', `Failed to clean up orphaned data: ${message}`);
        }
    }

    async removePromptFromDatabase(directoryOrId: string): Promise<boolean> {
        this.loggerService.debug(`Attempting remove prompt "${directoryOrId}" from DB via SyncRepo.`);

        try {
            const result = await this.promptRepo.deletePrompt(directoryOrId);
            return result.success || (result.error?.includes('not found') ?? false);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errorService.handleError(
                new AppError('DB_DELETE_ERROR', `Failed remove prompt ${directoryOrId}: ${message}`),
                'SqlitePromptSyncRepository.removePromptFromDatabase'
            );
            return false;
        }
    }
}
