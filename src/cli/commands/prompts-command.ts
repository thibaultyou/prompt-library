import chalk from 'chalk';

import { BaseCommand } from './base-command';
import executeCommand from './execute-command';
import { createCommand, editCommand, deleteCommand } from './prompt-commands';
import { CategoryItem, EnvVariable, PromptFragment, PromptMetadata, PromptVariable } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string-formatter';
import { ConversationManager } from '../utils/conversation-manager';
import {
    addPromptToFavorites,
    cache,
    getFavoritePrompts,
    getPromptById,
    getPromptDetails,
    getRecentExecutions,
    isPromptInFavorites,
    recordPromptExecution,
    removePromptFromFavorites
} from '../utils/database';
import { readEnvVars } from '../utils/env-vars';
import { listFragments } from '../utils/fragments';
import {
    getPromptCategories,
    getAllPrompts,
    getPromptsSortedById,
    searchPrompts,
    formatPromptsForDisplay,
    formatCategoriesForDisplay,
    formatVariableChoices,
    allRequiredVariablesSet,
    setVariableValue,
    assignFragmentToVariable,
    assignEnvironmentVariable,
    getMatchingEnvironmentVariables,
    unsetAllVariables
} from '../utils/prompt-utils';
import { viewPromptDetails } from '../utils/prompts';
import {
    createSectionHeader,
    formatMenuItem,
    getInput,
    printSectionHeader,
    showProgress,
    successMessage,
    warningMessage
} from '../utils/ui-components';

type PromptMenuAction =
    | 'all'
    | 'category'
    | 'id'
    | 'search'
    | 'recent'
    | 'favorites'
    | 'create'
    | 'edit'
    | 'delete'
    | 'back'
    | 'separator';
type SelectPromptMenuAction = PromptVariable | 'execute' | 'unset_all' | 'add_to_favorites' | 'back' | 'separator';

class PromptCommand extends BaseCommand {
    constructor() {
        super('prompts', 'List all prompts and view details');
        this.option('--list', 'List all prompts with their IDs and categories')
            .option('--categories', 'List all prompt categories')
            .option('--search <keyword>', 'Search prompts by keyword (title, description, category)')
            .option('--json', 'Output in JSON format (for CI use)')
            .option('--favorites', 'Show favorite prompts')
            .option('--recent', 'Show recently executed prompts')
            .addCommand(createCommand)
            .addCommand(editCommand)
            .addCommand(deleteCommand)
            .addHelpText('before', chalk.bold(chalk.cyan('\n📚 Prompt Library - Prompts Management\n')))
            .addHelpText(
                'after',
                `
Examples:
  $ prompt-library-cli prompts --list          List all prompts with IDs
  $ prompt-library-cli prompts --search git    Search for git-related prompts
  $ prompt-library-cli prompts --categories    Show prompt categories
  $ prompt-library-cli prompts --favorites     Show favorite prompts
  $ prompt-library-cli prompts --recent        Show recently used prompts
  $ prompt-library-cli prompts create          Create a new prompt
  $ prompt-library-cli prompts edit 42         Edit prompt with ID 42
  $ prompt-library-cli prompts delete 42       Delete prompt with ID 42

Related Commands:
  execute    Run a specific prompt
  fragments  Manage prompt fragments used in prompts
            `
            )
            .action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        try {
            const hasList = process.argv.includes('--list');
            const hasCategories = process.argv.includes('--categories');
            const hasRecent = process.argv.includes('--recent');
            const hasFavorites = process.argv.includes('--favorites');
            const hasJson = process.argv.includes('--json');
            const searchIndex = process.argv.indexOf('--search');
            let searchTerm = null;

            if (searchIndex !== -1 && searchIndex < process.argv.length - 1) {
                searchTerm = process.argv[searchIndex + 1];
            }

            const categoriesPromise = getPromptCategories();
            const categories = await showProgress('Loading prompts...', categoriesPromise);

            if (hasRecent) {
                await this.showRecentPrompts(hasJson);
                return;
            }

            if (hasFavorites) {
                await this.showFavoritePrompts(hasJson);
                return;
            }

            if (searchTerm) {
                await this.searchPrompts(categories, searchTerm, hasJson);
                return;
            }

            if (hasList) {
                await this.listAllPromptsForCI(categories, hasJson);
                return;
            }

            if (hasCategories) {
                await this.listAllCategoriesForCI(categories, hasJson);
                return;
            }

            await this.showPromptMenu(categories);
        } catch (error) {
            this.handleError(error, 'prompt command');
        }
    }

