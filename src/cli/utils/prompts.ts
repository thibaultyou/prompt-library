import chalk from 'chalk';

import { allAsync, getAsync, runAsync } from './database';
import { handleError } from './errors';
import { ApiResult, Fragment, PromptMetadata, Variable } from '../../shared/types';
import { formatSnakeCase, formatTitleCase } from '../../shared/utils/string-formatter';
import { FRAGMENT_PREFIX, ENV_PREFIX } from '../constants';
import { readEnvVars } from './env-vars';

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
    promptId: string
): Promise<ApiResult<{ promptContent: string; metadata: PromptMetadata }>> {
    try {
        const promptContentResult = await getAsync<{ content: string }>('SELECT content FROM prompts WHERE id = ?', [
            promptId
        ]);

        if (!promptContentResult.success || !promptContentResult.data) {
            return { success: false, error: 'Prompt not found' };
        }

        const metadataResult = await getPromptMetadata(promptId);

        if (!metadataResult.success || !metadataResult.data) {
            return { success: false, error: 'Failed to get prompt metadata' };
        }
        return {
            success: true,
            data: {
                promptContent: promptContentResult.data.content,
                metadata: metadataResult.data
            }
        };
    } catch (error) {
        handleError(error, 'getting prompt files');
        return { success: false, error: 'Failed to get prompt files' };
    }
}

export async function getPromptMetadata(promptId: string): Promise<ApiResult<PromptMetadata>> {
    try {
        const promptResult = await getAsync<PromptMetadata>('SELECT * FROM prompts WHERE id = ?', [promptId]);

        if (!promptResult.success || !promptResult.data) {
            return { success: false, error: 'Metadata not found' };
        }

        const subcategoriesResult = await allAsync<{ name: string }>(
            'SELECT name FROM subcategories WHERE prompt_id = ?',
            [promptId]
        );

        if (!subcategoriesResult.success || !subcategoriesResult.data) {
            return { success: false, error: 'Failed to get subcategories' };
        }

        const variablesResult = await allAsync<Variable>(
            'SELECT name, role, optional_for_user, value FROM variables WHERE prompt_id = ?',
            [promptId]
        );

        if (!variablesResult.success || !variablesResult.data) {
            return { success: false, error: 'Failed to get variables' };
        }

        const fragmentsResult = await allAsync<Fragment>(
            'SELECT category, name, variable FROM fragments WHERE prompt_id = ?',
            [promptId]
        );

        if (!fragmentsResult.success || !fragmentsResult.data) {
            return { success: false, error: 'Failed to get fragments' };
        }

        const promptMetadata: PromptMetadata = {
            id: promptResult.data.id,
            title: promptResult.data.title,
            primary_category: promptResult.data.primary_category,
            subcategories: subcategoriesResult.data.map((s) => s.name),
            directory: promptResult.data.directory,
            tags: promptResult.data.tags,
            one_line_description: promptResult.data.one_line_description,
            description: promptResult.data.description,
            variables: variablesResult.data,
            content_hash: promptResult.data.content_hash,
            fragments: fragmentsResult.data
        };
        return { success: true, data: promptMetadata };
    } catch (error) {
        handleError(error, 'getting prompt metadata');
        return { success: false, error: 'Failed to get prompt metadata' };
    }
}

export async function viewPromptDetails(
    details: PromptMetadata & { variables: Variable[] },
    isExecute = false
): Promise<void> {
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
                if (variable.value.startsWith(FRAGMENT_PREFIX)) {
                    status = chalk.blue(variable.value);
                } else if (variable.value.startsWith(ENV_PREFIX)) {
                    const envVarName = variable.value.split(ENV_PREFIX)[1];
                    const envVar = envVars.find((v: { name: string }) => v.name === envVarName);
                    const envValue = envVar ? envVar.value : 'Not found';
                    status = chalk.magenta(
                        `${ENV_PREFIX}${formatSnakeCase(envVarName)} (${envValue.substring(0, 30)}${envValue.length > 30 ? '...' : ''})`
                    );
                } else {
                    status = chalk.green(
                        `Set: ${variable.value.substring(0, 30)}${variable.value.length > 30 ? '...' : ''}`
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

        if (!isExecute) {
            console.log();
        }
    } catch (error) {
        handleError(error, 'viewing prompt details');
    }
}
