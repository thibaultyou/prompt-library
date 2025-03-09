import { CategoryItem, EnvVariable, PromptMetadata, PromptVariable } from '../../../shared/types';
import { ENV_PREFIX, FRAGMENT_PREFIX } from '../../constants';
import { fetchCategories, updatePromptVariable } from '../database';
import { viewFragmentContent } from '../fragments';
import * as promptUtils from '../prompt-utils';

jest.mock('../database');
jest.mock('../fragments');
jest.mock('chalk', () => ({
    cyan: jest.fn((text) => `cyan:${text}`),
    green: jest.fn((text) => `green:${text}`),
    blue: jest.fn((text) => `blue:${text}`),
    yellow: jest.fn((text) => `yellow:${text}`),
    red: jest.fn((text) => `red:${text}`),
    magenta: jest.fn((text) => `magenta:${text}`),
    bold: jest.fn((text) => `bold:${text}`),
    reset: jest.fn((text) => `reset:${text || ''}`)
}));

describe('Prompt Utils', () => {
    const mockCategories: Record<string, CategoryItem[]> = {
        coding: [
            {
                id: '1',
                title: 'Coding Prompt 1',
                path: '/prompts/coding_prompt_1',
                description: 'A coding prompt',
                primary_category: 'coding',
                subcategories: []
            },
            {
                id: '2',
                title: 'Coding Prompt 2',
                path: '/prompts/coding_prompt_2',
                description: 'Another coding prompt',
                primary_category: 'coding',
                subcategories: []
            }
        ],
        writing: [
            {
                id: '3',
                title: 'Writing Prompt',
                path: '/prompts/writing_prompt',
                description: 'A writing prompt',
                primary_category: 'writing',
                subcategories: []
            }
        ]
    };
    const mockVariables: PromptVariable[] = [
        { name: 'var1', role: 'role1', optional_for_user: false },
        { name: 'var2', role: 'role2', optional_for_user: true, value: 'value2' },
        { name: 'var3', role: 'role3', optional_for_user: false, value: `${FRAGMENT_PREFIX}category/fragment` },
        { name: 'var4', role: 'role4', optional_for_user: false, value: `${ENV_PREFIX}ENV_VAR` }
    ];
    const mockEnvVars: EnvVariable[] = [
        { id: 1, name: 'var1', value: 'env_value1', scope: 'global' },
        { id: 2, name: 'ENV_VAR', value: 'env_value2', scope: 'global' }
    ];
    describe('getPromptCategories', () => {
        it('should return categories when fetch succeeds', async () => {
            (fetchCategories as jest.Mock).mockResolvedValueOnce({
                success: true,
                data: mockCategories
            });

            const result = await promptUtils.getPromptCategories();
            expect(result).toEqual(mockCategories);
        });

        it('should throw error when fetch fails', async () => {
            (fetchCategories as jest.Mock).mockResolvedValueOnce({
                success: false,
                error: 'Database error'
            });

            await expect(promptUtils.getPromptCategories()).rejects.toThrow('Failed to fetch categories');
        });
    });

    describe('getAllPrompts', () => {
        it('should return all prompts with category information', () => {
            const result = promptUtils.getAllPrompts(mockCategories);
            expect(result).toHaveLength(3);

            expect(result.map((p) => p.id).sort()).toEqual(['1', '2', '3']);

            expect(result.find((p) => p.id === '1')?.category).toBe('coding');
            expect(result.find((p) => p.id === '2')?.category).toBe('coding');
            expect(result.find((p) => p.id === '3')?.category).toBe('writing');
        });
    });

    describe('getPromptsSortedById', () => {
        it('should return prompts sorted by ID', () => {
            const result = promptUtils.getPromptsSortedById(mockCategories);
            expect(result).toHaveLength(3);
            expect(result[0].id).toBe('1');
            expect(result[1].id).toBe('2');
            expect(result[2].id).toBe('3');
        });
    });

    describe('searchPrompts', () => {
        it('should find prompts matching title', () => {
            const result = promptUtils.searchPrompts(mockCategories, 'Writing');
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Writing Prompt');
        });

        it('should find prompts matching description', () => {
            const result = promptUtils.searchPrompts(mockCategories, 'Another');
            expect(result).toHaveLength(1);
            expect(result[0].description).toBe('Another coding prompt');
        });

        it('should find prompts matching category', () => {
            const result = promptUtils.searchPrompts(mockCategories, 'coding');
            expect(result).toHaveLength(2);
            expect(result[0].category).toBe('coding');
            expect(result[1].category).toBe('coding');
        });

        it('should find prompts matching path', () => {
            const result = promptUtils.searchPrompts(mockCategories, 'writing_prompt');
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/prompts/writing_prompt');
        });

        it('should return empty array when no matches', () => {
            const result = promptUtils.searchPrompts(mockCategories, 'nonexistent');
            expect(result).toHaveLength(0);
        });
    });

    describe('formatPromptsForDisplay', () => {
        it('should format prompts for display', () => {
            const prompts = promptUtils.getAllPrompts(mockCategories);
            const result = promptUtils.formatPromptsForDisplay(prompts);
            expect(result.headers).toContain('bold:ID');
            expect(result.headers).toContain('bold:Directory');
            expect(result.headers).toContain('bold:Category');
            expect(result.headers).toContain('bold:Title');

            expect(result.rows).toHaveLength(3);

            const rowWithId2 = result.rows.find((row) => row.includes('green:2'));
            expect(rowWithId2).toBeDefined();

            if (rowWithId2) {
                expect(rowWithId2).toContain('yellow:coding_prompt_2');
                expect(rowWithId2).toContain('cyan:coding');
            }

            expect(result.maxLengths.id).toBe(1);
            expect(result.maxLengths.category).toBe(7);
        });
    });

    describe('getCategoryDescription', () => {
        it('should return description for known categories', () => {
            expect(promptUtils.getCategoryDescription('coding')).toBe(
                'Software development, programming, and engineering'
            );
            expect(promptUtils.getCategoryDescription('writing')).toBe('Written content creation and editing');
        });

        it('should return fallback description for unknown categories', () => {
            expect(promptUtils.getCategoryDescription('unknown')).toBe('Unknown prompts');
        });
    });

    describe('getVariableNameColor', () => {
        it('should return blue for fragment variables', () => {
            const color = promptUtils.getVariableNameColor(mockVariables[2]);
            expect(color).toBe(jest.requireMock('chalk').blue);
        });

        it('should return magenta for env variables', () => {
            const color = promptUtils.getVariableNameColor(mockVariables[3]);
            expect(color).toBe(jest.requireMock('chalk').magenta);
        });

        it('should return green for set variables', () => {
            const color = promptUtils.getVariableNameColor(mockVariables[1]);
            expect(color).toBe(jest.requireMock('chalk').green);
        });

        it('should return yellow for optional unset variables', () => {
            const mockVar = { ...mockVariables[1], value: undefined };
            const color = promptUtils.getVariableNameColor(mockVar);
            expect(color).toBe(jest.requireMock('chalk').yellow);
        });

        it('should return red for required unset variables', () => {
            const mockVar = { ...mockVariables[0], value: undefined };
            const color = promptUtils.getVariableNameColor(mockVar);
            expect(color).toBe(jest.requireMock('chalk').red);
        });
    });

    describe('getVariableHint', () => {
        it('should return env hint for matching variables', () => {
            const hint = promptUtils.getVariableHint(mockVariables[0], mockEnvVars);
            expect(hint).toContain('magenta:');
            expect(hint).toContain('env available');
        });

        it('should return empty string for non-matching variables', () => {
            const mockVar = { name: 'nonexistent', role: 'role', optional_for_user: false };
            const hint = promptUtils.getVariableHint(mockVar, mockEnvVars);
            expect(hint).toBe('');
        });

        it('should return empty string for variables with values', () => {
            const hint = promptUtils.getVariableHint(mockVariables[1], mockEnvVars);
            expect(hint).toBe('');
        });
    });

    describe('formatVariableChoices', () => {
        it('should format variables for choices', () => {
            const choices = promptUtils.formatVariableChoices(mockVariables, mockEnvVars);
            expect(choices).toHaveLength(4);

            expect(choices[0].name).toContain('red:var1');
            expect(choices[0].name).toContain('magenta: (env available)');

            expect(choices[1].name).toContain('green:var2');

            expect(choices[2].name).toContain('blue:var3');

            expect(choices[3].name).toContain('magenta:var4');
        });
    });

    describe('allRequiredVariablesSet', () => {
        it('should return true when all required variables are set', () => {
            const mockMetadata: PromptMetadata = {
                id: '1',
                title: 'Test',
                primary_category: 'test',
                subcategories: [],
                directory: 'test',
                tags: [],
                one_line_description: 'test',
                description: 'test',
                content_hash: 'test',
                variables: [
                    { name: 'var1', role: 'role1', optional_for_user: false, value: 'value1' },
                    { name: 'var2', role: 'role2', optional_for_user: true }
                ],
                fragments: []
            };
            const result = promptUtils.allRequiredVariablesSet(mockMetadata);
            expect(result).toBe(true);
        });

        it('should return false when any required variable is not set', () => {
            const mockMetadata: PromptMetadata = {
                id: '1',
                title: 'Test',
                primary_category: 'test',
                subcategories: [],
                directory: 'test',
                tags: [],
                one_line_description: 'test',
                description: 'test',
                content_hash: 'test',
                variables: [
                    { name: 'var1', role: 'role1', optional_for_user: false },
                    { name: 'var2', role: 'role2', optional_for_user: true, value: 'value2' }
                ],
                fragments: []
            };
            const result = promptUtils.allRequiredVariablesSet(mockMetadata);
            expect(result).toBe(false);
        });
    });

    describe('setVariableValue', () => {
        it('should update variable value and return success', async () => {
            (updatePromptVariable as jest.Mock).mockResolvedValueOnce({ success: true });

            const result = await promptUtils.setVariableValue('1', 'var1', 'new value');
            expect(result).toBe(true);
            expect(updatePromptVariable).toHaveBeenCalledWith('1', 'var1', 'new value');
        });

        it('should return false when update fails', async () => {
            (updatePromptVariable as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Update failed' });

            const result = await promptUtils.setVariableValue('1', 'var1', 'new value');
            expect(result).toBe(false);
        });
    });

    describe('assignFragmentToVariable', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should assign fragment and return content on success', async () => {
            (updatePromptVariable as jest.Mock).mockResolvedValueOnce({ success: true });
            (viewFragmentContent as jest.Mock).mockResolvedValueOnce({
                success: true,
                data: 'Fragment content'
            });

            const result = await promptUtils.assignFragmentToVariable('1', 'var1', 'category', 'fragment');
            expect(result).toBe('Fragment content');
            expect(updatePromptVariable).toHaveBeenCalledWith('1', 'var1', `${FRAGMENT_PREFIX}category/fragment`);
        });

        it('should return null when update fails', async () => {
            (updatePromptVariable as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Update failed' });

            const result = await promptUtils.assignFragmentToVariable('1', 'var1', 'category', 'fragment');
            expect(result).toBeNull();

            expect(viewFragmentContent).not.toHaveBeenCalled();
        });

        it('should return null when fragment content fetch fails', async () => {
            (updatePromptVariable as jest.Mock).mockResolvedValueOnce({ success: true });
            (viewFragmentContent as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Not found' });

            const result = await promptUtils.assignFragmentToVariable('1', 'var1', 'category', 'fragment');
            expect(result).toBeNull();
        });
    });

    describe('unsetAllVariables', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should unset all variables and return success', async () => {
            (updatePromptVariable as jest.Mock).mockResolvedValue({ success: true });

            const result = await promptUtils.unsetAllVariables('1', mockVariables);
            expect(result.success).toBe(true);
            expect(result.errors).toHaveLength(0);

            expect(updatePromptVariable).toHaveBeenCalledTimes(mockVariables.length);
            mockVariables.forEach((variable) => {
                expect(updatePromptVariable).toHaveBeenCalledWith('1', variable.name, '');
            });
        });

        it('should collect errors when updates fail', async () => {
            (updatePromptVariable as jest.Mock)
                .mockResolvedValueOnce({ success: true })
                .mockResolvedValueOnce({ success: false, error: 'Update failed for var2' })
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('Network error for var4'));

            const result = await promptUtils.unsetAllVariables('1', mockVariables);
            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(2);
            expect(result.errors[0].variable).toBe('var2');
            expect(result.errors[1].variable).toBe('var4');
            expect(result.errors[1].error).toBe('Network error for var4');
        });
    });
});