    private async showRecentPrompts(json: boolean = false): Promise<void> {
        try {
            const recentPrompts = await getRecentExecutions(10);

            if (json) {
                console.log(JSON.stringify(recentPrompts, null, 2));
                return;
            }

            if (!recentPrompts || recentPrompts.length === 0) {
                console.log(chalk.yellow('\nNo recent prompt executions found.\n'));
                console.log(chalk.italic('Try executing some prompts first.'));
                await this.pressKeyToContinue();
                return;
            }

            let stayInRecentPrompts = true;
            while (stayInRecentPrompts) {
                console.clear();
                printSectionHeader('Recent Prompt Executions', '⏱️');

                // Convert to CategoryItem format
                const recentItems = recentPrompts.map((item: any) => ({
                    id: item.prompt_id.toString(),
                    title: item.title || 'Unknown',
                    category: item.primary_category || 'Unknown',
                    primary_category: item.primary_category || 'Unknown',
                    path: item.directory || '',
                    description: item.description || '',
                    subcategories: []
                }));
                // Format table data 
                const tableResult = formatPromptsForDisplay(recentItems, {
                    showDirectory: false,
                    tableWidth: 80
                });
                
                // Create menu choices that look like a table
                const tableChoices: Array<{ name: string; value: CategoryItem | 'back'; disabled?: boolean }> = [];
                
                // Add a header row
                tableChoices.push({
                    name: tableResult.headers,
                    value: 'back',
                    disabled: true
                });
                
                // Add a separator
                tableChoices.push({
                    name: tableResult.separator,
                    value: 'back',
                    disabled: true
                });
                
                // Add each row as a selectable item
                tableResult.rows.forEach((row, index) => {
                    tableChoices.push({
                        name: row,
                        value: tableResult.promptsRowMap[index]
                    });
                });
                
                // Add a separator at the bottom
                tableChoices.push({
                    name: tableResult.separator,
                    value: 'back',
                    disabled: true
                });
                
                // Add info
                tableChoices.push({
                    name: chalk.italic(`Found ${recentPrompts.length} recently executed prompts.`),
                    value: 'back',
                    disabled: true
                });
                
                // Add a back option
                tableChoices.push({
                    name: formatMenuItem('Go back', 'back', 'danger').name,
                    value: 'back'
                });

                // Select directly from the table
                const selection = await this.showMenu<CategoryItem | 'back'>(
                    'Use ↑↓ to select a recent prompt:',
                    tableChoices,
                    {
                        clearConsole: false,
                        includeGoBack: false
                    }
                );
                
                if (selection === 'back') {
                    stayInRecentPrompts = false;
                    continue;
                } else if (typeof selection !== 'string') {
                    // A prompt was selected, manage it directly
                    await this.managePrompt(selection);
                    continue;
                }
            }
        } catch (error) {
            this.handleError(error, 'showing recent prompts');
            await this.pressKeyToContinue();
        }
    }

    async showFavoritePrompts(json: boolean = false): Promise<void> {
        try {
            const result = await getFavoritePrompts();

            if (json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }

            if (!result.success || !result.data || result.data.length === 0) {
                console.log(chalk.yellow('\nNo favorite prompts found.\n'));
                console.log(chalk.italic('Add prompts to your favorites first.'));
                await this.pressKeyToContinue();
                return;
            }

            const favorites = result.data;
            let stayInFavorites = true;
            while (stayInFavorites) {
                console.clear();
                printSectionHeader('Favorite Prompts', '⭐');

                // Convert to CategoryItem format
                const favoriteItems = favorites.map((item: any) => ({
                    id: item.prompt_id.toString(),
                    title: item.title || 'Unknown',
                    category: item.primary_category || 'Unknown',
                    primary_category: item.primary_category || 'Unknown',
                    path: item.directory || '',
                    description: item.description || '',
                    subcategories: []
                }));
                // Format table data 
                const tableResult = formatPromptsForDisplay(favoriteItems, {
                    showDirectory: false,
                    tableWidth: 80
                });
                
                // Create menu choices that look like a table
                const tableChoices: Array<{ name: string; value: CategoryItem | 'execute' | 'remove' | 'back'; disabled?: boolean }> = [];
                
                // Add a header row
                tableChoices.push({
                    name: tableResult.headers,
                    value: 'back',
                    disabled: true
                });
                
                // Add a separator
                tableChoices.push({
                    name: tableResult.separator,
                    value: 'back',
                    disabled: true
                });
                
                // Add each row as a selectable item
                tableResult.rows.forEach((row, index) => {
                    tableChoices.push({
                        name: row,
                        value: tableResult.promptsRowMap[index]
                    });
                });
                
                // Add a separator at the bottom
                tableChoices.push({
                    name: tableResult.separator,
                    value: 'back',
                    disabled: true
                });
                
                // Add action options
                tableChoices.push({
                    name: formatMenuItem('Remove selected from favorites', 'remove', 'danger').name,
                    value: 'remove'
                });
                
                // Add info
                tableChoices.push({
                    name: chalk.italic(`Found ${favorites.length} favorite prompts.`),
                    value: 'back',
                    disabled: true
                });
                
                // Add a back option
                tableChoices.push({
                    name: formatMenuItem('Go back', 'back', 'danger').name,
                    value: 'back'
                });

                // Select directly from the table
                const selection = await this.showMenu<CategoryItem | 'execute' | 'remove' | 'back'>(
                    'Use ↑↓ to select a favorite:',
                    tableChoices,
                    {
                        clearConsole: false,
                        includeGoBack: false
                    }
                );

                if (selection === 'back') {
                    stayInFavorites = false;
                    continue;
                } else if (selection === 'remove') {
                    // Show remove from favorites selection menu
                    const choices = tableResult.promptsRowMap.map((prompt) => ({
                        name: `${prompt.title} (ID: ${prompt.id})`,
                        value: prompt.id
                    }));
                    const promptId = await this.showMenu<string | 'back'>(
                        'Select a prompt to remove from favorites:',
                        choices,
                        { clearConsole: false }
                    );

                    if (promptId && promptId !== 'back') {
                        const result = await removePromptFromFavorites(promptId);

                        if (result.success) {
                            console.log(successMessage('Prompt removed from favorites!'));

                            const refreshResult = await getFavoritePrompts();

                            if (refreshResult.success && refreshResult.data) {
                                favorites.length = 0;
                                favorites.push(...refreshResult.data);
                            }

                            await new Promise((resolve) => setTimeout(resolve, 1000));
                        }
                    }
                    continue;
                } else if (typeof selection !== 'string') {
                    // A prompt was selected, manage it directly
                    await this.managePrompt(selection);
                    continue;
                }
            }
        } catch (error) {
            this.handleError(error, 'showing favorite prompts');
            await this.pressKeyToContinue();
        }
    }

