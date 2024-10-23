import path from 'path';

import { jest } from '@jest/globals';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import NodeCache from 'node-cache';
import sqlite3, { RunResult } from 'sqlite3';

import { PromptMetadata } from '../../../shared/types';
import { fileExists, readDirectory, readFileContent } from '../../../shared/utils/file-system';
import { cliConfig } from '../../config/cli-config';
import {
    runAsync,
    getAsync,
    allAsync,
    handleApiResult,
    getCachedOrFetch,
    initDatabase,
    fetchCategories,
    getPromptDetails,
    updatePromptVariable,
    syncPromptsWithDatabase,
    cleanupOrphanedData,
    flushData,
    db
} from '../database';
import { createPrompt } from '../prompts';

jest.mock('fs-extra');
jest.mock('js-yaml');
jest.mock('node-cache');
jest.mock('sqlite3');
jest.mock('../errors');
jest.mock('../prompts');
jest.mock('../../../shared/utils/file-system');
jest.mock('../../../shared/utils/logger');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockYaml = yaml as jest.Mocked<typeof yaml>;
const mockCreatePrompt = createPrompt as jest.MockedFunction<typeof createPrompt>;
const mockFileExists = fileExists as jest.MockedFunction<typeof fileExists>;
const mockReadDirectory = readDirectory as jest.MockedFunction<typeof readDirectory>;
const mockReadFileContent = readFileContent as jest.MockedFunction<typeof readFileContent>;
describe('DatabaseUtils', () => {
    let runSpy: jest.SpiedFunction<typeof db.run>;
    let getSpy: jest.SpiedFunction<typeof db.get>;
    let allSpy: jest.SpiedFunction<typeof db.all>;
    beforeEach(() => {
        jest.clearAllMocks();

        runSpy = jest.spyOn(db, 'run').mockImplementation(function (
            this: sqlite3.Database,
            sql: string,
            paramsOrCallback?: any[] | ((this: RunResult, err: Error | null) => void),
            callback?: (this: RunResult, err: Error | null) => void
        ): sqlite3.Database {
            if (typeof paramsOrCallback === 'function') {
                callback = paramsOrCallback;
            }

            if (callback) {
                callback.call({ lastID: 1, changes: 1 } as RunResult, null);
            }
            return this;
        });

        getSpy = jest.spyOn(db, 'get').mockImplementation(function (
            this: sqlite3.Database,
            sql: string,
            paramsOrCallback?: any[] | ((err: Error | null, row?: any) => void),
            callback?: (err: Error | null, row?: any) => void
        ): sqlite3.Database {
            if (typeof paramsOrCallback === 'function') {
                callback = paramsOrCallback;
            }

            if (callback) {
                callback(null, { id: 1, name: 'Test' });
            }
            return this;
        });

        allSpy = jest.spyOn(db, 'all').mockImplementation(function (
            this: sqlite3.Database,
            sql: string,
            paramsOrCallback?: any[] | ((err: Error | null, rows?: any[]) => void),
            callback?: (err: Error | null, rows?: any[]) => void
        ): sqlite3.Database {
            if (typeof paramsOrCallback === 'function') {
                callback = paramsOrCallback;
            }

            if (callback) {
                callback(null, [{ id: 1 }, { id: 2 }]);
            }
            return this;
        });
    });

    describe('runAsync', () => {
        it('should execute SQL run command successfully', async () => {
            const result = await runAsync('INSERT INTO test_table VALUES (?)', ['test']);
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ lastID: 1, changes: 1 });
        });

        it('should handle SQL run command error', async () => {
            runSpy.mockImplementation(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((this: RunResult, err: Error | null) => void),
                callback?: (this: RunResult, err: Error | null) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback.call({} as RunResult, new Error('SQL error'));
                }
                return this;
            });

            const result = await runAsync('INVALID SQL', []);
            expect(result.success).toBe(false);
            expect(result.error).toBe('SQL error');
        });
    });

    describe('getAsync', () => {
        it('should execute SQL get command successfully', async () => {
            const result = await getAsync<{ id: number; name: string }>('SELECT * FROM test_table WHERE id = ?', [1]);
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: 1, name: 'Test' });
        });

        it('should handle SQL get command error', async () => {
            getSpy.mockImplementation(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((err: Error | null, row?: any) => void),
                callback?: (err: Error | null, row?: any) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback(new Error('SQL error'), undefined);
                }
                return this;
            });

            const result = await getAsync('INVALID SQL', []);
            expect(result.success).toBe(false);
            expect(result.error).toBe('SQL error');
        });
    });

    describe('allAsync', () => {
        it('should execute SQL all command successfully', async () => {
            const result = await allAsync<{ id: number }>('SELECT * FROM test_table', []);
            expect(result.success).toBe(true);
            expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it('should handle SQL all command error', async () => {
            allSpy.mockImplementation(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((err: Error | null, rows?: any[]) => void),
                callback?: (err: Error | null, rows?: any[]) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback(new Error('SQL error'), undefined);
                }
                return this;
            });

            const result = await allAsync('INVALID SQL', []);
            expect(result.success).toBe(false);
            expect(result.error).toBe('SQL error');
        });
    });

    describe('handleApiResult', () => {
        it('should return data if result is successful', async () => {
            const result = await handleApiResult({ success: true, data: 'Test Data' }, 'Test Message');
            expect(result).toBe('Test Data');
        });

        it('should handle error if result is not successful', async () => {
            const result = await handleApiResult({ success: false, error: 'Test Error' }, 'Test Message');
            expect(result).toBeNull();
        });
    });

    describe('getCachedOrFetch', () => {
        let cacheInstance: NodeCache;
        let cacheGetSpy: jest.SpiedFunction<typeof cacheInstance.get>;
        let cacheSetSpy: jest.SpiedFunction<typeof cacheInstance.set>;
        beforeEach(() => {
            cacheInstance = new NodeCache();
            cacheGetSpy = jest.spyOn(cacheInstance, 'get');
            cacheSetSpy = jest.spyOn(cacheInstance, 'set');
        });

        afterEach(() => {
            cacheInstance.flushAll();
            jest.clearAllMocks();
        });

        it('should return cached data if available', async () => {
            cacheGetSpy.mockReturnValue('Cached Data');

            const fetchFn = jest.fn(() => Promise.resolve({ success: true, data: 'Fetched Data' }));
            const result = await getCachedOrFetch('testKey', fetchFn, cacheInstance);
            expect(result.success).toBe(true);
            expect(result.data).toBe('Cached Data');
            expect(fetchFn).not.toHaveBeenCalled();
        });

        it('should fetch data if not in cache and cache it', async () => {
            cacheGetSpy.mockReturnValue(undefined);

            const fetchFn = jest.fn(() => Promise.resolve({ success: true, data: 'Fetched Data' }));
            const result = await getCachedOrFetch('testKey', fetchFn, cacheInstance);
            expect(result.success).toBe(true);
            expect(result.data).toBe('Fetched Data');
            expect(fetchFn).toHaveBeenCalled();
            expect(cacheSetSpy).toHaveBeenCalledWith('testKey', 'Fetched Data');
        });

        it('should handle fetch error', async () => {
            cacheGetSpy.mockReturnValue(undefined);

            const fetchFn = jest.fn(() => Promise.resolve({ success: false, error: 'Fetch Error' }));
            const result = await getCachedOrFetch('testKey', fetchFn, cacheInstance);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Fetch Error');
            expect(fetchFn).toHaveBeenCalled();
            expect(cacheSetSpy).not.toHaveBeenCalled();
        });
    });

    describe('initDatabase', () => {
        it('should initialize the database successfully', async () => {
            mockFs.ensureDir.mockImplementation(() => Promise.resolve());

            const result = await initDatabase();
            expect(result.success).toBe(true);
            expect(mockFs.ensureDir).toHaveBeenCalledWith(path.dirname(cliConfig.DB_PATH));
            expect(runSpy).toHaveBeenCalledTimes(5);
        });

        it('should handle errors during database initialization', async () => {
            mockFs.ensureDir.mockImplementation(() => Promise.reject(new Error('FS Error')));

            const result = await initDatabase();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to initialize database');
        });
    });

    describe('fetchCategories', () => {
        it('should fetch categories successfully', async () => {
            const mockData = [
                {
                    id: 1,
                    title: 'Test Prompt',
                    primary_category: 'Category1',
                    description: 'Test Description',
                    path: '/test/path',
                    tags: 'tag1,tag2',
                    subcategories: 'sub1,sub2'
                }
            ];
            allSpy.mockImplementationOnce(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((err: Error | null, rows?: any[]) => void),
                callback?: (err: Error | null, rows?: any[]) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback(null, mockData);
                }
                return this;
            });

            const result = await fetchCategories();
            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                Category1: [
                    {
                        id: 1,
                        title: 'Test Prompt',
                        primary_category: 'Category1',
                        description: 'Test Description',
                        path: '/test/path',
                        tags: ['tag1', 'tag2'],
                        subcategories: ['sub1', 'sub2']
                    }
                ]
            });
        });

        it('should handle errors when fetching categories', async () => {
            allSpy.mockImplementationOnce(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((err: Error | null, rows?: any[]) => void),
                callback?: (err: Error | null, rows?: any[]) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback(new Error('DB Error'), undefined);
                }
                return this;
            });

            const result = await fetchCategories();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to fetch prompts with categories');
        });
    });

    describe('getPromptDetails', () => {
        it('should get prompt details successfully', async () => {
            getSpy.mockImplementationOnce(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((err: Error | null, row?: any) => void),
                callback?: (err: Error | null, row?: any) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback(null, {
                        id: 1,
                        title: 'Test Prompt',
                        content: 'Test Content',
                        tags: ['tag1', 'tag2']
                    });
                }
                return this;
            });

            allSpy.mockImplementationOnce(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((err: Error | null, rows?: any[]) => void),
                callback?: (err: Error | null, rows?: any[]) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback(null, [{ name: 'var1', role: 'user', value: '', optional_for_user: false }]);
                }
                return this;
            });

            const result = await getPromptDetails('1');
            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                id: 1,
                title: 'Test Prompt',
                content: 'Test Content',
                tags: ['tag1', 'tag2'],
                variables: [
                    {
                        name: 'var1',
                        role: 'user',
                        value: '',
                        optional_for_user: false
                    }
                ]
            });
        });

        it('should handle errors when getting prompt details', async () => {
            getSpy.mockImplementationOnce(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((err: Error | null, row?: any) => void),
                callback?: (err: Error | null, row?: any) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback(new Error('DB Error'), undefined);
                }
                return this;
            });

            const result = await getPromptDetails('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to fetch prompt details');
        });
    });

    describe('updatePromptVariable', () => {
        it('should update prompt variable successfully', async () => {
            runSpy.mockImplementationOnce(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((this: RunResult, err: Error | null) => void),
                callback?: (this: RunResult, err: Error | null) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback.call({ changes: 1 } as RunResult, null);
                }
                return this;
            });

            const result = await updatePromptVariable('1', 'var1', 'newValue');
            expect(result.success).toBe(true);
        });

        it('should handle errors when updating prompt variable', async () => {
            runSpy.mockImplementationOnce(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((this: RunResult, err: Error | null) => void),
                callback?: (this: RunResult, err: Error | null) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback.call({ changes: 0 } as RunResult, null);
                }
                return this;
            });

            const result = await updatePromptVariable('1', 'var1', 'newValue');
            expect(result.success).toBe(false);
            expect(result.error).toBe('No variable found with name var1 for prompt 1');
        });
    });

    describe('syncPromptsWithDatabase', () => {
        it('should sync prompts with database successfully', async () => {
            mockReadDirectory.mockResolvedValue(['prompt1', 'prompt2']);
            mockFileExists.mockResolvedValue(true);
            mockReadFileContent.mockResolvedValue('content');
            mockYaml.load.mockReturnValue({
                title: 'Test Prompt',
                primary_category: 'Category1'
            } as PromptMetadata);

            mockCreatePrompt.mockResolvedValue({ success: true });

            const result = await syncPromptsWithDatabase();
            expect(result.success).toBe(true);
            expect(runSpy).toHaveBeenNthCalledWith(1, 'DELETE FROM prompts', [], expect.any(Function));
            expect(runSpy).toHaveBeenNthCalledWith(2, 'DELETE FROM subcategories', [], expect.any(Function));
            expect(runSpy).toHaveBeenNthCalledWith(3, 'DELETE FROM variables', [], expect.any(Function));
            expect(runSpy).toHaveBeenNthCalledWith(4, 'DELETE FROM fragments', [], expect.any(Function));
            expect(mockCreatePrompt).toHaveBeenCalledTimes(2);
        });

        it('should handle errors during sync', async () => {
            mockReadDirectory.mockRejectedValue(new Error('FS Error'));

            const result = await syncPromptsWithDatabase();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to sync prompts with database');
        });
    });

    describe('cleanupOrphanedData', () => {
        it('should clean up orphaned data successfully', async () => {
            mockReadDirectory.mockResolvedValue(['1', '2']);

            allSpy.mockImplementationOnce(function (
                this: sqlite3.Database,
                sql: string,
                paramsOrCallback?: any[] | ((err: Error | null, rows?: any[]) => void),
                callback?: (err: Error | null, rows?: any[]) => void
            ): sqlite3.Database {
                if (typeof paramsOrCallback === 'function') {
                    callback = paramsOrCallback;
                }

                if (callback) {
                    callback(null, []);
                }
                return this;
            });

            const result = await cleanupOrphanedData();
            expect(result.success).toBe(true);
            expect(runSpy).toHaveBeenNthCalledWith(
                1,
                'DELETE FROM prompts WHERE id NOT IN (?)',
                ['1,2'],
                expect.any(Function)
            );
            expect(runSpy).toHaveBeenNthCalledWith(
                2,
                'DELETE FROM subcategories WHERE prompt_id NOT IN (SELECT id FROM prompts)',
                [],
                expect.any(Function)
            );
            expect(runSpy).toHaveBeenNthCalledWith(
                3,
                'DELETE FROM fragments WHERE prompt_id NOT IN (SELECT id FROM prompts)',
                [],
                expect.any(Function)
            );
        });

        it('should handle errors during cleanup', async () => {
            mockReadDirectory.mockRejectedValue(new Error('FS Error'));

            const result = await cleanupOrphanedData();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to clean up orphaned data');
        });
    });

    describe('flushData', () => {
        it('should flush data successfully', async () => {
            mockFs.emptyDir.mockImplementation(() => Promise.resolve());

            await flushData();

            expect(runSpy).toHaveBeenNthCalledWith(1, 'DELETE FROM prompts', [], expect.any(Function));
            expect(runSpy).toHaveBeenNthCalledWith(2, 'DELETE FROM subcategories', [], expect.any(Function));
            expect(runSpy).toHaveBeenNthCalledWith(3, 'DELETE FROM variables', [], expect.any(Function));
            expect(runSpy).toHaveBeenNthCalledWith(4, 'DELETE FROM fragments', [], expect.any(Function));
            expect(runSpy).toHaveBeenNthCalledWith(5, 'DELETE FROM env_vars', [], expect.any(Function));
            expect(mockFs.emptyDir).toHaveBeenCalledWith(cliConfig.PROMPTS_DIR);
        });

        it('should handle errors during data flush', async () => {
            mockFs.emptyDir.mockImplementation(() => Promise.reject(new Error('FS Error')));

            await expect(flushData()).rejects.toThrow('Failed to flush data');
        });
    });
});
