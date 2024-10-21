import { getAsync, allAsync } from './database.util';
import { handleError } from './error.util';
import { ApiResult, Fragment, Metadata } from '../../shared/types';

export async function getPromptMetadata(promptId: string): Promise<ApiResult<Metadata>> {
    try {
        const promptResult = await getAsync<{
            id: number;
            title: string;
            primary_category: string;
            directory: string;
            one_line_description: string;
            description: string;
            content_hash: string;
            tags: string;
        }>('SELECT * FROM prompts WHERE id = ?', [promptId]);

        if (!promptResult.success || !promptResult.data) {
            return { success: false, error: 'Prompt not found' };
        }

        const prompt = promptResult.data;
        const subcategoriesResult = await allAsync<{ name: string }>(
            'SELECT name FROM subcategories WHERE prompt_id = ?',
            [promptId]
        );
        const variablesResult = await allAsync<{ name: string; role: string; optional_for_user: boolean }>(
            'SELECT name, role, optional_for_user FROM variables WHERE prompt_id = ?',
            [promptId]
        );
        const fragmentsResult = await allAsync<Fragment>(
            'SELECT category, name, variable FROM fragments WHERE prompt_id = ?',
            [promptId]
        );
        const metadata: Metadata = {
            title: prompt.title,
            primary_category: prompt.primary_category,
            subcategories: subcategoriesResult.success ? (subcategoriesResult.data?.map((s) => s.name) ?? []) : [],
            directory: prompt.directory,
            tags: prompt.tags ? prompt.tags.split(',') : [],
            one_line_description: prompt.one_line_description,
            description: prompt.description,
            variables: variablesResult.success ? (variablesResult.data ?? []) : [],
            content_hash: prompt.content_hash,
            fragments: fragmentsResult.success ? (fragmentsResult.data ?? []) : []
        };
        return { success: true, data: metadata };
    } catch (error) {
        handleError(error, 'getting prompt metadata');
        return { success: false, error: 'Failed to get prompt metadata' };
    }
}