    private async selectPromptFromList(prompts: CategoryItem[], message: string): Promise<string | null> {
        try {
            const choices = prompts.map((prompt) => ({
                name: `${prompt.id} - ${prompt.title} (${prompt.primary_category})`,
                value: prompt.id
            }));
            const promptId = await this.showMenu<string | 'back'>(message, choices, {
                clearConsole: false
            });

            if (promptId === 'back') {
                return null;
            }
            return promptId;
        } catch (error) {
            this.handleError(error, 'selecting prompt from list');
            return null;
        }
    }

    async searchPrompts(categories: Record<string, CategoryItem[]>, keyword: string, json: boolean): Promise<void> {
        try {
            const matchingPrompts = searchPrompts(categories, keyword);

            if (json) {
                console.log(JSON.stringify(matchingPrompts, null, 2));
                return;
            }

            if (matchingPrompts.length === 0) {
                console.log(warningMessage(`No prompts found matching "${keyword}"\n`));
                console.log(chalk.italic('Try searching with a different keyword or use:'));
                console.log(chalk.italic('  prompt-library-cli prompts --list\n'));
                return;
            }

            let stayInSearchResults = true;
            while (stayInSearchResults) {
                console.clear();

                printSectionHeader(`Search Results for "${keyword}"`, '🔍');

                const tableResult = formatPromptsForDisplay(matchingPrompts, {
                    showDirectory: true,
                    tableWidth: 80
                });
                
                // Create menu choices that look like a table
                const tableChoices: Array<{ name: string; value: CategoryItem | 'execute' | 'favorites' | 'back'; disabled?: boolean }> = [];
                
                // Add a header row
                tableChoices.push({
                    name: tableResult.headers,
                    value: 'back',
                    disabled: true
                });
                
                // Add a separator
                tableChoices.push({
                    name: tableResult.separator,
                    value: 'back',
                    disabled: true
                });
                
                // Add each row as a selectable item
                tableResult.rows.forEach((row, index) => {
                    tableChoices.push({
                        name: row,
                        value: tableResult.promptsRowMap[index]
                    });
                });
                
                // Add a separator at the bottom
                tableChoices.push({
                    name: tableResult.separator,
                    value: 'back',
                    disabled: true
                });
                
                // Add info
                tableChoices.push({
                    name: chalk.italic(`Found ${matchingPrompts.length} matching prompts.`),
                    value: 'back',
                    disabled: true
                });
                
                // Add a back option
                tableChoices.push({
                    name: formatMenuItem('Go back', 'back', 'danger').name,
                    value: 'back'
                });

                // Select directly from the table
                const selection = await this.showMenu<CategoryItem | 'execute' | 'favorites' | 'back'>(
                    'Use ↑↓ to select a result or action:',
                    tableChoices,
                    {
                        clearConsole: false,
                        includeGoBack: false
                    }
                );
                
                if (selection === 'back') {
                    stayInSearchResults = false;
                    continue;
                } else if (typeof selection !== 'string') {
                    // A prompt was selected, manage it
                    await this.managePrompt(selection);
                    continue;
                }
                
                // If we get here, something went wrong
                stayInSearchResults = false;
            }
        } catch (error) {
            this.handleError(error, 'searching prompts');
        }
    }

    private async selectPromptToAddToFavorites(matchingPrompts: CategoryItem[]): Promise<string | null> {
        try {
            const choices = matchingPrompts.map((prompt) => ({
                name: `${prompt.id} - ${prompt.title} (${prompt.primary_category})`,
                value: prompt.id
            }));
            const promptId = await this.showMenu<string | 'back'>('Select a prompt to add to favorites:', choices, {
                clearConsole: false
            });

            if (promptId === 'back') {
                return null;
            }
            return promptId;
        } catch (error) {
            this.handleError(error, 'adding to favorites');
            return null;
        }
    }

    private async selectPromptToExecute(matchingPrompts: CategoryItem[]): Promise<string | null> {
        try {
            const choices = matchingPrompts.map((prompt) => ({
                name: `${prompt.id} - ${prompt.title} (${prompt.primary_category})`,
                value: prompt.id
            }));
            const promptId = await this.showMenu<string | 'back'>('Select a prompt to execute:', choices, {
                clearConsole: false
            });

            if (promptId === 'back') {
                return null;
            }
            return promptId;
        } catch (error) {
            this.handleError(error, 'selecting prompt to execute');
            return null;
        }
    }

