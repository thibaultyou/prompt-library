import chalk from 'chalk';

import { allAsync, getAsync, runAsync } from './database';
import { handleError } from './errors';
import { ApiResult, PromptFragment, PromptMetadata, PromptVariable } from '../../shared/types';
import { formatSnakeCase, formatTitleCase } from '../../shared/utils/string-formatter';
import { FRAGMENT_PREFIX, ENV_PREFIX } from '../constants';
import { readEnvVars } from './env-vars';

interface GetPromptFilesOptions {
    cleanVariables?: boolean;
}

export async function createPrompt(promptMetadata: PromptMetadata, content: string): Promise<ApiResult<void>> {
    try {
        let tagsString: string;

        if (typeof promptMetadata.tags === 'string') {
            tagsString = promptMetadata.tags;
        } else {
            tagsString = promptMetadata.tags.join(',');
        }

        const result = await runAsync(
            'INSERT INTO prompts (title, content, primary_category, directory, one_line_description, description, content_hash, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                promptMetadata.title,
                content,
                promptMetadata.primary_category,
                promptMetadata.directory,
                promptMetadata.one_line_description,
                promptMetadata.description,
                promptMetadata.content_hash,
                tagsString
            ]
        );
        const promptId = result.data?.lastID;

        if (!promptId) {
            return { success: false, error: 'Failed to insert prompt' };
        }

        for (const subcategory of promptMetadata.subcategories) {
            await runAsync('INSERT INTO subcategories (prompt_id, name) VALUES (?, ?)', [promptId, subcategory]);
        }

        for (const variable of promptMetadata.variables) {
            await runAsync('INSERT INTO variables (prompt_id, name, role, optional_for_user) VALUES (?, ?, ?, ?)', [
                promptId,
                variable.name,
                variable.role,
                variable.optional_for_user
            ]);
        }

        for (const fragment of promptMetadata.fragments || []) {
            await runAsync('INSERT INTO fragments (prompt_id, category, name) VALUES (?, ?, ?)', [
                promptId,
                fragment.category,
                fragment.name
            ]);
        }
        return { success: true };
    } catch (error) {
        handleError(error, 'creating prompt');
        return { success: false, error: 'Failed to create prompt' };
    }
}

export async function listPrompts(): Promise<ApiResult<PromptMetadata[]>> {
    try {
        const prompts = await allAsync<PromptMetadata>('SELECT id, title, primary_category FROM prompts');

        if (!prompts.success || !prompts.data) {
            return { success: false, error: 'Failed to list prompts' };
        }
        return { success: true, data: prompts.data };
    } catch (error) {
        handleError(error, 'listing prompts');
        return { success: false, error: 'Failed to list prompts' };
    }
}

export async function getPromptFiles(
    promptIdOrName: string,
    options: GetPromptFilesOptions = { cleanVariables: false }
): Promise<ApiResult<{ promptContent: string; metadata: PromptMetadata }>> {
    try {
        let query = 'SELECT id, content FROM prompts WHERE id = ?';
        let params: any[] = [promptIdOrName];

        if (isNaN(Number(promptIdOrName))) {
            query = 'SELECT id, content FROM prompts WHERE directory LIKE ?';
            params = [`%${promptIdOrName}%`];
        }

        const promptResult = await getAsync<{ id: string; content: string }>(query, params);

        if (!promptResult.success || !promptResult.data) {
            query = 'SELECT id, content FROM prompts WHERE LOWER(title) LIKE ?';
            params = [`%${promptIdOrName.toLowerCase()}%`];

            const titleResult = await getAsync<{ id: string; content: string }>(query, params);

            if (!titleResult.success || !titleResult.data) {
                return { success: false, error: 'Prompt not found' };
            }

            promptResult.data = titleResult.data;
        }

        const promptId = promptResult.data.id;
        const promptContent = promptResult.data.content;
        const metadataResult = await getPromptMetadata(promptId, options);

        if (!metadataResult.success || !metadataResult.data) {
            return { success: false, error: 'Failed to get prompt metadata' };
        }
        return {
            success: true,
            data: {
                promptContent: promptContent,
                metadata: metadataResult.data
            }
        };
    } catch (error) {
        handleError(error, 'getting prompt files');
        return { success: false, error: 'Failed to get prompt files' };
    }
}

