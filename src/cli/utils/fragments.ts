import path from 'path';

import { select } from '@inquirer/prompts';
import chalk from 'chalk';

import { handleError } from './errors';
import { ApiResult, PromptFragment } from '../../shared/types';
import { readDirectory, readFileContent } from '../../shared/utils/file-system';
import { cliConfig } from '../config/cli-config';
import { printSectionHeader } from './ui-components';

export async function listFragments(forceRefresh = false): Promise<ApiResult<PromptFragment[]>> {
    // This function always reads from disk, so forceRefresh is currently just a placeholder
    // for potential future caching implementations
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

export function formatFragmentsTable(fragments: PromptFragment[]): {
    headers: string;
    rows: string[];
    separator: string;
    fragmentsMap: PromptFragment[];
} {
    // Sort fragments by category and name for consistent display
    const sortedFragments = [...fragments].sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
    });
    
    // Calculate max lengths for columns
    const maxCategoryLength = Math.max(...sortedFragments.map(f => f.category.length), 8);
    const maxNameLength = Math.max(...sortedFragments.map(f => f.name.length), 15);
    const tableWidth = maxCategoryLength + maxNameLength + 10; // Additional padding
    
    // Create headers
    const headers = `${chalk.bold('Category'.padEnd(maxCategoryLength + 2))}${chalk.bold('Name')}`;
    
    // Create a separator
    const separator = '─'.repeat(tableWidth);
    
    // Create rows and fragments map
    const rows: string[] = [];
    const fragmentsMap: PromptFragment[] = [];
    
    sortedFragments.forEach(fragment => {
        rows.push(
            `${chalk.green(fragment.category.padEnd(maxCategoryLength + 2))}${chalk.cyan(fragment.name)}`
        );
        fragmentsMap.push(fragment);
    });
    
    return {
        headers,
        rows,
        separator,
        fragmentsMap
    };
}

export async function selectFragmentWithTable(title: string, emoji: string): Promise<PromptFragment | null> {
    try {
        console.clear();
        printSectionHeader(title, emoji);
        
        const fragmentsResult = await listFragments();

        if (!fragmentsResult.success || !fragmentsResult.data || fragmentsResult.data.length === 0) {
            console.log(chalk.yellow('\nNo fragments found.\n'));
            return null;
        }

        const fragments = fragmentsResult.data;
        
        // Format table data
        const tableResult = formatFragmentsTable(fragments);
        
        // Create menu choices that look like a table
        const tableChoices: Array<{ name: string; value: PromptFragment | null; description?: string; disabled?: boolean }> = [];
        
        // Add a header row
        tableChoices.push({
            name: tableResult.headers,
            value: null,
            disabled: true
        });
        
        // Add a separator
        tableChoices.push({
            name: tableResult.separator,
            value: null,
            disabled: true
        });
        
        // Add each row as a selectable item
        tableResult.rows.forEach((row, index) => {
            if (row.trim() !== '') { // Ensure it's not just an empty row
                tableChoices.push({
                    name: row,
                    value: tableResult.fragmentsMap[index]
                });
            }
        });
        
        // Add a separator at the bottom
        tableChoices.push({
            name: tableResult.separator,
            value: null,
            disabled: true
        });
        
        // Add info
        tableChoices.push({
            name: chalk.italic(`Found ${fragments.length} fragments.`),
            value: null,
            disabled: true
        });
        
        // Add a back option
        tableChoices.push({
            name: chalk.red(chalk.bold('Go back')),
            value: null,
            description: 'Return to the previous menu'
        });

        const selectedFragment = await select({
            message: 'Use ↑↓ to select a fragment:',
            choices: tableChoices,
            pageSize: 15
        });
        
        return selectedFragment;
    } catch (error) {
        handleError(error, 'selecting fragment');
        return null;
    }
}

export async function selectFragmentForEditing(): Promise<PromptFragment | null> {
    return selectFragmentWithTable("Edit Fragment", '♻️');
}

export async function selectFragmentForDeletion(): Promise<PromptFragment | null> {
    return selectFragmentWithTable("Delete Fragment", '🔥');
}