    private async showPromptMenu(categories: Record<string, CategoryItem[]>): Promise<void> {
        while (true) {
            try {
                console.clear();
                printSectionHeader('Prompts Library', '📚');

                const choices = [];
                choices.push(createSectionHeader<PromptMenuAction>('BROWSE & EXECUTE', '🔍', 'info'));
                choices.push(formatMenuItem('By category', 'category', 'primary'));
                choices.push(formatMenuItem('All prompts', 'all', 'primary'));
                choices.push(formatMenuItem('By ID', 'id', 'primary'));
                choices.push(formatMenuItem('Search prompts', 'search', 'primary'));
                choices.push(formatMenuItem('Recent prompts', 'recent', 'primary'));
                choices.push(formatMenuItem('Favorite prompts', 'favorites', 'primary'));

                choices.push({
                    name: '─'.repeat(50),
                    value: 'separator',
                    disabled: ' '
                });

                choices.push(createSectionHeader<PromptMenuAction>('MANAGE', '🔧', 'info'));
                choices.push(formatMenuItem('Create new prompt', 'create', 'success'));
                choices.push(formatMenuItem('Edit prompt', 'edit', 'warning'));
                choices.push(formatMenuItem('Delete prompt', 'delete', 'danger'));

                choices.push({
                    name: '─'.repeat(50),
                    value: 'separator',
                    disabled: ' '
                });

                const action = await this.showMenu<PromptMenuAction>(
                    'Use ↑↓ to select an action:',
                    choices as Array<{
                        name: string;
                        value: PromptMenuAction;
                        disabled?: boolean | string;
                    }>,
                    {
                        clearConsole: false,
                    }
                );
                switch (action) {
                    case 'all':
                        await this.listAllPrompts(categories);
                        break;
                    case 'category':
                        await this.listPromptsByCategory(categories);
                        break;
                    case 'id':
                        await this.listPromptsSortedById(categories);
                        break;
                    case 'search': {
                        console.clear();
                        printSectionHeader('Search Prompts', '🔍');
                        const keyword = await getInput('Enter search keyword:', undefined, true);


                        if (keyword && keyword.trim()) {
                            await this.searchPrompts(categories, keyword.trim(), false);
                        }

                        break;
                    }
                    case 'recent':
                        await this.showRecentPrompts(false);
                        break;
                    case 'favorites':
                        await this.showFavoritePrompts(false);
                        break;
                    case 'create':
                        await createCommand.parseAsync([]);
                        break;
                    case 'edit':
                        await editCommand.parseAsync([]);
                        break;
                    case 'delete':
                        await deleteCommand.parseAsync([]);
                        break;
                    case 'back':
                        return;
                }
            } catch (error) {
                this.handleError(error, 'prompt menu');
                await this.pressKeyToContinue();
            }
        }
    }

    private async listAllPromptsForCI(categories: Record<string, CategoryItem[]>, json: boolean): Promise<void> {
        const allPrompts = getAllPrompts(categories);

        if (json) {
            console.log(JSON.stringify(allPrompts, null, 2));
        } else {
            console.log(chalk.bold('\n🔍 Available Prompts:'));
            console.log('─'.repeat(80));

            const tableResult = formatPromptsForDisplay(allPrompts);
            console.log(tableResult.headers);
            console.log('─'.repeat(80));

            const promptsByCategory: Record<string, Array<CategoryItem & { category: string }>> = {};
            allPrompts.forEach((prompt) => {
                if (!promptsByCategory[prompt.category]) {
                    promptsByCategory[prompt.category] = [];
                }

                promptsByCategory[prompt.category].push(prompt);
            });
            const sortedCategories = Object.keys(promptsByCategory).sort();
            sortedCategories.forEach((category) => {
                const prompts = promptsByCategory[category].sort((a, b) => a.title.localeCompare(b.title));
                prompts.forEach((prompt) => {
                    const directory = prompt.path.split('/').pop() || '';
                    console.log(
                        `${chalk.green(prompt.id.toString().padEnd(tableResult.maxLengths.id + 2))}` +
                            `${chalk.yellow(directory.padEnd(tableResult.maxLengths.dir + 2))}` +
                            `${chalk.cyan(prompt.category.padEnd(tableResult.maxLengths.category + 2))}` +
                            `${prompt.title}`
                    );
                });
            });

            console.log('─'.repeat(80));
            
            // Only show CLI execution tips if not in interactive mode
            if (process.env.CLI_ENV !== 'cli') {
                console.log(chalk.italic('\nTip: Use either ID or directory name with the execute command:'));
                console.log(chalk.italic(`  prompt-library-cli execute -p 74       # By ID`));
                console.log(chalk.italic(`  prompt-library-cli execute -p "commit" # By name\n`));
            }
        }
    }

