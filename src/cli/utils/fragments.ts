import path from 'path';

import { select } from '@inquirer/prompts';

import { handleError } from './errors';
import { ApiResult, PromptFragment } from '../../shared/types';
import { readDirectory, readFileContent } from '../../shared/utils/file-system';
import { cliConfig } from '../config/cli-config';

export async function listFragments(): Promise<ApiResult<PromptFragment[]>> {
    try {
        const fragments: PromptFragment[] = [];
        const categories = await readDirectory(cliConfig.FRAGMENTS_DIR);

        for (const category of categories) {
            const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, category);
            const files = await readDirectory(categoryPath);

            for (const file of files) {
                if (file.endsWith('.md')) {
                    fragments.push({
                        category,
                        name: file.replace('.md', ''),
                        variable: ''
                    });
                }
            }
        }
        return { success: true, data: fragments };
    } catch (error) {
        handleError(error, 'listing fragments');
        return { success: false, error: 'Failed to list fragments' };
    }
}

export async function viewFragmentContent(category: string, name: string): Promise<ApiResult<string>> {
    try {
        const filePath = path.join(cliConfig.FRAGMENTS_DIR, category, `${name}.md`);
        const content = await readFileContent(filePath);
        return { success: true, data: content };
    } catch (error) {
        handleError(error, 'viewing fragment content');
        return { success: false, error: 'Failed to view fragment content' };
    }
}

export async function selectFragmentForEditing(): Promise<PromptFragment | null> {
    try {
        const fragmentsResult = await listFragments();

        if (!fragmentsResult.success || !fragmentsResult.data || fragmentsResult.data.length === 0) {
            return null;
        }

        const fragments = fragmentsResult.data;
        const fragmentsByCategory: Record<string, PromptFragment[]> = {};
        fragments.forEach((fragment) => {
            if (!fragmentsByCategory[fragment.category]) {
                fragmentsByCategory[fragment.category] = [];
            }

            fragmentsByCategory[fragment.category].push(fragment);
        });

        const sortedCategories = Object.keys(fragmentsByCategory).sort();
        const choices: Array<{ name: string; value: PromptFragment | string; disabled?: boolean }> = [];

        for (const category of sortedCategories) {
            choices.push({
                name: `📁 ${category.toUpperCase()}`,
                value: category,
                disabled: true
            });

            const categoryFragments = fragmentsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
            categoryFragments.forEach((fragment) => {
                choices.push({
                    name: `  ├─ ${fragment.name}`,
                    value: fragment
                });
            });
        }

        const selectedFragment = await select({
            message: 'Select a fragment to edit:',
            choices
        });
        return selectedFragment as PromptFragment;
    } catch (error) {
        handleError(error, 'selecting fragment for editing');
        return null;
    }
}
