import chalk from 'chalk';

import { BaseCommand } from './base-command';
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
    createCategoryHeader,
    createSectionHeader,
    formatMenuItem,
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
        this.option('-l, --list', 'List all prompts with their IDs and categories')
            .option('-c, --categories', 'List all prompt categories')
            .option('-s, --search <keyword>', 'Search prompts by keyword (title, description, category)')
            .option('-j, --json', 'Output in JSON format (for CI use)')
            .option('-f, --favorites', 'Show favorite prompts')
            .option('-r, --recent', 'Show recently executed prompts')
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
                printSectionHeader('Recent Prompt Executions');

                console.log('─'.repeat(80));
                console.log(
                    chalk.cyan('ID'.padEnd(6)) +
                        chalk.cyan('Prompt'.padEnd(40)) +
                        chalk.cyan('Category'.padEnd(20)) +
                        chalk.cyan('Executed At')
                );
                console.log('─'.repeat(80));

                recentPrompts.forEach((item: any) => {
                    const date = new Date(item.execution_time);
                    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                    console.log(
                        item.prompt_id.toString().padEnd(6) +
                            (item.title || 'Unknown').substring(0, 37).padEnd(40) +
                            (item.primary_category || 'Unknown').substring(0, 17).padEnd(20) +
                            formattedDate
                    );
                });

                console.log('─'.repeat(80));
                console.log(chalk.italic(`\nFound ${recentPrompts.length} recently executed prompts.\n`));

                const promptItems = recentPrompts.map((item) => ({
                    id: item.prompt_id.toString(),
                    title: item.title || 'Unknown',
                    category: 'recent',
                    primary_category: item.primary_category || 'Unknown',
                    path: '',
                    description: '',
                    subcategories: []
                }));
                const action = await this.showMenu<'execute' | 'back'>(
                    'What would you like to do next?',
                    [formatMenuItem('Execute a prompt', 'execute', 'success')],
                    { clearConsole: false }
                );

                if (action === 'execute') {
                    const promptId = await this.selectPromptFromList(promptItems, 'Select a prompt to execute:');

                    if (promptId) {
                        const promptDetails = await getPromptById(parseInt(promptId));

                        if (promptDetails) {
                            const selectedPrompt = {
                                id: promptId,
                                title: promptDetails.title,
                                category: promptDetails.primary_category,
                                primary_category: promptDetails.primary_category,
                                path: promptDetails.directory,
                                description: promptDetails.description || '',
                                subcategories: []
                            };
                            await this.managePrompt(selectedPrompt);
                            continue;
                        }
                    }
                } else {
                    stayInRecentPrompts = false;
                }
            }
        } catch (error) {
            this.handleError(error, 'showing recent prompts');
            await this.pressKeyToContinue();
        }
    }

    private async showFavoritePrompts(json: boolean = false): Promise<void> {
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
                printSectionHeader('Favorite Prompts');

                console.log('─'.repeat(80));
                console.log(
                    chalk.cyan('ID'.padEnd(6)) +
                        chalk.cyan('Prompt'.padEnd(40)) +
                        chalk.cyan('Category'.padEnd(20)) +
                        chalk.cyan('Added At')
                );
                console.log('─'.repeat(80));

                favorites.forEach((item: any) => {
                    const date = new Date(item.added_time);
                    const formattedDate = `${date.toLocaleDateString()}`;
                    console.log(
                        item.prompt_id.toString().padEnd(6) +
                            (item.title || 'Unknown').substring(0, 37).padEnd(40) +
                            (item.primary_category || 'Unknown').substring(0, 17).padEnd(20) +
                            formattedDate
                    );
                });

                console.log('─'.repeat(80));
                console.log(chalk.italic(`\nFound ${favorites.length} favorite prompts.\n`));

                const promptItems = favorites.map((item) => ({
                    id: item.prompt_id.toString(),
                    title: item.title || 'Unknown',
                    category: 'favorite',
                    primary_category: item.primary_category || 'Unknown',
                    path: '',
                    description: item.description || '',
                    subcategories: []
                }));
                const action = await this.showMenu<'execute' | 'remove' | 'back'>(
                    'What would you like to do next?',
                    [
                        formatMenuItem('Execute a prompt', 'execute', 'success'),
                        formatMenuItem('Remove from favorites', 'remove', 'danger')
                    ],
                    { clearConsole: false }
                );

                if (action === 'execute') {
                    const promptId = await this.selectPromptFromList(promptItems, 'Select a prompt to execute:');

                    if (promptId) {
                        const promptDetails = await getPromptById(parseInt(promptId));

                        if (promptDetails) {
                            const selectedPrompt = {
                                id: promptId,
                                title: promptDetails.title,
                                category: promptDetails.primary_category,
                                primary_category: promptDetails.primary_category,
                                path: promptDetails.directory,
                                description: promptDetails.description || '',
                                subcategories: []
                            };
                            await this.managePrompt(selectedPrompt);
                            continue;
                        }
                    }
                } else if (action === 'remove') {
                    const promptId = await this.selectPromptFromList(
                        promptItems,
                        'Select a prompt to remove from favorites:'
                    );

                    if (promptId) {
                        const result = await removePromptFromFavorites(promptId);

                        if (result.success) {
                            console.log(successMessage('Prompt removed from favorites!'));

                            const refreshResult = await getFavoritePrompts();

                            if (refreshResult.success && refreshResult.data) {
                                favorites.length = 0;
                                favorites.push(...refreshResult.data);
                            }

                            await new Promise((resolve) => setTimeout(resolve, 1000));
                            continue;
                        }
                    }
                } else {
                    stayInFavorites = false;
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

                printSectionHeader(`Search Results for "${keyword}"`);

                const { headers, rows } = formatPromptsForDisplay(matchingPrompts);
                console.log('─'.repeat(80));
                console.log(headers);
                console.log('─'.repeat(80));
                rows.forEach((row) => console.log(row));

                console.log('─'.repeat(80));
                console.log(
                    chalk.italic(`\nFound ${matchingPrompts.length} matching prompts. Execute any prompt with:`)
                );
                console.log(chalk.italic(`  prompt-library-cli execute -p <id>\n`));

                if (matchingPrompts.length > 0) {
                    const action = await this.showMenu<'execute' | 'favorites' | 'back'>(
                        'What would you like to do next?',
                        [
                            formatMenuItem('Execute a prompt', 'execute', 'success'),
                            formatMenuItem('Add a prompt to favorites', 'favorites', 'primary')
                        ],
                        { clearConsole: false }
                    );

                    if (action === 'favorites') {
                        const promptId = await this.selectPromptToAddToFavorites(matchingPrompts);

                        if (promptId) {
                            const result = await addPromptToFavorites(promptId);

                            if (result.success) {
                                console.log(successMessage('Prompt added to favorites!'));
                                await new Promise((resolve) => setTimeout(resolve, 1000));
                            }
                        }
                    } else if (action === 'execute') {
                        const promptId = await this.selectPromptToExecute(matchingPrompts);

                        if (promptId) {
                            const selectedPrompt = matchingPrompts.find((p) => p.id === promptId);

                            if (selectedPrompt) {
                                await this.managePrompt(selectedPrompt);
                                continue;
                            } else {
                                const { default: executeCommand } = await import('./execute-command');
                                await executeCommand.parseAsync(['-p', promptId]);
                                stayInSearchResults = false;
                            }
                        }
                    } else {
                        stayInSearchResults = false;
                    }
                } else {
                    stayInSearchResults = false;
                }
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
                const choices = [];
                choices.push(createSectionHeader<PromptMenuAction>('BROWSE & EXECUTE', '🔍', 'primary'));
                choices.push(formatMenuItem('By Category', 'category', 'primary'));
                choices.push(formatMenuItem('All Prompts', 'all', 'primary'));
                choices.push(formatMenuItem('By ID', 'id', 'primary'));
                choices.push(formatMenuItem('Search Prompts', 'search', 'primary'));
                choices.push(formatMenuItem('Recent Prompts', 'recent', 'primary'));
                choices.push(formatMenuItem('Favorite Prompts', 'favorites', 'primary'));

                choices.push({
                    name: '─'.repeat(50),
                    value: 'separator',
                    disabled: ' '
                });

                choices.push(createSectionHeader<PromptMenuAction>('MANAGE', '✏️', 'success'));
                choices.push(formatMenuItem('Create New Prompt', 'create', 'success'));
                choices.push(formatMenuItem('Edit Prompt', 'edit', 'warning'));
                choices.push(formatMenuItem('Delete Prompt', 'delete', 'danger'));

                choices.push({
                    name: '─'.repeat(50),
                    value: 'separator',
                    disabled: ' '
                });
                choices.push({
                    name: chalk.italic('To run a prompt, use the "Run a prompt" option from the main menu'),
                    value: 'back',
                    disabled: ' '
                });

                const action = await this.showMenu<PromptMenuAction>(
                    'Select an action:',
                    choices as Array<{
                        name: string;
                        value: PromptMenuAction;
                        disabled?: boolean | string;
                    }>
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
                        const keyword = await this.getInput('Enter search keyword:');

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

            const { headers, maxLengths } = formatPromptsForDisplay(allPrompts);
            console.log(headers);
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
                        `${chalk.green(prompt.id.toString().padEnd(maxLengths.id + 2))}` +
                            `${chalk.yellow(directory.padEnd(maxLengths.dir + 2))}` +
                            `${chalk.cyan(prompt.category.padEnd(maxLengths.category + 2))}` +
                            `${prompt.title}`
                    );
                });
            });

            console.log('─'.repeat(80));
            console.log(chalk.italic('\nTip: Use either ID or directory name with the execute command:'));
            console.log(chalk.italic(`  prompt-library-cli execute -p 74       # By ID`));
            console.log(chalk.italic(`  prompt-library-cli execute -p "commit" # By name\n`));
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
            console.log(chalk.italic('\nView prompts by category:'));
            console.log(chalk.italic(`  prompt-library-cli\n`));
        }
    }

    private async listAllPrompts(categories: Record<string, CategoryItem[]>): Promise<void> {
        const allPrompts = getAllPrompts(categories);
        await this.selectAndManagePrompt(allPrompts);
    }

    private async listPromptsByCategory(categories: Record<string, CategoryItem[]>): Promise<void> {
        while (true) {
            const sortedCategories = Object.keys(categories).sort((a, b) => a.localeCompare(b));
            const category = await this.showMenu<string | 'back'>(
                'Select a category:',
                sortedCategories.map((category) => ({
                    name: chalk.cyan(chalk.bold(formatTitleCase(category))),
                    value: category
                }))
            );

            if (category === 'back') return;

            const promptsWithCategory = categories[category].map((prompt) => ({
                ...prompt,
                category
            }));
            await this.selectAndManagePrompt(promptsWithCategory);
        }
    }

    private async listPromptsSortedById(categories: Record<string, CategoryItem[]>): Promise<void> {
        const allPrompts = getPromptsSortedById(categories);
        await this.selectAndManagePrompt(allPrompts);
    }

    private async selectAndManagePrompt(prompts: (CategoryItem & { category: string })[]): Promise<void> {
        while (true) {
            cache.flushAll();

            const categories = await getPromptCategories();
            const refreshedPrompts = getAllPrompts(categories);
            const promptsByCategory: Record<string, (CategoryItem & { category: string })[]> = {};
            refreshedPrompts.forEach((prompt) => {
                if (!promptsByCategory[prompt.category]) {
                    promptsByCategory[prompt.category] = [];
                }

                promptsByCategory[prompt.category].push(prompt);
            });

            const choices: Array<{ name: string; value: CategoryItem | 'back'; disabled?: boolean }> = [];
            const sortedCategories = Object.keys(promptsByCategory).sort();

            for (const category of sortedCategories) {
                choices.push({
                    name: createCategoryHeader(formatTitleCase(category)).name,
                    value: 'back' as const,
                    disabled: true
                });

                const sortedPrompts = promptsByCategory[category].sort((a, b) => a.title.localeCompare(b.title));
                sortedPrompts.forEach((prompt) => {
                    choices.push({
                        name: `  ${chalk.green(prompt.title)} (ID: ${prompt.id})`,
                        value: prompt
                    });
                });
            }

            const selectedPrompt = await this.showMenu<CategoryItem | 'back'>('Select a prompt:', choices, {
                clearConsole: true
            });

            if (selectedPrompt === 'back') return;

            await this.managePrompt(selectedPrompt as CategoryItem);
        }
    }

    async managePrompt(prompt: CategoryItem): Promise<void> {
        while (true) {
            try {
                const details = await this.handleApiResult(await getPromptDetails(prompt.id), 'Fetched prompt details');

                if (!details) return;

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
        const choices: Array<{ name: string; value: SelectPromptMenuAction; disabled?: boolean }> = [];
        const allRequiredSet = allRequiredVariablesSet(details);
        const promptId = details.id || '';
        const isInFavorites = await isPromptInFavorites(promptId);

        if (allRequiredSet) {
            choices.push({
                name: formatMenuItem('Execute prompt', 'execute', 'success').name,
                value: 'execute'
            });

            if (!isInFavorites) {
                choices.push({
                    name: formatMenuItem('Add to favorites', 'add_to_favorites', 'primary').name,
                    value: 'add_to_favorites'
                });
            } else {
                choices.push({
                    name: chalk.gray('★ Already in favorites'),
                    value: 'add_to_favorites',
                    disabled: true
                });
            }

            choices.push({
                name: createSectionHeader('Configure variables:', '', 'primary').name,
                value: 'separator',
                disabled: true
            });
        } else {
            choices.push({
                name: createSectionHeader('Configure required variables first:', '', 'warning').name,
                value: 'separator',
                disabled: true
            });

            if (!isInFavorites) {
                choices.push({
                    name: formatMenuItem('Add to favorites', 'add_to_favorites', 'primary').name,
                    value: 'add_to_favorites'
                });
            } else {
                choices.push({
                    name: chalk.gray('★ Already in favorites'),
                    value: 'add_to_favorites',
                    disabled: true
                });
            }
        }

        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        choices.push(...formatVariableChoices(details.variables, envVars));

        choices.push({
            name: formatMenuItem('Unset all variables', 'unset_all', 'danger').name,
            value: 'unset_all'
        });
        return this.showMenu<SelectPromptMenuAction>(`Prompt: "${chalk.cyan(details.title)}"`, choices, {
            clearConsole: false
        });
    }

    private async assignVariable(promptId: string, variable: PromptVariable): Promise<void> {
        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        const matchingEnvVar = envVars.find((env) => env.name === variable.name);
        const assignAction = await this.showMenu<'enter' | 'fragment' | 'env' | 'unset' | 'back'>(
            `Choose action for ${formatSnakeCase(variable.name)}:`,
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
            chalk.red('Are you sure you want to unset all variables for this prompt?')
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