    private async listAllCategoriesForCI(categories: Record<string, CategoryItem[]>, json: boolean): Promise<void> {
        const categoryList = Object.keys(categories).sort();

        if (json) {
            console.log(JSON.stringify(categoryList, null, 2));
        } else {
            console.log(chalk.bold('\n📚 Prompt Categories:'));
            console.log('─'.repeat(80));

            const { headers, rows } = formatCategoriesForDisplay(categories);
            console.log(headers);
            console.log('─'.repeat(80));

            rows.forEach((row) => console.log(row));

            console.log('─'.repeat(80));
            
            // Only show CLI execution tips in non-interactive mode
            if (process.env.CLI_ENV !== 'cli') {
                console.log(chalk.italic('\nView prompts by category:'));
                console.log(chalk.italic(`  prompt-library-cli\n`));
            }
        }
    }

    private async listAllPrompts(categories: Record<string, CategoryItem[]>): Promise<void> {
        const allPrompts = getAllPrompts(categories);
        await this.selectAndManagePrompt(allPrompts, 'Available Prompts');
    }

    private async listPromptsByCategory(categories: Record<string, CategoryItem[]>): Promise<void> {
        while (true) {
            console.clear();
            printSectionHeader('Prompt Categories', '📚');
            
            // Get sorted categories
            const sortedCategories = Object.keys(categories).sort((a, b) => a.localeCompare(b));
            
            // Calculate counts for each category
            const countByCategory: Record<string, number> = {};
            sortedCategories.forEach(category => {
                countByCategory[category] = categories[category].length;
            });
            
            // Format table data
            const maxCategoryLength = Math.max(...sortedCategories.map(c => formatTitleCase(c).length), 'Category'.length);
            const tableWidth = maxCategoryLength + 20; // Add space for count
            
            // Create headers
            const headers = `${chalk.bold('Category'.padEnd(maxCategoryLength + 2))}${chalk.bold('Count')}`;
            const separator = '─'.repeat(tableWidth);
            
            // Create menu choices that look like a table
            const tableChoices: Array<{ name: string; value: string | 'back'; disabled?: boolean }> = [];
            
            // Add a header row
            tableChoices.push({
                name: headers,
                value: 'back',
                disabled: true
            });
            
            // Add a separator
            tableChoices.push({
                name: separator,
                value: 'back',
                disabled: true
            });
            
            // Add each row as a selectable item
            sortedCategories.forEach(category => {
                tableChoices.push({
                    name: `${chalk.green(formatTitleCase(category).padEnd(maxCategoryLength + 2))}${chalk.yellow(countByCategory[category].toString())}`,
                    value: category
                });
            });
            
            // Add a separator at the bottom
            tableChoices.push({
                name: separator,
                value: 'back',
                disabled: true
            });
            
            // Add info
            tableChoices.push({
                name: chalk.italic(`Found ${sortedCategories.length} categories.`),
                value: 'back',
                disabled: true
            });
            
            // Add a back option with danger formatting
            tableChoices.push({
                name: formatMenuItem('Go back', 'back', 'danger').name,
                value: 'back'
            });

            const category = await this.showMenu<string | 'back'>(
                'Use ↑↓ to select a category:',
                tableChoices,
                {
                    clearConsole: false,
                    includeGoBack: false
                }
            );

            if (category === 'back') return;

            const promptsWithCategory = categories[category].map((prompt) => ({
                ...prompt,
                category
            }));
            await this.selectAndManagePrompt(promptsWithCategory, `Prompts in ${formatTitleCase(category)}`);
        }
    }

    private async listPromptsSortedById(categories: Record<string, CategoryItem[]>): Promise<void> {
        const allPrompts = getPromptsSortedById(categories);
        await this.selectAndManagePromptById(allPrompts);
    }

    private async selectAndManagePromptById(prompts: (CategoryItem & { category: string })[]): Promise<void> {
        while (true) {
            cache.flushAll();
            
            console.clear();
            printSectionHeader('Prompts By ID', '📚');
            
            // Format prompts in a table format
            const tableResult = formatPromptsForDisplay(prompts, {
                sortById: true,
                showDirectory: false,
                tableWidth: 80
            });
            
            // Create menu choices that look like a table
            const choices: Array<{ name: string; value: CategoryItem | 'back'; disabled?: boolean }> = [];
            
            // Add a header row
            choices.push({
                name: tableResult.headers,
                value: 'back',
                disabled: true
            });
            
            // Add a separator
            choices.push({
                name: tableResult.separator,
                value: 'back',
                disabled: true
            });
            
            // Add each row as a selectable item
            tableResult.rows.forEach((row, index) => {
                choices.push({
                    name: row,
                    value: tableResult.promptsRowMap[index]
                });
            });
            
            // Add a separator at the bottom
            choices.push({
                name: tableResult.separator,
                value: 'back',
                disabled: true
            });
            
            // Add info
            choices.push({
                name: chalk.italic(`Found ${prompts.length} prompts.`),
                value: 'back',
                disabled: true
            });
            
            // Add a back option with danger formatting
            choices.push({
                name: formatMenuItem('Go back', 'back', 'danger').name,
                value: 'back'
            });

            const selectedPrompt = await this.showMenu<CategoryItem | 'back'>(
                'Use ↑↓ to select a prompt by ID:', 
                choices, 
                {
                    clearConsole: false,
                    includeGoBack: false // We're adding our own back option
                }
            );

            if (selectedPrompt === 'back') return;

            await this.managePrompt(selectedPrompt as CategoryItem);
        }
    }

