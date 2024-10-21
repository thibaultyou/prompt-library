import chalk from 'chalk';

import { BaseCommand } from './base.command';
import { CategoryItem, EnvVar, Fragment, Prompt, Variable } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string_formatter.util';
import { ENV_PREFIX, FRAGMENT_PREFIX } from '../cli.constants';
import { ConversationManager } from '../utils/conversation_manager.util';
import { fetchCategories, getPromptDetails, updatePromptVariable } from '../utils/database.util';
import { readEnvVars } from '../utils/env.util';
import { listFragments, viewFragmentContent } from '../utils/fragment_operations.util';
import { viewPromptDetails } from '../utils/prompt_display.util';

type PromptMenuAction = 'all' | 'category' | 'id' | 'back';
type SelectPromptMenuAction = Variable | 'execute' | 'unset_all' | 'back';

class PromptCommand extends BaseCommand {
    constructor() {
        super('prompts', 'List all prompts and view details');
        this.option('-l, --list', 'List all prompts with their IDs and categories')
            .option('-c, --categories', 'List all prompt categories')
            .option('-j, --json', 'Output in JSON format (for CI use)')
            .action(this.execute.bind(this));
    }

    async execute(options: any): Promise<void> {
        try {
            const categories = await this.handleApiResult(await fetchCategories(), 'Fetched categories');

            if (!categories) return;

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
        const allPrompts = this.getAllPrompts(categories);

        if (json) {
            console.log(JSON.stringify(allPrompts, null, 2));
        } else {
            console.log(chalk.bold('All prompts:'));
            allPrompts.forEach((prompt) => {
                console.log(`${chalk.green(prompt.id)} - ${chalk.cyan(prompt.category)} / ${prompt.title}`);
            });
        }
    }

    private async listAllCategoriesForCI(categories: Record<string, CategoryItem[]>, json: boolean): Promise<void> {
        const categoryList = Object.keys(categories).sort();

        if (json) {
            console.log(JSON.stringify(categoryList, null, 2));
        } else {
            console.log(chalk.bold('All categories:'));
            categoryList.forEach((category) => {
                console.log(chalk.cyan(category));
            });
        }
    }

    private getAllPrompts(categories: Record<string, CategoryItem[]>): Array<CategoryItem & { category: string }> {
        return Object.entries(categories)
            .flatMap(([category, prompts]) =>
                prompts.map((prompt) => ({
                    ...prompt,
                    category
                }))
            )
            .sort((a, b) => a.title.localeCompare(b.title));
    }

    private async listAllPrompts(categories: Record<string, CategoryItem[]>): Promise<void> {
        const allPrompts = this.getAllPrompts(categories);
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
        const allPrompts = this.getAllPrompts(categories).sort((a, b) => Number(a.id) - Number(b.id));
        await this.selectAndManagePrompt(allPrompts);
    }

    private async selectAndManagePrompt(prompts: (CategoryItem & { category: string })[]): Promise<void> {
        while (true) {
            const selectedPrompt = await this.showMenu<CategoryItem | 'back'>(
                'Select a prompt or action:',
                prompts.map((p) => ({
                    name: `${formatTitleCase(p.category)} / ${chalk.green(p.title)} (ID: ${p.id})`,
                    value: p
                }))
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

    private async selectPromptAction(details: Prompt & { variables: Variable[] }): Promise<SelectPromptMenuAction> {
        const choices: Array<{ name: string; value: SelectPromptMenuAction }> = [];
        const allRequiredSet = details.variables.every((v) => v.optional_for_user || v.value);

        if (allRequiredSet) {
            choices.push({ name: chalk.green(chalk.bold('Execute prompt')), value: 'execute' });
        }

        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        choices.push(...this.formatVariableChoices(details.variables, envVars));

        choices.push({ name: chalk.red('Unset all variables'), value: 'unset_all' });
        return this.showMenu<SelectPromptMenuAction>(
            `Select an action for prompt "${chalk.cyan(details.title)}":`,
            choices,
            { clearConsole: false }
        );
    }

    private formatVariableChoices(variables: Variable[], envVars: EnvVar[]): Array<{ name: string; value: Variable }> {
        return variables.map((v) => {
            const snakeCaseName = formatSnakeCase(v.name);
            const nameColor = this.getVariableNameColor(v);
            const hint = this.getVariableHint(v, envVars);
            return {
                name: `${chalk.reset('Assign')} ${nameColor(snakeCaseName)}${chalk.reset(v.optional_for_user ? '' : '*')}${hint}`,
                value: v
            };
        });
    }

    private getVariableNameColor(v: Variable): (text: string) => string {
        if (v.value) {
            if (v.value.startsWith(FRAGMENT_PREFIX)) return chalk.blue;

            if (v.value.startsWith(ENV_PREFIX)) return chalk.magenta;
            return chalk.green;
        }
        return v.optional_for_user ? chalk.yellow : chalk.red;
    }

    private getVariableHint(v: Variable, envVars: EnvVar[]): string {
        if (!v.value) {
            const matchingEnvVar = envVars.find((env) => env.name === v.name);

            if (matchingEnvVar) {
                return chalk.magenta(' (env available)');
            }
        }
        return '';
    }

    private async assignVariable(promptId: string, variable: Variable): Promise<void> {
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

    private async assignValueToVariable(promptId: string, variable: Variable): Promise<void> {
        console.log(chalk.cyan(`Enter or edit value for ${formatSnakeCase(variable.name)}:`));
        console.log(
            chalk.yellow('(An editor will open with the current value. Edit, save, and close the file when done.)')
        );

        const currentValue = variable.value || '';
        const value = await this.getMultilineInput(`Value for ${formatSnakeCase(variable.name)}`, currentValue);
        const updateResult = await updatePromptVariable(promptId, variable.name, value);

        if (updateResult.success) {
            console.log(chalk.green(`Value set for ${formatSnakeCase(variable.name)}`));
        } else {
            throw new Error(`Failed to set value for ${formatSnakeCase(variable.name)}: ${updateResult.error}`);
        }
    }

    private async assignFragmentToVariable(promptId: string, variable: Variable): Promise<void> {
        const fragmentsResult = await this.handleApiResult(await listFragments(), 'Fetched fragments');

        if (!fragmentsResult) return;

        const selectedFragment = await this.showMenu<Fragment | 'back'>(
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

        const fragmentRef = `${FRAGMENT_PREFIX}${selectedFragment.category}/${selectedFragment.name}`;
        const updateResult = await updatePromptVariable(promptId, variable.name, fragmentRef);

        if (!updateResult.success) {
            throw new Error(`Failed to assign fragment: ${updateResult.error}`);
        }

        const contentResult = await this.handleApiResult(
            await viewFragmentContent(selectedFragment.category, selectedFragment.name),
            'Fetched fragment content'
        );

        if (contentResult) {
            console.log(chalk.green(`Fragment assigned to ${formatSnakeCase(variable.name)}`));
            console.log(chalk.cyan('\nFragment content preview:'));
            console.log(contentResult.substring(0, 200) + (contentResult.length > 200 ? '...' : ''));
        } else {
            console.error(chalk.red('Failed to fetch fragment content'));
        }
    }

    private async assignEnvVarToVariable(promptId: string, variable: Variable): Promise<void> {
        const envVarsResult = await readEnvVars();

        if (!envVarsResult.success) {
            throw new Error('Failed to fetch environment variables');
        }

        const envVars = envVarsResult.data || [];
        const matchingEnvVars = envVars.filter(
            (ev) =>
                ev.name.toLowerCase().includes(variable.name.toLowerCase()) ||
                variable.name.toLowerCase().includes(ev.name.toLowerCase())
        );
        const selectedEnvVar = await this.showMenu<EnvVar | 'back'>('Select an Environment Variable:', [
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

        const envVarRef = `${ENV_PREFIX}${selectedEnvVar.name}`;
        const updateResult = await updatePromptVariable(promptId, variable.name, envVarRef);

        if (!updateResult.success) {
            throw new Error(`Failed to assign environment variable: ${updateResult.error}`);
        }

        console.log(chalk.green(`Environment variable assigned to ${formatSnakeCase(variable.name)}`));
        console.log(chalk.cyan(`Current value: ${selectedEnvVar.value}`));
    }

    private async unsetVariable(promptId: string, variable: Variable): Promise<void> {
        const unsetResult = await updatePromptVariable(promptId, variable.name, '');

        if (unsetResult.success) {
            console.log(chalk.green(`Value unset for ${formatSnakeCase(variable.name)}`));
        } else {
            throw new Error(`Failed to unset value for ${formatSnakeCase(variable.name)}: ${unsetResult.error}`);
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

        let success = true;

        for (const variable of details.variables) {
            try {
                const unsetResult = await updatePromptVariable(promptId, variable.name, '');

                if (!unsetResult.success) {
                    throw new Error(unsetResult.error);
                }
            } catch (error) {
                this.handleError(error, `unsetting variable ${formatSnakeCase(variable.name)}`);
                success = false;
            }
        }

        if (success) {
            console.log(chalk.green('All variables have been unset for this prompt.'));
        } else {
            console.log(chalk.yellow('Some variables could not be unset. Please check the errors above.'));
        }

        await this.pressKeyToContinue();
    }

    private async executePromptWithAssignment(promptId: string): Promise<void> {
        try {
            const details = await this.handleApiResult(await getPromptDetails(promptId), 'Fetched prompt details');

            if (!details) return;

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
                    userInputs[variable.name] = ' '; // Note: Required to sanitize user inputs in prompts
                }
            }

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
                const nextAction = await this.showMenu<'continue' | 'back'>('What would you like to do next?', [
                    { name: chalk.green(chalk.bold('Continue conversation')), value: 'continue' }
                ]);

                if (nextAction === 'back') break;

                const userInput = await this.getMultilineInput(chalk.blue('You: '));
                const response = await this.handleApiResult(
                    await conversationManager.continueConversation(userInput),
                    'Continued conversation'
                );

                if (response) {
                    // Note: The response is not logged here.
                    // console.log(chalk.green('AI:'), response);
                }
            } catch (error) {
                this.handleError(error, 'continuing conversation');
                await this.pressKeyToContinue();
            }
        }
    }
}

export default new PromptCommand();