export async function getPromptMetadata(
    promptIdOrName: string,
    options: GetPromptFilesOptions = { cleanVariables: false }
): Promise<ApiResult<PromptMetadata>> {
    try {
        let actualPromptId = promptIdOrName;

        if (isNaN(Number(promptIdOrName))) {
            const promptByDirectory = await getAsync<{ id: string }>('SELECT id FROM prompts WHERE directory LIKE ?', [
                `%${promptIdOrName}%`
            ]);

            if (promptByDirectory.success && promptByDirectory.data) {
                actualPromptId = promptByDirectory.data.id;
            } else {
                const promptByTitle = await getAsync<{ id: string }>(
                    'SELECT id FROM prompts WHERE LOWER(title) LIKE ?',
                    [`%${promptIdOrName.toLowerCase()}%`]
                );

                if (!promptByTitle.success || !promptByTitle.data) {
                    return { success: false, error: 'Metadata not found' };
                }

                actualPromptId = promptByTitle.data.id;
            }
        }

        const promptResult = await getAsync<PromptMetadata>('SELECT * FROM prompts WHERE id = ?', [actualPromptId]);

        if (!promptResult.success || !promptResult.data) {
            return { success: false, error: 'Metadata not found' };
        }

        const subcategoriesResult = await allAsync<{ name: string }>(
            'SELECT name FROM subcategories WHERE prompt_id = ?',
            [actualPromptId]
        );

        if (!subcategoriesResult.success || !subcategoriesResult.data) {
            return { success: false, error: 'Failed to get subcategories' };
        }

        const variablesQuery = options.cleanVariables
            ? 'SELECT name, role, optional_for_user FROM variables WHERE prompt_id = ?'
            : 'SELECT name, role, optional_for_user, value FROM variables WHERE prompt_id = ?';
        const variablesResult = await allAsync<PromptVariable>(variablesQuery, [actualPromptId]);

        if (!variablesResult.success || !variablesResult.data) {
            return { success: false, error: 'Failed to get variables' };
        }

        const fragmentsResult = await allAsync<PromptFragment>(
            'SELECT category, name, variable FROM fragments WHERE prompt_id = ?',
            [actualPromptId]
        );

        if (!fragmentsResult.success || !fragmentsResult.data) {
            return { success: false, error: 'Failed to get fragments' };
        }

        const variables = variablesResult.data.map((variable) => ({
            ...variable,
            value: options.cleanVariables ? '' : variable.value || ''
        }));
        const promptMetadata: PromptMetadata = {
            id: promptResult.data.id,
            title: promptResult.data.title,
            primary_category: promptResult.data.primary_category,
            subcategories: subcategoriesResult.data.map((s) => s.name),
            directory: promptResult.data.directory,
            tags: promptResult.data.tags,
            one_line_description: promptResult.data.one_line_description,
            description: promptResult.data.description,
            variables: variables,
            content_hash: promptResult.data.content_hash,
            fragments: fragmentsResult.data
        };
        return { success: true, data: promptMetadata };
    } catch (error) {
        handleError(error, 'getting prompt metadata');
        return { success: false, error: 'Failed to get prompt metadata' };
    }
}

export async function viewPromptDetails(details: PromptMetadata, isExecute = false): Promise<void> {
    console.log(chalk.cyan('Prompt:'), details.title);
    console.log(`\n${details.description || ''}`);
    console.log(chalk.cyan('\nCategory:'), formatTitleCase(details.primary_category));
    let tagsArray: string[];

    if (typeof details.tags === 'string') {
        tagsArray = details.tags.split(',');
    } else {
        tagsArray = details.tags;
    }

    console.log(chalk.cyan('\nTags:'), tagsArray.length > 0 ? tagsArray.join(', ') : 'No tags');
    console.log(chalk.cyan('\nOptions:'), '([*] Required  [ ] Optional)');
    const maxNameLength = Math.max(...details.variables.map((v) => formatSnakeCase(v.name).length));

    try {
        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];

        for (const variable of details.variables) {
            const paddedName = formatSnakeCase(variable.name).padEnd(maxNameLength);
            const requiredFlag = variable.optional_for_user ? '[ ]' : '[*]';
            const matchingEnvVar = envVars.find((v) => v.name === variable.name);
            let status;

            if (variable.value) {
                const trimmedValue = variable.value.trim();

                if (trimmedValue.startsWith(FRAGMENT_PREFIX)) {
                    status = chalk.blue(trimmedValue);
                } else if (trimmedValue.startsWith(ENV_PREFIX)) {
                    const envVarName = trimmedValue.split(ENV_PREFIX)[1];
                    const envVar = envVars.find((v: { name: string }) => v.name === envVarName);
                    const envValue = envVar ? envVar.value.trim() : 'Not found';
                    status = chalk.magenta(
                        `${ENV_PREFIX}${formatSnakeCase(envVarName)} (${envValue.substring(0, 30)}${envValue.length > 30 ? '...' : ''})`
                    );
                } else {
                    status = chalk.green(
                        `Set: ${trimmedValue.substring(0, 30)}${trimmedValue.length > 30 ? '...' : ''}`
                    );
                }
            } else {
                status = variable.optional_for_user ? chalk.yellow('Not Set') : chalk.red('Not Set (Required)');
            }

            const hint =
                !isExecute &&
                matchingEnvVar &&
                (!variable.value || (variable.value && !variable.value.startsWith(ENV_PREFIX)))
                    ? chalk.magenta('(Env variable available)')
                    : '';
            console.log(`  ${chalk.green(`--${paddedName}`)} ${requiredFlag} ${hint}`);
            console.log(`    ${variable.role}`);

            if (!isExecute) {
                console.log(`      ${status}`);
            }
        }
    } catch (error) {
        handleError(error, 'viewing prompt details');
    }
}