    private async selectAndManagePrompt(
        prompts: (CategoryItem & { category: string })[], 
        menuTitle: string = 'Select a prompt:'
    ): Promise<void> {
        while (true) {
            cache.flushAll();
            console.clear();
            
            // Get the category if we're filtering by a single category
            const singleCategory = prompts.length > 0 && 
                prompts.every(p => p.category === prompts[0].category) ? 
                prompts[0].category : null;
                
            // Display the appropriate header
            if (singleCategory) {
                printSectionHeader(`Prompts in ${formatTitleCase(singleCategory)}`);
            } else {
                printSectionHeader(menuTitle);
            }
            
            // Format table data
            const tableResult = formatPromptsForDisplay(prompts, {
                showDirectory: true,
                highlightCategory: singleCategory,
                tableWidth: 80
            });
            
            // Create menu choices that look like a table
            const choices: Array<{ name: string; value: CategoryItem | 'back'; disabled?: boolean }> = [];
            
            // Add a header row
            choices.push({
                name: tableResult.headers,
                value: 'back',
                disabled: true
            });
            
            // Add a separator
            choices.push({
                name: tableResult.separator,
                value: 'back',
                disabled: true
            });
            
            // Add each row as a selectable item
            tableResult.rows.forEach((row, index) => {
                choices.push({
                    name: row,
                    value: tableResult.promptsRowMap[index]
                });
            });
            
            // Add a separator at the bottom
            choices.push({
                name: tableResult.separator,
                value: 'back',
                disabled: true
            });
            
            // Add info
            choices.push({
                name: chalk.italic(`Found ${prompts.length} prompts.`),
                value: 'back',
                disabled: true
            });
            
            // Add a back option with danger formatting
            choices.push({
                name: formatMenuItem('Go back', 'back', 'danger').name,
                value: 'back'
            });

            const selectedPrompt = await this.showMenu<CategoryItem | 'back'>(
                'Use ↑↓ to select a prompt:', 
                choices, 
                {
                    clearConsole: false,
                    includeGoBack: false // We're adding our own back option
                }
            );

            if (selectedPrompt === 'back') return;

            await this.managePrompt(selectedPrompt as CategoryItem);
        }
    }

    async managePrompt(prompt: CategoryItem): Promise<void> {
        while (true) {
            try {
                const details = await this.handleApiResult(await getPromptDetails(prompt.id), 'Fetched prompt details');

                if (!details) return;

                console.clear();
                printSectionHeader('Prompt Details', '🔬');
                await viewPromptDetails(details);

                const action = await this.selectPromptAction(details);

                if (action === 'back' || action === 'separator') {
                    return;
                }

                if (action === 'execute') {
                    await this.executePromptWithAssignment(prompt.id);
                } else if (action === 'unset_all') {
                    await this.unsetAllVariables(prompt.id);
                } else if (action === 'add_to_favorites') {
                    await this.addCurrentPromptToFavorites(prompt.id);
                } else {
                    await this.assignVariable(prompt.id, action);
                }
            } catch (error) {
                this.handleError(error, 'managing prompt');
                await this.pressKeyToContinue();
            }
        }
    }

    private async selectPromptAction(details: PromptMetadata): Promise<SelectPromptMenuAction> {
        const choices: Array<{ name: string; value: SelectPromptMenuAction; disabled?: boolean | string }> = [];
        const allRequiredSet = allRequiredVariablesSet(details);
        const promptId = details.id || '';
        const isInFavorites = await isPromptInFavorites(promptId);

        if (allRequiredSet) {
            choices.push({
                name: '─'.repeat(50),
                value: 'separator',
                disabled: ' '
            });

            choices.push({
                name: chalk.bold(formatMenuItem('Execute prompt', 'execute', 'success').name),
                value: 'execute'
            });

            choices.push({
                name: createSectionHeader('Configure variables:', '', 'primary').name,
                value: 'separator',
                disabled: ' '
            });
        } else {
            choices.push({
                name: '─'.repeat(50),
                value: 'separator',
                disabled: ' '
            });

            choices.push({
                name: createSectionHeader('Configure required variables first:', '', 'warning').name,
                value: 'separator',
                disabled: ' '
            });
        }

        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        choices.push(...formatVariableChoices(details.variables, envVars));

        choices.push({
            name: formatMenuItem('Unset all variables', 'unset_all', 'danger').name,
            value: 'unset_all'
        });
        
        // Add the "Add to favorites" option near the end, just before the implied "Go back" option
        if (!isInFavorites) {
            choices.push({
                name: formatMenuItem('Add to favorites', 'add_to_favorites', 'primary').name,
                value: 'add_to_favorites'
            });
        } else {
            choices.push({
                name: chalk.gray('★ Already in favorites'),
                value: 'add_to_favorites',
                disabled: ' '
            });
        }
        return this.showMenu<SelectPromptMenuAction>(`Use ↑↓ to select an action for ${chalk.cyan(details.title)}:`, choices, {
            clearConsole: false
        });
    }

