import path from 'path';

import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import fs from 'fs-extra';
import { RunResult } from 'sqlite3';

import { cliConfig } from '../../../shared/config';
import { DB_SCHEMA, SQL_QUERIES } from '../../../shared/constants';
import { ApiResult, Result } from '../../../shared/types';
import { ErrorService } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';
import { DatabaseRepository } from '../repositories/database.repository';

@Injectable({ scope: Scope.DEFAULT })
export class DatabaseService {
    constructor(
        private readonly repository: DatabaseRepository,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    async initDatabase(): Promise<ApiResult<void>> {
        try {
            const dbDir = path.dirname(cliConfig.DB_PATH);
            await fs.ensureDir(dbDir);
            this.loggerService.info(`Ensuring database directory exists: ${dbDir}`);
            const tables = Object.values(DB_SCHEMA);

            for (const table of tables) {
                const result = await this.repository.runAsync(table);

                if (!result.success) {
                    return Result.failure(result.error || 'Failed to create table');
                }
            }
            this.loggerService.info('Database tables initialized successfully');
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'initializing database');
            return Result.failure(error instanceof Error ? error.message : 'Failed to initialize database');
        }
    }

    async flushData(): Promise<ApiResult<void>> {
        this.loggerService.info('Starting data flush process');

        try {
            const result = await this.repository.executeTransaction<void>(async () => {
                await this.repository.runAsync(SQL_QUERIES.CLEANUP.DELETE_ALL_PROMPTS);
                await this.repository.runAsync(SQL_QUERIES.CLEANUP.DELETE_ALL_SUBCATEGORIES);
                await this.repository.runAsync(SQL_QUERIES.CLEANUP.DELETE_ALL_VARIABLES);
                await this.repository.runAsync(SQL_QUERIES.CLEANUP.DELETE_ALL_FRAGMENTS);
                await this.repository.runAsync(SQL_QUERIES.CLEANUP.DELETE_ALL_ENV_VARS);
                await this.repository.runAsync(SQL_QUERIES.CLEANUP.DELETE_ALL_EXECUTIONS);
                await this.repository.runAsync(SQL_QUERIES.CLEANUP.DELETE_ALL_FAVORITES);
                return Result.success(undefined);
            });

            if (!result.success) return result;

            this.loggerService.info('Database tables cleared');
            await this.clearFilesystemDirectories();
            this.repository.flushCache();
            this.loggerService.info('Data flush completed successfully');
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'flushing data');
            return Result.failure(error instanceof Error ? error.message : 'Failed to flush data');
        }
    }

    private async clearFilesystemDirectories(): Promise<void> {
        try {
            await fs.emptyDir(cliConfig.PROMPTS_DIR);
            this.loggerService.info('Prompts directory cleared');
        } catch (e) {
            this.loggerService.error(`Failed to clear prompts dir: ${e}`);
        }

        try {
            await fs.emptyDir(cliConfig.FRAGMENTS_DIR);
            this.loggerService.info('Fragments directory cleared');
        } catch (e) {
            this.loggerService.error(`Failed to clear fragments dir: ${e}`);
        }

        try {
            await fs.emptyDir(cliConfig.TEMP_DIR);
            this.loggerService.info('Temporary directory cleared');
        } catch (e) {
            this.loggerService.error(`Failed to clear temp dir: ${e}`);
        }
    }

    async runQuery(sql: string, params: unknown[] = []): Promise<ApiResult<RunResult>> {
        try {
            return await this.repository.runAsync(sql, params);
        } catch (error) {
            this.errorService.handleError(error, 'running database query');
            return Result.failure(error instanceof Error ? error.message : 'Error running database query');
        }
    }

    async getSingleRow<T>(sql: string, params: unknown[] = []): Promise<ApiResult<T | undefined>> {
        try {
            return await this.repository.getAsync<T>(sql, params);
        } catch (error) {
            this.errorService.handleError(error, 'getting single row from database');
            return Result.failure(error instanceof Error ? error.message : 'Error getting single row');
        }
    }

    async getAllRows<T>(sql: string, params: unknown[] = []): Promise<ApiResult<T[]>> {
        try {
            return await this.repository.allAsync<T>(sql, params);
        } catch (error) {
            this.errorService.handleError(error, 'getting multiple rows from database');
            return Result.failure(error instanceof Error ? error.message : 'Error getting multiple rows', { data: [] });
        }
    }

    async executeTransaction<T>(callback: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
        return this.repository.executeTransaction(callback);
    }

    setCache<T>(key: string, data: T, ttl?: number): void {
        this.repository.setCache(key, data, ttl);
    }

    removeFromCache(key: string): void {
        this.repository.removeFromCache(key);
    }

    flushCache(): void {
        this.repository.flushCache();
    }
}
