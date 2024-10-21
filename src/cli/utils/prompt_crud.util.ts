import { allAsync, getAsync, runAsync } from './database.util';
import { handleError } from './error.util';
import { getPromptMetadata } from './metadata.util';
import { ApiResult, Metadata, Prompt } from '../../shared/types';

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
