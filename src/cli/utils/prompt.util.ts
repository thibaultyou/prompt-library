import chalk from 'chalk';

import { allAsync, getAsync, runAsync } from './database.util';
import { readEnvVars } from './env.util';
import { handleError } from './error.util';
import { getPromptMetadata } from './metadata.util';
import { ApiResult, Metadata, Prompt, Variable } from '../../shared/types';
import { processPromptContent } from '../../shared/utils/prompt_operations';
import { formatSnakeCase, formatTitleCase } from '../../shared/utils/string_formatter';

export async function createPrompt(metadata: Metadata, content: string): Promise<ApiResult<void>> {
    try {
        const result = await runAsync(
            'INSERT INTO prompts (title, content, primary_category, directory, one_line_description, description, content_hash, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                metadata.title,
                content,
                metadata.primary_category,
                metadata.directory,
                metadata.one_line_description,
                metadata.description,
                metadata.content_hash,
                metadata.tags.join(',')
            ]
        );
        const promptId = result.data?.lastID;

        if (!promptId) {
            return { success: false, error: 'Failed to insert prompt' };
        }

        for (const subcategory of metadata.subcategories) {
            await runAsync('INSERT INTO subcategories (prompt_id, name) VALUES (?, ?)', [promptId, subcategory]);
        }

        for (const variable of metadata.variables) {
            await runAsync('INSERT INTO variables (prompt_id, name, role, optional_for_user) VALUES (?, ?, ?, ?)', [
                promptId,
                variable.name,
                variable.role,
                variable.optional_for_user
            ]);
        }

        for (const fragment of metadata.fragments || []) {
            await runAsync('INSERT INTO fragments (prompt_id, category, name, variable) VALUES (?, ?, ?, ?)', [
                promptId,
                fragment.category,
                fragment.name,
                fragment.variable
            ]);
        }
        return { success: true };
    } catch (error) {
        handleError(error, 'creating prompt');
        return { success: false, error: 'Failed to create prompt' };
    }
}

export async function executePrompt(
    promptId: string,
    userInputs: Record<string, string>,
    useStreaming: boolean
): Promise<ApiResult<string>> {
    try {
        const promptFilesResult = await getPromptFiles(promptId);

        if (!promptFilesResult.success || !promptFilesResult.data) {
            return { success: false, error: promptFilesResult.error || 'Failed to get prompt files' };
        }

        const { promptContent } = promptFilesResult.data;
        const result = await processPromptContent([{ role: 'user', content: promptContent }], userInputs, useStreaming);
        return { success: true, data: result };
    } catch (error) {
        handleError(error, 'executing prompt');
        return { success: false, error: 'Failed to execute prompt' };
    }
}

export async function listPrompts(): Promise<ApiResult<Prompt[]>> {
    try {
        const prompts = await allAsync<Prompt>('SELECT id, title, primary_category FROM prompts');
        return { success: true, data: prompts.data ?? [] };
    } catch (error) {
        handleError(error, 'listing prompts');
        return { success: false, error: 'Failed to list prompts' };
    }
}

export async function getPromptFiles(
    promptId: string
): Promise<ApiResult<{ promptContent: string; metadata: Metadata }>> {
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

export async function viewPromptDetails(details: Prompt & { variables: Variable[] }, isExecute = false): Promise<void> {
    // console.clear();
    console.log(chalk.cyan('Prompt:'), details.title);
    console.log(`\n${details.description || ''}`);
    console.log(chalk.cyan('\nCategory:'), formatTitleCase(details.primary_category));

    let tags: string[] = [];

    if (typeof details.tags === 'string') {
        tags = details.tags.split(',').map((tag) => tag.trim());
    } else if (Array.isArray(details.tags)) {
        tags = details.tags;
    }

    console.log(chalk.cyan('\nTags:'), tags.length > 0 ? tags.join(', ') : 'No tags');
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
                if (variable.value.startsWith('Fragment: ')) {
                    status = chalk.blue(variable.value);
                } else if (variable.value.startsWith('Env: ')) {
                    const envVarName = variable.value.split('Env: ')[1];
                    const envVar = envVars.find((v: { name: string }) => v.name === envVarName);
                    const envValue = envVar ? envVar.value : 'Not found';
                    status = chalk.magenta(
                        `Env: ${formatSnakeCase(envVarName)} (${envValue.substring(0, 30)}${envValue.length > 30 ? '...' : ''})`
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
                (!variable.value || (variable.value && !variable.value.startsWith('Env: ')))
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
