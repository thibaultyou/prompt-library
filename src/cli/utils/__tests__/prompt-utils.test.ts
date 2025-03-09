import { CategoryItem, EnvVariable, PromptMetadata } from '../../../shared/types';
import { updatePromptVariable } from '../database';
import { readEnvVars } from '../env-vars';
import { listFragments, viewFragmentContent } from '../fragments';
import {
    getPromptCategories,
    getAllPrompts,
    formatPromptsForDisplay,
    formatCategoriesForDisplay,
    formatVariableChoices,
    allRequiredVariablesSet,
    assignFragmentToVariable,
    assignEnvironmentVariable,
    getMatchingEnvironmentVariables
} from '../prompt-utils';

jest.mock('../../../shared/utils/string-formatter', () => ({
    formatSnakeCase: jest.fn((str) => str)
}));

jest.mock('../database', () => ({
    allAsync: jest.fn().mockResolvedValue({
        success: true,
        data: [
            {
                id: 1,
                title: 'Test Prompt 1',
                path: 'prompts/test_1',
                primary_category: 'coding',
                description: 'Test description 1'
            },
            {
                id: 2,
                title: 'Test Prompt 2',
                path: 'prompts/test_2',
                primary_category: 'writing',
                description: 'Test description 2'
            },
            {
                id: 3,
                title: 'Test Prompt 3',
                path: 'prompts/test_3',
                primary_category: 'coding',
                description: 'Test description 3'
            }
        ]
    }),
    updatePromptVariable: jest.fn().mockResolvedValue({
        success: true
    }),
    fetchCategories: jest.fn().mockResolvedValue({
        success: true,
        data: {
            coding: [
                {
                    id: '1',
                    title: 'Test Prompt 1',
                    path: 'prompts/test_1',
                    primary_category: 'coding',
                    description: 'Test description 1',
                    subcategories: []
                },
                {
                    id: '3',
                    title: 'Test Prompt 3',
                    path: 'prompts/test_3',
                    primary_category: 'coding',
                    description: 'Test description 3',
                    subcategories: []
                }
            ],
            writing: [
                {
                    id: '2',
                    title: 'Test Prompt 2',
                    path: 'prompts/test_2',
                    primary_category: 'writing',
                    description: 'Test description 2',
                    subcategories: []
                }
            ]
        }
    })
}));

jest.mock('../fragments', () => ({
    listFragments: jest.fn(),
    viewFragmentContent: jest.fn()
}));

jest.mock('../env-vars', () => ({
    readEnvVars: jest.fn()
}));