    private async assignVariable(promptId: string, variable: PromptVariable): Promise<void> {
        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        const matchingEnvVar = envVars.find((env) => env.name === variable.name);
        const assignAction = await this.showMenu<'enter' | 'fragment' | 'env' | 'unset' | 'back'>(
            `Use ↑↓ to select an action for ${formatSnakeCase(variable.name)}:`,
            [
                { name: 'Enter value', value: 'enter' },
                { name: 'Use fragment', value: 'fragment' },
                {
                    name: matchingEnvVar
                        ? chalk.green(chalk.bold('Use environment variable'))
                        : 'Use environment variable',
                    value: 'env'
                },
                { name: 'Unset', value: 'unset' }
            ]
        );

        try {
            switch (assignAction) {
                case 'enter':
                    await this.assignValueToVariable(promptId, variable);
                    break;
                case 'fragment':
                    await this.assignFragmentToVariable(promptId, variable);
                    break;
                case 'env':
                    await this.assignEnvVarToVariable(promptId, variable);
                    break;
                case 'unset':
                    await this.unsetVariable(promptId, variable);
                    break;
            }
        } catch (error) {
            this.handleError(error, `assigning variable ${variable.name}`);
        }
    }

    private async assignValueToVariable(promptId: string, variable: PromptVariable): Promise<void> {
        console.log(chalk.cyan(`Enter or edit value for ${formatSnakeCase(variable.name)}:`));
        console.log(
            chalk.yellow('(An editor will open with the current value. Edit, save, and close the file when done.)')
        );

        const currentValue = variable.value || '';
        const value = await this.getMultilineInput(`Value for ${formatSnakeCase(variable.name)}`, currentValue);
        const success = await setVariableValue(promptId, variable.name, value);

        if (success) {
            console.log(chalk.green(`Value set for ${formatSnakeCase(variable.name)}`));
        } else {
            throw new Error(`Failed to set value for ${formatSnakeCase(variable.name)}`);
        }
    }

    private async assignFragmentToVariable(promptId: string, variable: PromptVariable): Promise<void> {
        const fragmentsResult = await this.handleApiResult(await listFragments(), 'Fetched fragments');

        if (!fragmentsResult) return;

        const selectedFragment = await this.showMenu<PromptFragment | 'back'>(
            'Select a fragment: ',
            fragmentsResult.map((f) => ({
                name: `${f.category}/${f.name}`,
                value: f
            }))
        );

        if (selectedFragment === 'back') {
            console.log(chalk.yellow('Fragment assignment cancelled.'));
            return;
        }

        const fragmentContent = await assignFragmentToVariable(
            promptId,
            variable.name,
            selectedFragment.category,
            selectedFragment.name
        );

        if (fragmentContent) {
            console.log(chalk.green(`Fragment assigned to ${formatSnakeCase(variable.name)}`));
            console.log(chalk.cyan('\nFragment content preview:'));
            console.log(fragmentContent.substring(0, 200) + (fragmentContent.length > 200 ? '...' : ''));
        } else {
            throw new Error('Failed to assign fragment');
        }
    }

    private async assignEnvVarToVariable(promptId: string, variable: PromptVariable): Promise<void> {
        const envVarsResult = await readEnvVars();

        if (!envVarsResult.success) {
            throw new Error('Failed to fetch environment variables');
        }

        const envVars = envVarsResult.data || [];
        const matchingEnvVars = getMatchingEnvironmentVariables(variable, envVars);
        const selectedEnvVar = await this.showMenu<EnvVariable | 'back'>('Select an Environment Variable:', [
            ...matchingEnvVars.map((v) => ({
                name: chalk.green(chalk.bold(`${formatSnakeCase(v.name)} (${v.scope}) - Suggested Match`)),
                value: v
            })),
            ...envVars
                .filter((v) => !matchingEnvVars.includes(v))
                .map((v) => ({
                    name: `${formatSnakeCase(v.name)} (${v.scope})`,
                    value: v
                }))
        ]);

        if (selectedEnvVar === 'back') {
            console.log(chalk.yellow('Environment variable assignment cancelled.'));
            return;
        }

        const envVarValue = await assignEnvironmentVariable(
            promptId,
            variable.name,
            selectedEnvVar.name,
            selectedEnvVar.value
        );

        if (envVarValue) {
            console.log(chalk.green(`Environment variable assigned to ${formatSnakeCase(variable.name)}`));
            console.log(chalk.cyan(`Current value: ${selectedEnvVar.value}`));
        } else {
            throw new Error('Failed to assign environment variable');
        }
    }

    private async unsetVariable(promptId: string, variable: PromptVariable): Promise<void> {
        const success = await setVariableValue(promptId, variable.name, '');

        if (success) {
            console.log(chalk.green(`Value unset for ${formatSnakeCase(variable.name)}`));
        } else {
            throw new Error(`Failed to unset value for ${formatSnakeCase(variable.name)}`);
        }
    }

