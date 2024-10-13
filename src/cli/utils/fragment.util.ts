import path from 'path';

import { ApiResult, Fragment } from '../../shared/types';
import { readDirectory, readFileContent } from '../../shared/utils/file_operations';
import { cliConfig } from '../config/cli.config';

export async function listFragments(): Promise<ApiResult<Fragment[]>> {
    try {
        const fragments: Fragment[] = [];
        const categories = await readDirectory(cliConfig.FRAGMENTS_DIR);

        for (const category of categories) {
            const categoryPath = path.join(cliConfig.FRAGMENTS_DIR, category);
            const files = await readDirectory(categoryPath);

            for (const file of files) {
                if (file.endsWith('.md')) {
                    fragments.push({
                        category,
                        name: file.replace('.md', ''),
                        variable: '' // Note: We don't have this information from the file system
                    });
                }
            }
        }
        return { success: true, data: fragments };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred while listing fragments'
        };
    }
}

export async function viewFragmentContent(category: string, name: string): Promise<ApiResult<string>> {
    try {
        const filePath = path.join(cliConfig.FRAGMENTS_DIR, category, `${name}.md`);
        const content = await readFileContent(filePath);
        return { success: true, data: content };
    } catch (error) {
        console.error('Error in viewFragmentContent:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred while reading fragment content'
        };
    }
}