describe('Prompt Utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('prompt categories', () => {
        it('should retrieve and organize prompt categories', async () => {
            const categories = await getPromptCategories();
            expect(categories).toHaveProperty('coding');
            expect(categories).toHaveProperty('writing');
            expect(categories.coding).toHaveLength(2);
            expect(categories.writing).toHaveLength(1);
        });

        it('should get all prompts from categories', async () => {
            const categories = await getPromptCategories();
            const allPrompts = getAllPrompts(categories);
            expect(allPrompts).toHaveLength(3);
            expect(allPrompts[0]).toHaveProperty('id');
            expect(allPrompts[0]).toHaveProperty('title');
            expect(allPrompts[0]).toHaveProperty('category');
        });

        it('should format prompts for display', async () => {
            const prompts = [
                {
                    id: '1',
                    title: 'Test 1',
                    path: 'prompts/test_1',
                    category: 'coding',
                    primary_category: 'coding',
                    description: 'Test description 1',
                    subcategories: []
                },
                {
                    id: '2',
                    title: 'Test 2',
                    path: 'prompts/test_2',
                    category: 'writing',
                    primary_category: 'writing',
                    description: 'Test description 2',
                    subcategories: []
                }
            ];
            const formatted = formatPromptsForDisplay(prompts);
            expect(formatted).toHaveProperty('headers');
            expect(formatted).toHaveProperty('rows');
            expect(formatted.rows.length).toBeGreaterThan(0);
        });

        it('should format categories for display', async () => {
            const categories = {
                coding: [
                    {
                        id: '1',
                        title: 'Test 1',
                        primary_category: 'coding',
                        description: 'Test description',
                        path: 'prompts/test_1',
                        subcategories: []
                    } as CategoryItem
                ],
                writing: [
                    {
                        id: '2',
                        title: 'Test 2',
                        primary_category: 'writing',
                        description: 'Test description',
                        path: 'prompts/test_2',
                        subcategories: []
                    } as CategoryItem
                ]
            };
            const formatted = formatCategoriesForDisplay(categories);
            expect(formatted).toHaveProperty('headers');
            expect(formatted).toHaveProperty('rows');
        });
    });

    describe('variable management', () => {
        const mockPromptMetadata: PromptMetadata = {
            id: '123',
            title: 'Test Prompt',
            directory: 'test_prompt',
            primary_category: 'test',
            subcategories: [],
            description: 'Test description',
            one_line_description: 'Short description',
            tags: [],
            content_hash: '',
            variables: [
                { name: 'required_var', role: 'Required variable', optional_for_user: false },
                { name: 'optional_var', role: 'Optional variable', optional_for_user: true },
                {
                    name: 'required_with_value',
                    role: 'Required with value',
                    optional_for_user: false,
                    value: 'test value'
                }
            ]
        };
        it('should check if all required variables are set', () => {
            const notAllSet = allRequiredVariablesSet(mockPromptMetadata);
            expect(notAllSet).toBe(false);

            const allSetMetadata = {
                ...mockPromptMetadata,
                variables: [
                    { name: 'var1', role: 'Variable 1', optional_for_user: false, value: 'value1' },
                    { name: 'var2', role: 'Variable 2', optional_for_user: true }
                ]
            };
            const allSet = allRequiredVariablesSet(allSetMetadata);
            expect(allSet).toBe(true);

            const noVarsMetadata = {
                ...mockPromptMetadata,
                variables: []
            };
            const noVars = allRequiredVariablesSet(noVarsMetadata);
            expect(noVars).toBe(true);
        });

        it('should format variable choices', () => {
            const mockEnvVars: EnvVariable[] = [{ id: 1, name: 'API_KEY', value: 'abc123', scope: 'global' }];
            const choices = formatVariableChoices(mockPromptMetadata.variables, mockEnvVars);
            expect(Array.isArray(choices)).toBe(true);
            expect(choices.length).toBeGreaterThan(0);

            choices.forEach((choice) => {
                expect(choice).toHaveProperty('name');
                expect(choice).toHaveProperty('value');
                expect(typeof choice.name).toBe('string');
            });
        });
    });

    describe('fragment integration', () => {
        beforeEach(() => {
            (listFragments as jest.Mock).mockResolvedValue({
                success: true,
                data: [
                    { category: 'intro', name: 'welcome', variable: 'WELCOME' },
                    { category: 'outro', name: 'farewell', variable: 'FAREWELL' }
                ]
            });

            (viewFragmentContent as jest.Mock).mockResolvedValue({
                success: true,
                data: 'Fragment content'
            });
        });

        it('should assign fragment content to a variable', async () => {
            const promptId = '123';
            const variableName = 'test_var';
            const fragmentCategory = 'intro';
            const fragmentName = 'welcome';
            const result = await assignFragmentToVariable(promptId, variableName, fragmentCategory, fragmentName);
            expect(updatePromptVariable).toHaveBeenCalled();
            expect(viewFragmentContent).toHaveBeenCalledWith(fragmentCategory, fragmentName);
            expect(result).toBe('Fragment content');
        });

        it('should handle errors when assigning fragments', async () => {
            (updatePromptVariable as jest.Mock).mockResolvedValueOnce({
                success: false
            });

            const result = await assignFragmentToVariable('123', 'test_var', 'intro', 'welcome');
            expect(result).toBeNull();
        });
    });

    describe('environment variable integration', () => {
        beforeEach(() => {
            (readEnvVars as jest.Mock).mockResolvedValue({
                success: true,
                data: [
                    { name: 'API_KEY', value: 'abc123', description: 'API key' },
                    { name: 'USER_NAME', value: 'testuser', description: 'User name' }
                ]
            });
        });

        it('should get matching environment variables', async () => {
            const mockVariable = {
                name: 'api_key',
                role: 'API Key',
                optional_for_user: false
            };
            const mockEnvVars: EnvVariable[] = [
                { id: 1, name: 'API_KEY', value: 'abc123', scope: 'global' },
                { id: 2, name: 'USER_NAME', value: 'testuser', scope: 'global' }
            ];
            const matches = getMatchingEnvironmentVariables(mockVariable, mockEnvVars);
            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0].name).toBe('API_KEY');
        });

        it('should assign environment variable to prompt variable', async () => {
            const promptId = '123';
            const variableName = 'api_key_var';
            const envVarName = 'API_KEY';
            const envVarValue = 'abc123';
            const result = await assignEnvironmentVariable(promptId, variableName, envVarName, envVarValue);
            expect(updatePromptVariable).toHaveBeenCalled();
            expect(result).not.toBeNull();
        });
    });
});