    private async unsetAllVariables(promptId: string): Promise<void> {
        const details = await this.handleApiResult(await getPromptDetails(promptId), 'Fetched prompt details');

        if (!details) return;

        const confirm = await this.confirmAction(
            chalk.yellow('Are you sure you want to unset all variables for this prompt?')
        );

        if (!confirm) {
            console.log(chalk.yellow('Operation cancelled.'));
            return;
        }

        const result = await unsetAllVariables(promptId, details.variables);

        if (result.success) {
            console.log(chalk.green('All variables have been unset for this prompt.'));
        } else {
            console.log(chalk.yellow('Some variables could not be unset.'));

            for (const error of result.errors) {
                console.log(chalk.red(`  - ${formatSnakeCase(error.variable)}: ${error.error}`));
            }
        }

        await this.pressKeyToContinue();
    }

    private async addCurrentPromptToFavorites(promptId: string): Promise<void> {
        try {
            const alreadyInFavorites = await isPromptInFavorites(promptId);

            if (alreadyInFavorites) {
                console.log(chalk.yellow('This prompt is already in your favorites.'));
                await this.pressKeyToContinue();
                return;
            }

            const result = await addPromptToFavorites(promptId);

            if (result.success) {
                console.log(successMessage('Prompt added to favorites!'));
                await this.pressKeyToContinue();
            } else {
                console.log(chalk.yellow('Failed to add prompt to favorites.'));
                await this.pressKeyToContinue();
            }
        } catch (error) {
            this.handleError(error, 'adding prompt to favorites');
            await this.pressKeyToContinue();
        }
    }

    private async executePromptWithAssignment(promptId: string, returnToDetails: boolean = false): Promise<void> {
        try {
            const details = await this.handleApiResult(await getPromptDetails(promptId), 'Fetched prompt details');

            if (!details) return;

            const ready = allRequiredVariablesSet(details);

            if (!ready) {
                console.log(chalk.yellow('Cannot execute: some required variables are not set.'));
                return;
            }

            try {
                await recordPromptExecution(promptId);
            } catch (error) {
                console.error('Failed to record prompt execution:', error);
            }

            const userInputs: Record<string, string> = {};

            for (const variable of details.variables) {
                if (variable.value) {
                    userInputs[variable.name] = variable.value;
                    console.log(
                        chalk.green(
                            `Using value for ${formatSnakeCase(variable.name)}: ${variable.value.substring(0, 30)}...`
                        )
                    );
                } else if (!variable.optional_for_user) {
                    userInputs[variable.name] = await this.getMultilineInput(
                        `Enter value for ${formatSnakeCase(variable.name)}:`
                    );
                } else {
                    userInputs[variable.name] = ' ';
                }
            }

            console.clear();
            const conversationManager = new ConversationManager(promptId);
            const result = await this.handleApiResult(
                await conversationManager.initializeConversation(userInputs),
                'Initialized conversation'
            );

            if (result) {
                if (returnToDetails) {
                    await this.simplifiedConversation(conversationManager);
                } else {
                    await this.continueConversation(conversationManager);
                }
            }
        } catch (error) {
            this.handleError(error, 'executing prompt');
        }
    }

    private async simplifiedConversation(conversationManager: ConversationManager): Promise<void> {
        while (true) {
            try {
                const nextAction = await this.showMenu<'continue' | 'back'>(
                    'What would you like to do next?',
                    [
                        {
                            name: chalk.green(chalk.bold('Continue conversation')),
                            value: 'continue'
                        },
                        {
                            name: chalk.yellow(chalk.bold('Return to prompt details')),
                            value: 'back'
                        }
                    ],
                    { clearConsole: false, includeGoBack: false }
                );

                if (nextAction === 'back') break;

                const userInput = await this.getMultilineInput(chalk.blue('You: '));
                await this.handleApiResult(
                    await conversationManager.continueConversation(userInput),
                    'Continued conversation'
                );
            } catch (error) {
                this.handleError(error, 'continuing conversation');
                await this.pressKeyToContinue();
            }
        }
    }

    private async continueConversation(conversationManager: ConversationManager): Promise<void> {
        while (true) {
            try {
                const nextAction = await this.showMenu<'continue' | 'back'>(
                    'What would you like to do next?',
                    [{ name: chalk.green(chalk.bold('Continue conversation')), value: 'continue' }],
                    { clearConsole: false }
                );

                if (nextAction === 'back') break;

                const userInput = await this.getMultilineInput(chalk.blue('You: '));
                await this.handleApiResult(
                    await conversationManager.continueConversation(userInput),
                    'Continued conversation'
                );
            } catch (error) {
                this.handleError(error, 'continuing conversation');
                await this.pressKeyToContinue();
            }
        }
    }

    async handlePromptExecution(promptId: string | number): Promise<void> {
        try {
            const promptIdStr = String(promptId);
            while (true) {
                const details = await this.handleApiResult(
                    await getPromptDetails(promptIdStr),
                    'Fetched prompt details'
                );

                if (!details) {
                    return;
                }

                await viewPromptDetails(details);

                const action = await this.selectPromptAction(details);

                if (action === 'back' || action === 'separator') return;

                if (action === 'execute') {
                    await this.executePromptWithAssignment(promptIdStr, true);
                } else if (action === 'unset_all') {
                    await this.unsetAllVariables(promptIdStr);
                } else if (typeof action !== 'string') {
                    await this.assignVariable(promptIdStr, action);
                }
            }
        } catch (error) {
            this.handleError(error, 'handling prompt execution');
        }
    }
}

export default new PromptCommand();
