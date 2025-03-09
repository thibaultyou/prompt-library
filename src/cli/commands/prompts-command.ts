import chalk from 'chalk';

import { BaseCommand } from './base-command';
import { CategoryItem, EnvVariable, PromptFragment, PromptMetadata, PromptVariable } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string-formatter';
import { ConversationManager } from '../utils/conversation-manager';
import { getPromptDetails } from '../utils/database';
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

type PromptMenuAction = 'all' | 'category' | 'id' | 'back';
type SelectPromptMenuAction = PromptVariable | 'execute' | 'unset_all' | 'back';

class PromptCommand extends BaseCommand {
    constructor() {
        super('prompts', 'List all prompts and view details');
        this.option('-l, --list', 'List all prompts with their IDs and categories')
            .option('-c, --categories', 'List all prompt categories')
            .option('-s, --search <keyword>', 'Search prompts by keyword (title, description, category)')
            .option('-j, --json', 'Output in JSON format (for CI use)')
            .option('-f, --favorites', 'Show favorite prompts')
            .option('-r, --recent', 'Show recently executed prompts')
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

Related Commands:
  execute    Run a specific prompt
  fragments  Manage prompt fragments used in prompts
            `
            )
            .action(this.execute.bind(this));
    }

    async execute(options: any): Promise<void> {
        try {
            const { showProgress } = await import('../utils/ui-components');
            const categoriesPromise = getPromptCategories();
            const categories = await showProgress('Loading prompts...', categoriesPromise);

            if (options.recent) {
                await this.showRecentPrompts(options.json);
                return;
            }

            if (options.favorites) {
                await this.showFavoritePrompts(options.json);
                return;
            }

            if (options.search) {
                await this.searchPrompts(categories, options.search, options.json);
                return;
            }

            if (options.list) {
                await this.listAllPromptsForCI(categories, options.json);
                return;
            }

            if (options.categories) {
                await this.listAllCategoriesForCI(categories, options.json);
                return;
            }

            await this.showPromptMenu(categories);
        } catch (error) {
            this.handleError(error, 'prompt command');
        }
    }

    private async showRecentPrompts(json: boolean = false): Promise<void> {
        try {
            const { getRecentExecutions } = await import('../utils/database');
            const { printSectionHeader } = await import('../utils/ui-components');
            const recentPrompts = await getRecentExecutions(10);

            if (json) {
                console.log(JSON.stringify(recentPrompts, null, 2));
                return;
            }

            if (!recentPrompts || recentPrompts.length === 0) {
                console.log(chalk.yellow('\nNo recent prompt executions found.\n'));
                console.log(chalk.italic('Try executing some prompts first.'));
                return;
            }

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
            console.log(chalk.italic(`\nTo execute any prompt above: prompt-library-cli execute -p <id>\n`));
        } catch (error) {
            this.handleError(error, 'showing recent prompts');
        }
    }

    private async showFavoritePrompts(json: boolean = false): Promise<void> {
        try {
            const { getFavoritePrompts } = await import('../utils/database');
            const { printSectionHeader } = await import('../utils/ui-components');
            const result = await getFavoritePrompts();

            if (json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }

            if (!result.success || !result.data || result.data.length === 0) {
                console.log(chalk.yellow('\nNo favorite prompts found.\n'));
                console.log(chalk.italic('Add prompts to your favorites first.'));
                return;
            }

            const favorites = result.data;
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
            console.log(chalk.italic(`\nTo execute any prompt above: prompt-library-cli execute -p <id>\n`));
        } catch (error) {
            this.handleError(error, 'showing favorite prompts');
        }
    }

    private async searchPrompts(
        categories: Record<string, CategoryItem[]>,
        keyword: string,
        json: boolean
    ): Promise<void> {
        try {
            const { printSectionHeader, warningMessage } = await import('../utils/ui-components');
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

            printSectionHeader(`Search Results for "${keyword}"`);

            const { headers, rows } = formatPromptsForDisplay(matchingPrompts);
            console.log('─'.repeat(80));
            console.log(headers);
            console.log('─'.repeat(80));
            rows.forEach((row) => console.log(row));

            console.log('─'.repeat(80));
            console.log(chalk.italic(`\nFound ${matchingPrompts.length} matching prompts. Execute any prompt with:`));
            console.log(chalk.italic(`  prompt-library-cli execute -p <id>\n`));

            if (matchingPrompts.length > 0) {
                const promptId = await this.promptToAddToFavorites(matchingPrompts);

                if (promptId) {
                    const { addPromptToFavorites } = await import('../utils/database');
                    const { successMessage } = await import('../utils/ui-components');
                    const result = await addPromptToFavorites(promptId);

                    if (result.success) {
                        console.log(successMessage('Prompt added to favorites!'));
                    }
                }
            }
        } catch (error) {
            this.handleError(error, 'searching prompts');
        }
    }

    private async promptToAddToFavorites(matchingPrompts: CategoryItem[]): Promise<string | null> {
        try {
            const addToFavorites = await this.confirmAction('Would you like to add one of these prompts to favorites?');

            if (!addToFavorites) {
                return null;
            }

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

    private async showPromptMenu(categories: Record<string, CategoryItem[]>): Promise<void> {
        while (true) {
            try {
                const action = await this.showMenu<PromptMenuAction>('Select an action:', [
                    { name: 'View prompts by category', value: 'category' },
                    { name: 'View all prompts', value: 'all' },
                    { name: 'View all prompts sorted by ID', value: 'id' }
                ]);
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
                    name: formatTitleCase(category),
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
            const selectedPrompt = await this.showMenu<CategoryItem | 'back'>(
                'Select a prompt or action:',
                prompts.map((p) => ({
                    name: `${formatTitleCase(p.category)} > ${chalk.green(p.title)} (ID: ${p.id})`,
                    value: p
                })),
                { clearConsole: true }
            );

            if (selectedPrompt === 'back') return;

            await this.managePrompt(selectedPrompt);
        }
    }

    private async managePrompt(prompt: CategoryItem): Promise<void> {
        while (true) {
            try {
                const details = await this.handleApiResult(await getPromptDetails(prompt.id), 'Fetched prompt details');

                if (!details) return;

                await viewPromptDetails(details);

                const action = await this.selectPromptAction(details);

                if (action === 'back') return;

                if (action === 'execute') {
                    await this.executePromptWithAssignment(prompt.id);
                } else if (action === 'unset_all') {
                    await this.unsetAllVariables(prompt.id);
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
        const choices: Array<{ name: string; value: SelectPromptMenuAction }> = [];
        const allRequiredSet = allRequiredVariablesSet(details);

        if (allRequiredSet) {
            choices.push({ name: chalk.green(chalk.bold('Execute prompt')), value: 'execute' });
        }

        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        choices.push(...formatVariableChoices(details.variables, envVars));

        choices.push({ name: chalk.red('Unset all variables'), value: 'unset_all' });
        return this.showMenu<SelectPromptMenuAction>(
            `Select an action for prompt "${chalk.cyan(details.title)}":`,
            choices,
            { clearConsole: false }
        );
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

    private async executePromptWithAssignment(promptId: string): Promise<void> {
        try {
            const details = await this.handleApiResult(await getPromptDetails(promptId), 'Fetched prompt details');

            if (!details) return;

            const ready = allRequiredVariablesSet(details);

            if (!ready) {
                console.log(chalk.yellow('Cannot execute: some required variables are not set.'));
                return;
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
                await this.continueConversation(conversationManager);
            }
        } catch (error) {
            this.handleError(error, 'executing prompt');
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
}

export default new PromptCommand();
