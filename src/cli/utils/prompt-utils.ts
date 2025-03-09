import chalk from 'chalk';

import { CategoryItem, EnvVariable, PromptMetadata, PromptVariable } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string-formatter';
import { ENV_PREFIX, FRAGMENT_PREFIX } from '../constants';
import { fetchCategories, updatePromptVariable } from './database';
import { viewFragmentContent } from './fragments';

export interface PromptDisplayInfo {
    id: string;
    title: string;
    category: string;
    directory: string;
    description: string;
}

export async function getPromptCategories(): Promise<Record<string, CategoryItem[]>> {
    const result = await fetchCategories();

    if (!result.success || !result.data) {
        throw new Error(`Failed to fetch categories: ${result.error}`);
    }
    return result.data;
}

export function getAllPrompts(categories: Record<string, CategoryItem[]>): Array<CategoryItem & { category: string }> {
    return Object.entries(categories)
        .flatMap(([category, prompts]) =>
            prompts.map((prompt) => ({
                ...prompt,
                category
            }))
        )
        .sort((a, b) => a.title.localeCompare(b.title));
}

export function getPromptsSortedById(
    categories: Record<string, CategoryItem[]>
): Array<CategoryItem & { category: string }> {
    return getAllPrompts(categories).sort((a, b) => Number(a.id) - Number(b.id));
}

export function searchPrompts(
    categories: Record<string, CategoryItem[]>,
    searchTerm: string
): Array<CategoryItem & { category: string }> {
    const allPrompts = getAllPrompts(categories);
    const term = searchTerm.toLowerCase();
    return allPrompts.filter(
        (prompt) =>
            prompt.title.toLowerCase().includes(term) ||
            prompt.description.toLowerCase().includes(term) ||
            prompt.category.toLowerCase().includes(term) ||
            prompt.path.toLowerCase().includes(term)
    );
}

export function formatPromptsForDisplay(prompts: Array<CategoryItem & { category: string }>): {
    headers: string;
    rows: string[];
    maxLengths: { id: number; dir: number; category: number };
} {
    const maxIdLength = Math.max(...prompts.map((p) => p.id.toString().length));
    const maxDirLength = Math.max(
        ...prompts.map((p) => {
            const directory = p.path.split('/').pop() || '';
            return directory.length;
        }),
        10
    );
    const maxCategoryLength = Math.max(...prompts.map((p) => p.category.length));
    const headers =
        `${chalk.bold('ID'.padEnd(maxIdLength + 2))}` +
        `${chalk.bold('Directory'.padEnd(maxDirLength + 2))}` +
        `${chalk.bold('Category'.padEnd(maxCategoryLength + 2))}` +
        `${chalk.bold('Title')}`;
    const rows = prompts.map((prompt) => {
        const directory = prompt.path.split('/').pop() || '';
        return (
            `${chalk.green(prompt.id.toString().padEnd(maxIdLength + 2))}` +
            `${chalk.yellow(directory.padEnd(maxDirLength + 2))}` +
            `${chalk.cyan(prompt.category.padEnd(maxCategoryLength + 2))}` +
            `${prompt.title}`
        );
    });
    return {
        headers,
        rows,
        maxLengths: {
            id: maxIdLength,
            dir: maxDirLength,
            category: maxCategoryLength
        }
    };
}

export function getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
        analysis: 'Data and information analysis tools',
        art_and_design: 'Visual and aesthetic content creation tools',
        business: 'Business operations, strategy, and management',
        coding: 'Software development, programming, and engineering',
        content_creation: 'Documentation, writing, and creative content',
        customer_service: 'Support and client communication assistants',
        data_processing: 'Data analysis, visualization, and transformation',
        education: 'Teaching, learning, and knowledge sharing',
        entertainment: 'Recreation, gaming, and media consumption',
        finance: 'Money management and financial planning',
        gaming: 'Game design, playing strategies, and gaming content',
        healthcare: 'Health, wellness, medicine, and fitness',
        language: 'Language learning, linguistics, and translation',
        legal: 'Law, compliance, and legal documentation',
        marketing: 'Promotion, advertising, and brand development',
        music: 'Music creation, theory, and production',
        personal_assistant: 'Task management and daily support',
        problem_solving: 'General problem analysis and solution frameworks',
        productivity: 'Efficiency, workflow, and time management',
        prompt_engineering: 'Creating and optimizing AI prompts',
        research: 'Academic or professional research assistance',
        science: 'Scientific inquiry, methodology, and education',
        social_media: 'Online platform content and strategy',
        translation: 'Text, concept, and knowledge translation',
        writing: 'Written content creation and editing',
        personal_growth: 'Self-improvement, coaching, and development',
        communication: 'Interpersonal skills, writing, and messaging',
        creative: 'Creative expression across multiple mediums',
        specialized: 'Domain-specific agents for specialized tasks'
    };
    return descriptions[category] || `${formatTitleCase(category)} prompts`;
}

