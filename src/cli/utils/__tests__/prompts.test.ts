/**
 * Improved test suite for prompts utility
 * This combines the best of both approaches between prompts.test.ts and prompts-simple.test.ts
 */
import { RunResult } from 'sqlite3';

import { PromptMetadata } from '../../../shared/types';
import { allAsync, getAsync, runAsync } from '../database';
import { readEnvVars } from '../env-vars';
import { createPrompt, listPrompts, getPromptFiles, getPromptMetadata, viewPromptDetails } from '../prompts';

jest.mock('../database');
jest.mock('../env-vars');
jest.mock('chalk', () => ({
    cyan: jest.fn((text) => text),
    green: jest.fn((text) => text),
    blue: jest.fn((text) => text),
    magenta: jest.fn((text) => text),
    yellow: jest.fn((text) => text),
    red: jest.fn((text) => text)
}));
jest.mock('../errors', () => ({
    handleError: jest.fn()
}));

jest.mock('../database');
const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
const mockRunAsync = runAsync as jest.MockedFunction<typeof runAsync>;
const mockMetadata: PromptMetadata = {
    title: 'Test Prompt',
    primary_category: 'test',
    subcategories: ['sub1', 'sub2'],
    directory: 'test-dir',
    tags: ['tag1', 'tag2'],
    one_line_description: 'Test description',
    description: 'Full test description',
    variables: [
        { name: 'var1', role: 'test role', optional_for_user: false },
        { name: 'var2', role: 'test role 2', optional_for_user: true }
    ],
    content_hash: 'test-hash',
    fragments: [{ category: 'test', name: 'fragment1', variable: '{{var1}}' }]
};
describe('PromptsUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('createPrompt', () => {
        it('should successfully create a prompt with all metadata', async () => {
            mockRunAsync.mockResolvedValueOnce({
                success: true,
                data: { lastID: 1, changes: 1 } as unknown as RunResult
            });

            mockRunAsync.mockResolvedValue({
                success: true,
                data: { lastID: 1, changes: 1 } as unknown as RunResult
            });

            const result = await createPrompt(mockMetadata, 'Test content');
            expect(result.success).toBe(true);
            expect(mockRunAsync).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO prompts'),
                expect.arrayContaining([mockMetadata.title])
            );
        });

        it('should handle database errors gracefully', async () => {
            mockRunAsync.mockResolvedValueOnce({
                success: false,
                error: 'DB error'
            });

            const result = await createPrompt(mockMetadata, 'Test content');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to insert prompt');
        });
    });

    describe('listPrompts', () => {
        it('should return list of prompts successfully', async () => {
            const mockPrompts = [
                { id: 1, title: 'Prompt 1', primary_category: 'cat1' },
                { id: 2, title: 'Prompt 2', primary_category: 'cat2' }
            ];
            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: mockPrompts
            });

            const result = await listPrompts();
            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockPrompts);
        });

        it('should handle database errors', async () => {
            mockAllAsync.mockResolvedValueOnce({
                success: false,
                error: 'DB error'
            });

            const result = await listPrompts();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to list prompts');
        });
    });

    describe('getPromptFiles', () => {
        it('should return prompt content and metadata', async () => {
            mockGetAsync.mockImplementation((query) => {
                if (query.includes('SELECT id, content FROM prompts')) {
                    return Promise.resolve({
                        success: true,
                        data: { id: '1', content: 'Test content' }
                    });
                } else if (query.includes('SELECT * FROM prompts')) {
                    return Promise.resolve({
                        success: true,
                        data: {
                            id: '1',
                            title: 'Test Prompt',
                            primary_category: 'test',
                            directory: 'test-dir',
                            one_line_description: 'Test description',
                            description: 'Full test description',
                            content_hash: 'test-hash',
                            tags: 'tag1,tag2'
                        }
                    });
                }
                return Promise.resolve({ success: false });
            });

            mockAllAsync.mockImplementation((query) => {
                if (query.includes('subcategories')) {
                    return Promise.resolve({
                        success: true,
                        data: [{ name: 'sub1' }, { name: 'sub2' }]
                    });
                } else if (query.includes('variables')) {
                    return Promise.resolve({
                        success: true,
                        data: [
                            { name: 'var1', role: 'test role', optional_for_user: false },
                            { name: 'var2', role: 'test role 2', optional_for_user: true }
                        ]
                    });
                } else if (query.includes('fragments')) {
                    return Promise.resolve({
                        success: true,
                        data: [{ category: 'test', name: 'fragment1', variable: '{{var1}}' }]
                    });
                }
                return Promise.resolve({ success: false });
            });

            const result = await getPromptFiles('1');
            expect(result.success).toBe(true);
            expect(result.data?.promptContent).toBe('Test content');
            expect(result.data?.metadata).toBeDefined();
        });

        it('should return error when prompt is not found', async () => {
            mockGetAsync.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: false });

            const result = await getPromptFiles('missing');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt not found');
        });
    });

    describe('getPromptMetadata', () => {
        it('should return complete metadata when all data is available', async () => {
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: {
                    id: '1',
                    title: 'Test Prompt',
                    primary_category: 'test',
                    directory: 'test-dir',
                    one_line_description: 'Test description',
                    description: 'Full test description',
                    content_hash: 'test-hash',
                    tags: 'tag1,tag2'
                }
            });

            mockAllAsync
                .mockResolvedValueOnce({
                    success: true,
                    data: [{ name: 'sub1' }, { name: 'sub2' }]
                })
                .mockResolvedValueOnce({
                    success: true,
                    data: [
                        { name: 'var1', role: 'test role', optional_for_user: false },
                        { name: 'var2', role: 'test role 2', optional_for_user: true }
                    ]
                })
                .mockResolvedValueOnce({
                    success: true,
                    data: [{ category: 'test', name: 'fragment1', variable: '{{var1}}' }]
                });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(true);
            expect(result.data?.title).toBe('Test Prompt');
            expect(result.data?.subcategories).toHaveLength(2);
            expect(result.data?.variables).toHaveLength(2);
            expect(result.data?.fragments).toHaveLength(1);
        });

        it('should return error when metadata is not found', async () => {
            mockGetAsync.mockResolvedValueOnce({
                success: false,
                error: 'Not found'
            });

            const result = await getPromptMetadata('999');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Metadata not found');
        });

        it('should return error when subcategories retrieval fails', async () => {
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: { id: '1', title: 'Test' }
            });

            mockAllAsync.mockResolvedValueOnce({
                success: false,
                error: 'Failed to get subcategories'
            });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get subcategories');
        });

        it('should return error when variables retrieval fails', async () => {
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: { id: '1', title: 'Test' }
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'sub1' }]
            });

            mockAllAsync.mockResolvedValueOnce({
                success: false,
                error: 'Failed to get variables'
            });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get variables');
        });

        it('should return error when fragments retrieval fails', async () => {
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: { id: '1', title: 'Test' }
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'sub1' }]
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'var1', role: 'test', optional_for_user: false }]
            });

            mockAllAsync.mockResolvedValueOnce({
                success: false,
                error: 'Failed to get fragments'
            });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get fragments');
        });
    });

    describe('viewPromptDetails', () => {
        const mockPrompt: PromptMetadata = {
            id: '1',
            title: 'Test Prompt',
            primary_category: 'test',
            subcategories: ['sub1', 'sub2'],
            directory: 'test-dir',
            tags: ['tag1', 'tag2'],
            one_line_description: 'Test description',
            description: 'Full test description',
            variables: [
                { name: 'var1', role: 'test role', optional_for_user: false },
                { name: 'var2', role: 'test role 2', optional_for_user: true }
            ],
            content_hash: 'test-hash',
            fragments: [{ category: 'test', name: 'fragment1', variable: 'var1' }]
        };
        it('should display prompt details correctly', async () => {
            const consoleSpy = jest.spyOn(console, 'log');
            const mockReadEnvVars = readEnvVars as jest.MockedFunction<typeof readEnvVars>;
            mockReadEnvVars.mockResolvedValueOnce({
                success: true,
                data: [{ id: 1, name: 'var1', value: 'test-value', scope: 'global' }]
            });

            await viewPromptDetails(mockPrompt);

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Prompt:'), mockPrompt.title);
        });
    });
});
