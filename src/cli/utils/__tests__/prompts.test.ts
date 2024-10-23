import { RunResult } from 'sqlite3';

import { PromptMetadata, Variable } from '../../../shared/types';
import { ENV_PREFIX, FRAGMENT_PREFIX } from '../../constants';
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
            const mockRunAsync = runAsync as jest.MockedFunction<typeof runAsync>;
            mockRunAsync.mockResolvedValueOnce({
                success: true,
                data: {
                    lastID: 1,
                    changes: 1
                } as unknown as RunResult
            });

            mockRunAsync.mockResolvedValue({
                success: true,
                data: {
                    lastID: 1,
                    changes: 1
                } as unknown as RunResult
            });

            const result = await createPrompt(mockMetadata, 'Test content');
            expect(result.success).toBe(true);
            expect(mockRunAsync).toHaveBeenCalledTimes(6);
            expect(mockRunAsync).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO prompts'),
                expect.arrayContaining([mockMetadata.title])
            );
        });

        it('should handle database errors gracefully', async () => {
            const mockRunAsync = runAsync as jest.MockedFunction<typeof runAsync>;
            mockRunAsync.mockResolvedValueOnce({ success: false, error: 'DB error' });

            const result = await createPrompt(mockMetadata, 'Test content');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to insert prompt');
        });

        it('should handle exceptions during prompt creation', async () => {
            const mockRunAsync = runAsync as jest.MockedFunction<typeof runAsync>;
            mockRunAsync.mockRejectedValueOnce(new Error('Database error'));

            const result = await createPrompt(mockMetadata, 'Test content');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to create prompt');
        });
    });

    describe('listPrompts', () => {
        it('should return list of prompts successfully', async () => {
            const mockPrompts = [
                { id: 1, title: 'Prompt 1', primary_category: 'cat1' },
                { id: 2, title: 'Prompt 2', primary_category: 'cat2' }
            ];
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockAllAsync.mockResolvedValueOnce({ success: true, data: mockPrompts });

            const result = await listPrompts();
            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockPrompts);
        });

        it('should handle empty results', async () => {
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockAllAsync.mockResolvedValueOnce({ success: true, data: [] });

            const result = await listPrompts();
            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });

        it('should handle errors', async () => {
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockAllAsync.mockResolvedValueOnce({ success: false, error: 'DB error' });

            const result = await listPrompts();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to list prompts');
        });

        it('should return error when listing prompts fails', async () => {
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockAllAsync.mockRejectedValueOnce(new Error('Database error'));

            const result = await listPrompts();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to list prompts');
        });
    });

    describe('getPromptFiles', () => {
        it('should return prompt content and metadata', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: { content: 'Test content' }
            });

            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: {
                    id: 1,
                    title: 'Test Prompt',
                    primary_category: 'test',
                    directory: 'test-dir',
                    one_line_description: 'Test description',
                    description: 'Full test description',
                    content_hash: 'test-hash',
                    tags: 'tag1,tag2'
                }
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'sub1' }, { name: 'sub2' }]
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [
                    { name: 'var1', role: 'test role', optional_for_user: false },
                    { name: 'var2', role: 'test role 2', optional_for_user: true }
                ]
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [{ category: 'test', name: 'fragment1', variable: 'var1' }]
            });

            const result = await getPromptFiles('1');
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('promptContent', 'Test content');
            expect(result.data).toHaveProperty('metadata');
        });

        it('should return error when prompt content is not found', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: false,
                error: 'Content not found'
            });

            const result = await getPromptFiles('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt not found');
        });

        it('should return error when metadata retrieval fails', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: { content: 'Test content' }
            });

            mockGetAsync.mockResolvedValueOnce({
                success: false,
                error: 'Metadata not found'
            });

            const result = await getPromptFiles('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get prompt metadata');
        });

        it('should return error when prompt content data is undefined', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: undefined
            });

            const result = await getPromptFiles('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt not found');
        });
    });

    describe('getPromptMetadata', () => {
        it('should return error when prompt metadata is not found', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: false,
                error: 'Prompt not found'
            });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Metadata not found');
        });

        it('should return error when subcategories retrieval fails', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: mockMetadata
            });

            mockAllAsync.mockResolvedValueOnce({
                success: false,
                error: 'Failed to get subcategories'
            });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get subcategories');
        });

        it('should return error when prompt metadata data is undefined', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: undefined
            });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Metadata not found');
        });

        it('should return error when subcategories data is undefined', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: mockMetadata
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: undefined
            });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get subcategories');
        });

        it('should return error when variables data is undefined', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: mockMetadata
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'sub1' }, { name: 'sub2' }]
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: undefined
            });

            const result = await getPromptMetadata('1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to get variables');
        });

        it('should return error when fragments data is undefined', async () => {
            const mockGetAsync = getAsync as jest.MockedFunction<typeof getAsync>;
            const mockAllAsync = allAsync as jest.MockedFunction<typeof allAsync>;
            mockGetAsync.mockResolvedValueOnce({
                success: true,
                data: mockMetadata
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [{ name: 'sub1' }, { name: 'sub2' }]
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: [
                    { name: 'var1', role: 'test role', optional_for_user: false },
                    { name: 'var2', role: 'test role 2', optional_for_user: true }
                ]
            });

            mockAllAsync.mockResolvedValueOnce({
                success: true,
                data: undefined
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
        let consoleOutput: string[];
        beforeEach(() => {
            jest.clearAllMocks();
            consoleOutput = [];
            jest.spyOn(console, 'log').mockImplementation((...args) => {
                consoleOutput.push(args.join(' '));
            });
        });

        it('should display prompt details correctly', async () => {
            const mockReadEnvVars = readEnvVars as jest.MockedFunction<typeof readEnvVars>;
            mockReadEnvVars.mockResolvedValueOnce({
                success: true,
                data: [{ id: 1, name: 'var1', value: 'test-value', scope: 'global' }]
            });

            await viewPromptDetails(mockPrompt);

            expect(consoleOutput.join('\n')).toMatchSnapshot();
        });

        it('should handle env vars fetch failure', async () => {
            const mockReadEnvVars = readEnvVars as jest.MockedFunction<typeof readEnvVars>;
            mockReadEnvVars.mockResolvedValueOnce({ success: false, error: 'Failed to read env vars' });

            await viewPromptDetails(mockPrompt);

            expect(consoleOutput.join('\n')).toMatchSnapshot();
        });

        it('should display fragment variable correctly', async () => {
            const mockPromptWithFragment: PromptMetadata & { variables: Variable[] } = {
                ...mockPrompt,
                variables: [
                    {
                        name: 'var1',
                        role: 'test role',
                        optional_for_user: false,
                        value: `${FRAGMENT_PREFIX}fragmentName`
                    }
                ]
            };
            await viewPromptDetails(mockPromptWithFragment);

            expect(consoleOutput.join('\n')).toMatchSnapshot();
        });

        it('should display env variable correctly', async () => {
            const mockPromptWithEnvVar: PromptMetadata & { variables: Variable[] } = {
                ...mockPrompt,
                variables: [
                    {
                        name: 'var1',
                        role: 'test role',
                        optional_for_user: false,
                        value: `${ENV_PREFIX}ENV_VAR_NAME`
                    }
                ]
            };
            const mockReadEnvVars = readEnvVars as jest.MockedFunction<typeof readEnvVars>;
            mockReadEnvVars.mockResolvedValueOnce({
                success: true,
                data: [{ id: 1, name: 'ENV_VAR_NAME', value: 'env-value', scope: 'global' }]
            });

            await viewPromptDetails(mockPromptWithEnvVar);

            expect(consoleOutput.join('\n')).toMatchSnapshot();
        });

        it('should display regular variable value correctly', async () => {
            const mockPromptWithValue: PromptMetadata & { variables: Variable[] } = {
                ...mockPrompt,
                variables: [
                    {
                        name: 'var1',
                        role: 'test role',
                        optional_for_user: false,
                        value: 'regular value'
                    }
                ]
            };
            await viewPromptDetails(mockPromptWithValue);

            expect(consoleOutput.join('\n')).toMatchSnapshot();
        });

        it('should not display variable status when isExecute is true', async () => {
            await viewPromptDetails(mockPrompt, true);

            const output = consoleOutput.join('\n');
            expect(output).not.toContain('Not Set');
            expect(output).not.toContain('Set:');
        });
    });
});
