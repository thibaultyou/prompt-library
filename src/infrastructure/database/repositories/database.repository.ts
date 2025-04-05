import { Injectable, Scope, Inject, forwardRef, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import NodeCache from 'node-cache';
import sqlite3, { Database, RunResult } from 'sqlite3';

import { CACHE_TTL } from '../../../shared/constants/cache';
import { DB_PATH } from '../../../shared/constants/paths';
import { ApiResult, Result } from '../../../shared/types';
import { ErrorService, AppError } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class DatabaseRepository implements OnModuleInit, OnModuleDestroy {
    private db: Database | null = null;
    private readonly cache: NodeCache;
    private dbReady: Promise<void>;
    private resolveDbReady!: () => void;
    private rejectDbReady!: (reason?: any) => void;

    constructor(
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {
        this.loggerService.debug('DatabaseRepository Constructor called.');
        this.cache = new NodeCache({ stdTTL: CACHE_TTL.DEFAULT });
        this.dbReady = new Promise((resolve, reject) => {
            this.resolveDbReady = resolve;
            this.rejectDbReady = reject;
        });
    }

    async onModuleInit() {
        this.loggerService.debug('DatabaseRepository onModuleInit: Initializing DB connection...');
        this.db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                this.errorService.handleError(
                    new AppError('DB_CONN_ERROR', err.message),
                    'DatabaseRepository onModuleInit'
                );
                this.loggerService.error(`Failed to open database: ${err.message}`);
                this.rejectDbReady(err);
            } else {
                this.loggerService.debug(`Database connection established to ${DB_PATH}`);
                this.resolveDbReady();
            }
        });
    }

    private async ensureDbReady(): Promise<Database> {
        await this.dbReady;

        if (!this.db) {
            throw new AppError('DB_CONN_ERROR', 'Database connection is not available.');
        }
        return this.db;
    }

    async onModuleDestroy() {
        await this.closeConnection();
    }

    async runAsync(sql: string, params: unknown[] = []): Promise<ApiResult<RunResult>> {
        const self = this;
        const db = await this.ensureDbReady();
        return new Promise((resolve) => {
            db.run(sql, params, function (this: RunResult, err) {
                if (err) {
                    self.errorService.handleError(new AppError('DB_ERROR', err.message), 'runAsync');
                    resolve(Result.failure(err.message));
                } else {
                    resolve(Result.success(this));
                }
            });
        });
    }

    async getAsync<T>(sql: string, params: unknown[] = []): Promise<ApiResult<T | undefined>> {
        const db = await this.ensureDbReady();
        return new Promise((resolve) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    this.errorService.handleError(new AppError('DB_ERROR', err.message), 'getAsync');
                    resolve(Result.failure(err.message));
                } else {
                    resolve(Result.success(row as T | undefined));
                }
            });
        });
    }

    async allAsync<T>(sql: string, params: unknown[] = []): Promise<ApiResult<T[]>> {
        const db = await this.ensureDbReady();
        return new Promise((resolve) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    this.errorService.handleError(new AppError('DB_ERROR', err.message), 'allAsync');
                    resolve(Result.failure(err.message));
                } else {
                    resolve(Result.success(rows as T[]));
                }
            });
        });
    }

    async executeTransaction<T>(callback: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
        await this.ensureDbReady();

        try {
            await this.runAsync('BEGIN TRANSACTION');
            const result = await callback();

            if (result.success) {
                await this.runAsync('COMMIT');
                return result;
            } else {
                await this.runAsync('ROLLBACK');
                return result;
            }
        } catch (error) {
            try {
                await this.runAsync('ROLLBACK');
            } catch (rollbackError) {
                this.loggerService.error('Failed to rollback transaction:', rollbackError);
            }

            this.errorService.handleError(error, 'transaction execution');
            return Result.failure(error instanceof Error ? error.message : 'Unknown transaction error');
        }
    }

    async getCachedOrFetch<T>(
        key: string,
        fetchFn: () => Promise<ApiResult<T>>,
        ttl: number = CACHE_TTL.DEFAULT
    ): Promise<ApiResult<T>> {
        const cachedResult = this.cache.get<T>(key);

        if (cachedResult !== undefined) {
            this.loggerService.debug(`Cache hit for key: ${key}`);
            return Result.success(cachedResult);
        }

        this.loggerService.debug(`Cache miss for key: ${key}, fetching data`);
        const result = await fetchFn();

        if (result.success && result.data !== undefined) {
            this.cache.set(key, result.data, ttl);
            this.loggerService.debug(`Data stored in cache for key: ${key} with TTL ${ttl}s`);
        }
        return result;
    }

    setCache<T>(key: string, data: T, ttl: number = CACHE_TTL.DEFAULT): void {
        this.cache.set(key, data, ttl);
        this.loggerService.debug(`Manually set cache for key: ${key} with TTL ${ttl}s`);
    }

    getCache<T>(key: string): T | undefined {
        return this.cache.get<T>(key);
    }

    removeFromCache(key: string): void {
        this.cache.del(key);
        this.loggerService.debug(`Removed from cache: ${key}`);
    }

    flushCache(): void {
        this.cache.flushAll();
        this.loggerService.info('Cache has been flushed completely');
    }

    closeConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        this.errorService.handleError(err, 'closing database connection');
                        reject(err);
                    } else {
                        this.loggerService.info('Database connection closed');
                        this.db = null;
                        resolve();
                    }
                });
            } else {
                this.loggerService.warn('Attempted to close DB connection, but it was not open.');
                resolve();
            }
        });
    }
}
