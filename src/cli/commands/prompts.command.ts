import chalk from 'chalk';

import { BaseCommand } from './base.command';
import { CategoryItem, EnvVar, Fragment, Prompt, Variable } from '../../shared/types';
import { formatTitleCase, formatSnakeCase } from '../../shared/utils/string_formatter';
import { ConversationManager } from '../utils/conversation.util';
import { fetchCategories, getPromptDetails, updatePromptVariable } from '../utils/database.util';
import { readEnvVars } from '../utils/env.util';
import { listFragments, viewFragmentContent } from '../utils/fragment.util';
import { viewPromptDetails } from '../utils/prompt.util';

type PromptMenuAction = 'all' | 'category' | 'id' | 'back';

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
            const categoriesResult = await fetchCategories();
            const categories = await this.handleApiResult(categoriesResult, 'Fetched categories');

            if (!categories) return;

            if (options.list) {
                await this.listAllPromptsForCI(categories, options.json);
                return;
            }

            if (options.categories) {
                await this.listAllCategoriesForCI(categories, options.json);
                return;
            }

            while (true) {
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
            }
        } catch (error) {
            this.handleError(error, 'prompt command');
        }
    }

    async listAllPromptsForCI(categories: Record<string, CategoryItem[]>, json: boolean): Promise<void> {
        const allPrompts = Object.entries(categories)
            .flatMap(([category, prompts]) =>
                prompts.map((prompt) => ({
                    id: prompt.id,
                    title: prompt.title,
                    category
                }))
            )
            .sort((a, b) => a.title.localeCompare(b.title));

        if (json) {
            console.log(JSON.stringify(allPrompts, null, 2));
        } else {
            console.log(chalk.bold('All prompts:'));
            allPrompts.forEach((prompt) => {
                console.log(`${chalk.green(prompt.id)} - ${chalk.cyan(prompt.category)} / ${prompt.title}`);
            });
        }
    }

    async listAllCategoriesForCI(categories: Record<string, CategoryItem[]>, json: boolean): Promise<void> {
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

    async listAllPrompts(categories: Record<string, CategoryItem[]>): Promise<void> {
        const allPrompts = Object.entries(categories)
            .flatMap(([category, prompts]) =>
                prompts.map((prompt) => ({
                    ...prompt,
                    category
                }))
            )
            .sort((a, b) => a.title.localeCompare(b.title));
        await this.selectAndManagePrompt(allPrompts);
    }

    async listPromptsByCategory(categories: Record<string, CategoryItem[]>): Promise<void> {
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

    async listPromptsSortedById(categories: Record<string, CategoryItem[]>): Promise<void> {
        const allPrompts = Object.entries(categories)
            .flatMap(([category, prompts]) => prompts.map((prompt) => ({ ...prompt, category })))
            .sort((a, b) => Number(a.id) - Number(b.id));
        await this.selectAndManagePrompt(allPrompts);
    }

    async selectAndManagePrompt(prompts: (CategoryItem & { category: string })[]): Promise<void> {
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

    async managePrompt(prompt: CategoryItem): Promise<void> {
        while (true) {
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
        }
    }

    async selectPromptAction(
        details: Prompt & { variables: Variable[] }
    ): Promise<Variable | 'execute' | 'unset_all' | 'back'> {
        const choices: Array<{ name: string; value: Variable | 'execute' | 'unset_all' | 'back' }> = [];
        const allRequiredSet = details.variables.every((v) => v.optional_for_user || v.value);

        if (allRequiredSet) {
            choices.push({ name: chalk.green(chalk.bold('Execute prompt')), value: 'execute' });
        }

        const envVarsResult = await readEnvVars();
        const envVars = envVarsResult.success ? envVarsResult.data || [] : [];
        choices.push(
            ...details.variables.map((v) => {
                const snakeCaseName = formatSnakeCase(v.name);
                let nameColor;
                let hint = '';

                if (v.value) {
                    if (v.value.startsWith('Fragment: ')) {
                        nameColor = chalk.blue;
                    } else if (v.value.startsWith('Env: ')) {
                        nameColor = chalk.magenta;
                    } else {
                        nameColor = chalk.green;
                    }
                } else {
                    nameColor = v.optional_for_user ? chalk.yellow : chalk.red;
                    const matchingEnvVar = envVars.find((env) => env.name === v.name);

                    if (matchingEnvVar) {
                        hint = chalk.magenta(' (env available)');
                    }
                }
                return {
                    name: `${chalk.reset('Assign')} ${nameColor(snakeCaseName)}${chalk.reset(v.optional_for_user ? '' : '*')}${hint}`,
                    value: v
                };
            })
        );

        choices.push({ name: chalk.red('Unset all variables'), value: 'unset_all' });
        return this.showMenu<Variable | 'execute' | 'unset_all' | 'back'>(
            `Select an action for prompt "${chalk.cyan(details.title)}":`,
            choices,
            {
                clearConsole: false
            }
        );
    }

    async assignVariable(promptId: string, variable: Variable): Promise<void> {
        const assignAction = await this.showMenu<'enter' | 'fragment' | 'env' | 'unset' | 'back'>(
            `Choose action for ${formatSnakeCase(variable.name)}:`,
            [
                { name: 'Enter value', value: 'enter' },
                { name: 'Use fragment', value: 'fragment' },
                { name: 'Use environment variable', value: 'env' },
                { name: 'Unset', value: 'unset' }
            ]
        );
        switch (assignAction) {
            case 'enter': {
                await this.assignValueToVariable(promptId, variable);
                break;
            }
            case 'fragment':
                await this.assignFragmentToVariable(promptId, variable);
                break;
            case 'env':
                await this.assignEnvVarToVariable(promptId, variable);
                break;
            case 'unset': {
                await this.unsetVariable(promptId, variable);
                break;
            }
            case 'back':
                return;
        }

        // await this.pressKeyToContinue();
    }

    async assignValueToVariable(promptId: string, variable: Variable): Promise<void> {
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
            console.error(
                chalk.red(`Failed to set value for ${formatSnakeCase(variable.name)}: ${updateResult.error}`)
            );
        }
    }

    async assignFragmentToVariable(promptId: string, variable: Variable): Promise<void> {
        try {
            const fragmentsResult = await this.handleApiResult(await listFragments(), 'Fetched fragments');

            if (!fragmentsResult) return;

            const selectedFragment = await this.showMenu<Fragment | 'back'>(
                'Select a Fragment: ',
                fragmentsResult.map((f) => ({
                    name: `${f.category}/${f.name}`,
                    value: f
                }))
            );

            if (selectedFragment === 'back') {
                console.log(chalk.yellow('Fragment assignment cancelled.'));
                return;
            }

            const fragmentRef = `Fragment: ${selectedFragment.category}/${selectedFragment.name}`;
            const updateResult = await updatePromptVariable(promptId, variable.name, fragmentRef);

            if (!updateResult.success) {
                console.error(chalk.red(`Failed to assign fragment: ${updateResult.error}`));
                return;
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
        } catch (error) {
            console.error(chalk.red('Error assigning fragment:'), error);
        }
    }

    async assignEnvVarToVariable(promptId: string, variable: Variable): Promise<void> {
        try {
            const envVarsResult = await readEnvVars();

            if (!envVarsResult.success) {
                console.error(chalk.red('Failed to fetch environment variables'));
                return;
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

            const envVarRef = `Env: ${selectedEnvVar.name}`;
            const updateResult = await updatePromptVariable(promptId, variable.name, envVarRef);

            if (!updateResult.success) {
                console.error(chalk.red(`Failed to assign environment variable: ${updateResult.error}`));
                return;
            }

            console.log(chalk.green(`Environment variable assigned to ${formatSnakeCase(variable.name)}`));
            console.log(chalk.cyan(`Current value: ${selectedEnvVar.value}`));
        } catch (error) {
            console.error(chalk.red('Error assigning environment variable:'), error);
        }
    }

    async unsetVariable(promptId: string, variable: Variable): Promise<void> {
        const unsetResult = await updatePromptVariable(promptId, variable.name, '');

        if (unsetResult.success) {
            console.log(chalk.green(`Value unset for ${formatSnakeCase(variable.name)}`));
        } else {
            console.error(
                chalk.red(`Failed to unset value for ${formatSnakeCase(variable.name)}: ${unsetResult.error}`)
            );
        }
    }

    async unsetAllVariables(promptId: string): Promise<void> {
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
            const unsetResult = await updatePromptVariable(promptId, variable.name, '');

            if (!unsetResult.success) {
                console.error(
                    chalk.red(`Failed to unset value for ${formatSnakeCase(variable.name)}: ${unsetResult.error}`)
                );
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

    async executePromptWithAssignment(promptId: string): Promise<void> {
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
                while (true) {
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
                        // console.log(chalk.green('AI:'), response);
                    }
                }
            }
        } catch (error) {
            this.handleError(error, 'executing prompt');
        }
    }
}

export default new PromptCommand();