export function formatCategoriesForDisplay(categories: Record<string, CategoryItem[]>): {
    headers: string;
    rows: string[];
} {
    const categoryList = Object.keys(categories).sort();
    const countsByCategory: Record<string, number> = {};

    for (const category of categoryList) {
        countsByCategory[category] = categories[category].length;
    }

    const maxCategoryLength = Math.max(...categoryList.map((c) => c.length));
    const headers =
        `${chalk.bold('Category'.padEnd(maxCategoryLength + 2))}` +
        `${chalk.bold('Count')}  ` +
        `${chalk.bold('Description')}`;
    const rows = categoryList.map((category) => {
        const count = countsByCategory[category];
        const description = getCategoryDescription(category);
        return (
            `${chalk.cyan(category.padEnd(maxCategoryLength + 2))}` +
            `${chalk.yellow(count.toString().padEnd(7))}` +
            `${description}`
        );
    });
    return { headers, rows };
}

export function getVariableNameColor(variable: PromptVariable): (text: string) => string {
    if (variable.value) {
        if (variable.value.startsWith(FRAGMENT_PREFIX)) return chalk.blue;

        if (variable.value.startsWith(ENV_PREFIX)) return chalk.magenta;
        return chalk.green;
    }
    return variable.optional_for_user ? chalk.yellow : chalk.red;
}

export function getVariableHint(variable: PromptVariable, envVars: EnvVariable[]): string {
    if (!variable.value) {
        const matchingEnvVar = envVars.find((env) => env.name === variable.name);

        if (matchingEnvVar) {
            return chalk.magenta(' (env available)');
        }
    }
    return '';
}

export function formatVariableChoices(
    variables: PromptVariable[],
    envVars: EnvVariable[]
): Array<{ name: string; value: PromptVariable }> {
    return variables.map((v) => {
        const snakeCaseName = formatSnakeCase(v.name);
        const nameColor = getVariableNameColor(v);
        const hint = getVariableHint(v, envVars);
        return {
            name: `${chalk.reset('Assign')} ${nameColor(snakeCaseName)}${chalk.reset(v.optional_for_user ? '' : '*')}${hint}`,
            value: v
        };
    });
}

export function allRequiredVariablesSet(details: PromptMetadata): boolean {
    return details.variables.every((v) => v.optional_for_user || v.value);
}

export async function setVariableValue(promptId: string, variableName: string, value: string): Promise<boolean> {
    const updateResult = await updatePromptVariable(promptId, variableName, value);
    return updateResult.success;
}

export async function assignFragmentToVariable(
    promptId: string,
    variableName: string,
    fragmentCategory: string,
    fragmentName: string
): Promise<string | null> {
    const fragmentRef = `${FRAGMENT_PREFIX}${fragmentCategory}/${fragmentName}`;
    const updateResult = await updatePromptVariable(promptId, variableName, fragmentRef);

    if (!updateResult.success) {
        return null;
    }

    const contentResult = await viewFragmentContent(fragmentCategory, fragmentName);

    if (!contentResult.success || !contentResult.data) {
        return null;
    }
    return contentResult.data;
}

export async function assignEnvironmentVariable(
    promptId: string,
    variableName: string,
    envVarName: string,
    envVarValue: string
): Promise<string | null> {
    const envVarRef = `${ENV_PREFIX}${envVarName}`;
    const updateResult = await updatePromptVariable(promptId, variableName, envVarRef);

    if (!updateResult.success) {
        return null;
    }
    return envVarValue;
}

export function getMatchingEnvironmentVariables(variable: PromptVariable, envVars: EnvVariable[]): EnvVariable[] {
    return envVars.filter(
        (ev) =>
            ev.name.toLowerCase().includes(variable.name.toLowerCase()) ||
            variable.name.toLowerCase().includes(ev.name.toLowerCase())
    );
}

export async function unsetAllVariables(
    promptId: string,
    variables: PromptVariable[]
): Promise<{ success: boolean; errors: { variable: string; error: string }[] }> {
    const errors: { variable: string; error: string }[] = [];

    for (const variable of variables) {
        try {
            const unsetResult = await updatePromptVariable(promptId, variable.name, '');

            if (!unsetResult.success) {
                errors.push({
                    variable: variable.name,
                    error: unsetResult.error || 'Unknown error'
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({
                variable: variable.name,
                error: errorMessage
            });
        }
    }
    return {
        success: errors.length === 0,
        errors
    };
}
