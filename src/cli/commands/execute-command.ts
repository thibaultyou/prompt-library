import chalk from 'chalk';
import fs from 'fs-extra';
import yaml from 'js-yaml';

import { BaseCommand } from './base-command';
import { PromptMetadata } from '../../shared/types';
import { processPromptContent, updatePromptWithVariables } from '../../shared/utils/prompt-processing';
import { formatSnakeCase } from '../../shared/utils/string-formatter';
import {
    allAsync,
    getFavoritePrompts,
    getPromptDetails,
    getRecentExecutions,
    recordPromptExecution
} from '../utils/database';
import { getAllPrompts, getPromptCategories } from '../utils/prompt-utils';
import { getPromptFiles, viewPromptDetails } from '../utils/prompts';
import { createSectionHeader, formatMenuItem } from '../utils/ui-components';

class ExecuteCommand extends BaseCommand {
    constructor() {
        super('execute', 'Execute or inspect a prompt');
        this.option(
            '-p, --prompt <id_or_name>',
            'Execute a stored prompt by ID or name (e.g., 74 or "git_commit_message_agent")'
        )
            .option('-f, --prompt-file <file>', 'Path to the prompt file (usually prompt.md)')
            .option('-m, --metadata-file <file>', 'Path to the metadata file (usually metadata.yml)')
            .option('-i, --inspect', 'Inspect the prompt variables without executing')
            .option(
                '-fi, --file-input <variable>=<file>',
                'Specify a file to use as input for a variable',
                this.collect,
                {}
            )
            .allowUnknownOption(true)
            .addHelpText(
                'after',
                `
Dynamic Options:
  This command allows setting prompt variables dynamically using additional options.
  Variables can be set either by value or by file content.

Setting variables by value:
  Use --variable_name "value" format for each variable.

  Example:
  $ execute -f prompt.md -m metadata.yml --source_language english --target_language french

Setting variables by file content:
  Use -fi or --file-input option with variable=filepath format.

  Example:
  $ execute -f prompt.md -m metadata.yml -fi communication=input.txt

Combining value and file inputs:
  You can mix both methods in a single command.

  Example:
  $ execute -f prompt.md -m metadata.yml --source_language english -fi communication=input.txt --target_language french

Common Variables:
  While variables are prompt-specific, some common ones include:

  --safety_guidelines <value>             Set safety rules or ethical considerations
  --output_format <value>                 Set the structure and components of the final output
  --extra_guidelines_or_context <value>   Set additional information or instructions

Inspecting Variables:
  Use -i or --inspect to see all available variables for a specific prompt:
  $ execute -f prompt.md -m metadata.yml -i

Example Workflow:
  1. Inspect the prompt:
    $ execute -f ./prompts/universal_translator/prompt.md -m ./prompts/universal_translator/metadata.yml -i

  2. Execute the prompt with mixed inputs:
    $ execute -f ./prompts/universal_translator/prompt.md -m ./prompts/universal_translator/metadata.yml \\
    --source_language_or_mode english \\
    --target_language_or_mode french \\
    -fi communication=./input.txt

Note:
  - File paths are relative to the current working directory.
  - Use quotes for values containing spaces.
`
            )
            .action(this.execute.bind(this));
    }

    private collect(value: string, previous: Record<string, string>): Record<string, string> {
        const [variable, file] = value.split('=');
        return { ...previous, [variable]: file };
    }

    private parseDynamicOptions(args: string[]): Record<string, string> {
        const options: Record<string, string> = {};

        for (let i = 0; i < args.length; i += 2) {
            if (args[i].startsWith('--')) {
                const key = args[i].slice(2).replace(/-/g, '_');
                options[key] = args[i + 1];
            }
        }
        return options;
    }

    async execute(options: any, command: any): Promise<void> {
        try {
            if (options.help) {
                this.outputHelp();
                return;
            }
            
            // Check for command-line arguments directly
            const hasPrompt = process.argv.includes('-p') || process.argv.includes('--prompt');
            const hasPromptFile = process.argv.includes('-f') || process.argv.includes('--prompt-file');
            const hasMetadataFile = process.argv.includes('-m') || process.argv.includes('--metadata-file');
            const hasInspect = process.argv.includes('-i') || process.argv.includes('--inspect');
            
            // Get values for options
            let promptValue = '';
            let promptFileValue = '';
            let metadataFileValue = '';
            
            // Get prompt value
            const promptIndex = Math.max(
                process.argv.indexOf('-p'),
                process.argv.indexOf('--prompt')
            );
            if (promptIndex !== -1 && promptIndex < process.argv.length - 1) {
                promptValue = process.argv[promptIndex + 1];
            }
            
            // Get prompt file value
            const promptFileIndex = Math.max(
                process.argv.indexOf('-f'),
                process.argv.indexOf('--prompt-file')
            );
            if (promptFileIndex !== -1 && promptFileIndex < process.argv.length - 1) {
                promptFileValue = process.argv[promptFileIndex + 1];
            }
            
            // Get metadata file value
            const metadataFileIndex = Math.max(
                process.argv.indexOf('-m'),
                process.argv.indexOf('--metadata-file')
            );
            if (metadataFileIndex !== -1 && metadataFileIndex < process.argv.length - 1) {
                metadataFileValue = process.argv[metadataFileIndex + 1];
            }
            
            // Collect file inputs
            const fileInputs: Record<string, string> = {};
            let fileInputIndex = process.argv.indexOf('-fi');
            while (fileInputIndex !== -1) {
                if (fileInputIndex < process.argv.length - 1) {
                    const value = process.argv[fileInputIndex + 1];
                    const [variable, file] = value.split('=');
                    if (variable && file) {
                        fileInputs[variable] = file;
                    }
                }
                fileInputIndex = process.argv.indexOf('-fi', fileInputIndex + 2);
            }
            
            fileInputIndex = process.argv.indexOf('--file-input');
            while (fileInputIndex !== -1) {
                if (fileInputIndex < process.argv.length - 1) {
                    const value = process.argv[fileInputIndex + 1];
                    const [variable, file] = value.split('=');
                    if (variable && file) {
                        fileInputs[variable] = file;
                    }
                }
                fileInputIndex = process.argv.indexOf('--file-input', fileInputIndex + 2);
            }
            
            // Parse dynamic options
            const dynamicOptions: Record<string, string> = {};
            for (let i = 0; i < process.argv.length; i++) {
                const arg = process.argv[i];
                if (arg.startsWith('--') && 
                    arg !== '--prompt' && 
                    arg !== '--prompt-file' && 
                    arg !== '--metadata-file' && 
                    arg !== '--inspect' && 
                    arg !== '--file-input') {
                    
                    const key = arg.slice(2).replace(/-/g, '_');
                    if (i < process.argv.length - 1 && !process.argv[i + 1].startsWith('-')) {
                        dynamicOptions[key] = process.argv[i + 1];
                    }
                }
            }
            

            if (hasPrompt && promptValue) {
                await this.handleStoredPrompt(promptValue, dynamicOptions, hasInspect, fileInputs);
            } else if (hasPromptFile && promptFileValue && hasMetadataFile && metadataFileValue) {
                await this.handleFilePrompt(
                    promptFileValue,
                    metadataFileValue,
                    dynamicOptions,
                    hasInspect,
                    fileInputs
                );
            } else if (process.env.CLI_ENV === 'cli') {
                await this.browseAndRunWorkflow(hasInspect, fileInputs);
            } else {
                console.error(
                    chalk.red('Error: You must provide either a prompt ID or both prompt file and metadata file paths.')
                );
                this.outputHelp();
            }
        } catch (error) {
            this.handleError(error, 'execute command');
        }
    }

    private async handleStoredPrompt(
        promptId: string,
        dynamicOptions: Record<string, string>,
        inspect: boolean,
        fileInputs: Record<string, string>
    ): Promise<void> {
        try {
            const promptDetailsResult = await getPromptDetails(promptId);

            if (!promptDetailsResult.success || !promptDetailsResult.data) {
                throw new Error(`Failed to get prompt details for ID: ${promptId}`);
            }

            const promptFiles = await this.handleApiResult(
                await getPromptFiles(promptId, { cleanVariables: false }),
                'Fetched prompt files'
            );

            if (!promptFiles) return;

            const { promptContent, metadata } = promptFiles;

            if (process.env.CLI_ENV === 'cli') {
                // Don't use prompt command in CLI mode if we have dynamic options or file inputs
                // This way it will continue and handle variables with our direct logic
                if (Object.keys(dynamicOptions).length === 0 && Object.keys(fileInputs).length === 0 && !inspect) {
                    const { default: promptsCommand } = await import('./prompts-command');
                    await promptsCommand.handlePromptExecution(promptId);
                    return;
                }
            }

            if (inspect) {
                await this.inspectPrompt(metadata);
            } else {
                await this.executePromptWithMetadata(promptContent, metadata, dynamicOptions, fileInputs);
            }
        } catch (error) {
            this.handleError(error, 'handling stored prompt');
        }
    }

    private async handleFilePrompt(
        promptFile: string,
        metadataFile: string,
        dynamicOptions: Record<string, string>,
        inspect: boolean,
        fileInputs: Record<string, string>
    ): Promise<void> {
        try {
            const promptContent = await fs.readFile(promptFile, 'utf-8');
            const metadataContent = await fs.readFile(metadataFile, 'utf-8');
            const metadata = yaml.load(metadataContent) as PromptMetadata;

            if (inspect) {
                await this.inspectPrompt(metadata);
            } else {
                await this.executePromptWithMetadata(promptContent, metadata, dynamicOptions, fileInputs);
            }
        } catch (error) {
            this.handleError(error, 'handling file prompt');
        }
    }

    private async browseAndRunWorkflow(
        inspect: boolean = false,
        fileInputs: Record<string, string> = {}
    ): Promise<void> {
        while (true) {
            try {
                const choices = [];
                choices.push(
                    createSectionHeader<'category' | 'all' | 'recent' | 'favorites' | 'search' | 'back'>(
                        'BROWSE & EXECUTE',
                        '🔍',
                        'primary'
                    )
                );
                choices.push(formatMenuItem('By Category', 'category', 'primary'));
                choices.push(formatMenuItem('All Prompts', 'all', 'primary'));
                choices.push(formatMenuItem('Recent Prompts', 'recent', 'primary'));
                choices.push(formatMenuItem('Favorite Prompts', 'favorites', 'primary'));
                choices.push(formatMenuItem('Search Prompts', 'search', 'primary'));

                const browseAction = await this.showMenu<
                    'category' | 'all' | 'recent' | 'favorites' | 'search' | 'back'
                >(
                    'Select a browsing option:',
                    choices.map((item) => ({
                        name: item.name,
                        value: item.value as any,
                        disabled: item.disabled
                    }))
                );

                if (browseAction === 'back') return;

                let promptId: string | null = null;
                switch (browseAction) {
                    case 'category':
                        promptId = await this.browseByCategory();
                        break;
                    case 'all':
                        promptId = await this.browseAllPrompts();
                        break;
                    case 'recent':
                        promptId = await this.browseRecentPrompts();
                        break;
                    case 'favorites':
                        promptId = await this.browseFavoritePrompts();
                        break;
                    case 'search':
                        promptId = await this.searchPrompts();
                        break;
                }

                if (!promptId) continue;

                try {
                    await this.handleStoredPrompt(promptId, {}, inspect, fileInputs);
                } catch (execError) {
                    this.handleError(execError, 'executing prompt');
                    await this.pressKeyToContinue();
                }
            } catch (error) {
                this.handleError(error, 'browse and run workflow');
                await this.pressKeyToContinue();
                return;
            }
        }
    }

    private async browseByCategory(): Promise<string | null> {
        try {
            const categories = await getPromptCategories();

            if (!categories || Object.keys(categories).length === 0) {
                console.log(chalk.yellow('No prompt categories found.'));
                return null;
            }

            const sortedCategories = Object.keys(categories).sort();
            const category = await this.showMenu<string | 'back'>(
                'Select a category:',
                sortedCategories.map((cat) => ({
                    name: this.formatTitleCase(cat),
                    value: cat
                }))
            );

            if (category === 'back') return null;

            const promptsInCategory = categories[category];

            if (!promptsInCategory || promptsInCategory.length === 0) {
                console.log(chalk.yellow(`No prompts found in category: ${category}`));
                return null;
            }

            const prompt = await this.showMenu<{ id: number } | 'back'>(
                `Select a prompt from ${this.formatTitleCase(category)}:`,
                promptsInCategory.map((prompt) => ({
                    name: `${prompt.id.toString().padEnd(4)} | ${chalk.green(prompt.title)}`,
                    value: { id: Number(prompt.id) },
                    description:
                        typeof prompt === 'object' && 'one_line_description' in prompt
                            ? String(prompt.one_line_description)
                            : ''
                }))
            );

            if (prompt === 'back') return null;
            return prompt.id.toString();
        } catch (error) {
            this.handleError(error, 'browsing by category');
            return null;
        }
    }

    private async browseAllPrompts(): Promise<string | null> {
        try {
            const allPromptsResult = await allAsync<{
                id: number;
                title: string;
                directory: string;
                primary_category: string;
                one_line_description: string;
            }>('SELECT id, title, directory, primary_category, one_line_description FROM prompts ORDER BY id');

            if (!allPromptsResult.success || !allPromptsResult.data || allPromptsResult.data.length === 0) {
                console.log(chalk.yellow('No prompts found in the database.'));
                return null;
            }

            const promptChoices = allPromptsResult.data.map((prompt) => ({
                name: `${prompt.id.toString().padEnd(4)} | ${chalk.green(prompt.title.padEnd(30))} | ${prompt.primary_category}`,
                value: { id: Number(prompt.id) },
                description: prompt.one_line_description || ''
            }));
            const selectedPrompt = await this.showMenu<{ id: number } | 'back'>('Select a prompt:', promptChoices, {
                pageSize: 15
            });

            if (selectedPrompt === 'back') return null;
            return selectedPrompt.id.toString();
        } catch (error) {
            this.handleError(error, 'browsing all prompts');
            return null;
        }
    }

    private async browseRecentPrompts(): Promise<string | null> {
        try {
            const recentPrompts = await getRecentExecutions(10);

            if (!recentPrompts || recentPrompts.length === 0) {
                console.log(chalk.yellow('No recent prompt executions found.'));
                console.log(chalk.italic('Execute some prompts first to see them here.'));
                await this.pressKeyToContinue();
                return null;
            }

            const selectedPrompt = await this.showMenu<{ id: number } | 'back'>(
                'Select a recently used prompt:',
                recentPrompts.map((prompt) => ({
                    name: `${prompt.prompt_id.toString().padEnd(4)} | ${chalk.green(prompt.title || 'Untitled')} | ${new Date(prompt.execution_time).toLocaleString()}`,
                    value: { id: Number(prompt.prompt_id) }
                }))
            );

            if (selectedPrompt === 'back') return null;
            return selectedPrompt.id.toString();
        } catch (error) {
            this.handleError(error, 'browsing recent prompts');
            return null;
        }
    }

    private async browseFavoritePrompts(): Promise<string | null> {
        try {
            const favoritesResult = await getFavoritePrompts();

            if (!favoritesResult.success || !favoritesResult.data || favoritesResult.data.length === 0) {
                console.log(chalk.yellow('No favorite prompts found.'));
                console.log(
                    chalk.italic('You can add favorite prompts using the "Browse prompts" option from the main menu.')
                );
                await this.pressKeyToContinue();
                return null;
            }

            const selectedPrompt = await this.showMenu<{ id: number } | 'back'>(
                'Select a favorite prompt:',
                favoritesResult.data.map((prompt) => ({
                    name: `${prompt.prompt_id.toString().padEnd(4)} | ${chalk.green(prompt.title || 'Untitled')}`,
                    value: { id: Number(prompt.prompt_id) },
                    description: prompt.description || ''
                }))
            );

            if (selectedPrompt === 'back') return null;
            return selectedPrompt.id.toString();
        } catch (error) {
            this.handleError(error, 'browsing favorite prompts');
            return null;
        }
    }

    private async searchPrompts(): Promise<string | null> {
        try {
            const keyword = await this.getInput('Enter search term:');

            if (!keyword) return null;

            const categories = await getPromptCategories();

            if (!categories) {
                console.log(chalk.yellow('No categories found.'));
                return null;
            }

            const allPrompts = getAllPrompts(categories);
            const searchResults = allPrompts.filter(
                (prompt) =>
                    prompt.title.toLowerCase().includes(keyword.toLowerCase()) ||
                    prompt.category.toLowerCase().includes(keyword.toLowerCase()) ||
                    (prompt.description && prompt.description.toLowerCase().includes(keyword.toLowerCase()))
            );

            if (!searchResults || searchResults.length === 0) {
                console.log(chalk.yellow(`No prompts found matching: "${keyword}"`));
                return null;
            }

            const selectedPrompt = await this.showMenu<{ id: number } | 'back'>(
                `Search results for "${keyword}":`,
                searchResults.map((prompt) => ({
                    name: `${prompt.id.toString().padEnd(4)} | ${chalk.green(prompt.title)} | ${prompt.category}`,
                    value: { id: Number(prompt.id) },
                    description: prompt.description || ''
                }))
            );

            if (selectedPrompt === 'back') return null;
            return selectedPrompt.id.toString();
        } catch (error) {
            this.handleError(error, 'searching prompts');
            return null;
        }
    }

    private formatTitleCase(text: string): string {
        return text
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    private async inspectPrompt(metadata: PromptMetadata): Promise<void> {
        try {
            await viewPromptDetails(
                {
                    id: '',
                    title: metadata.title,
                    primary_category: metadata.primary_category,
                    description: metadata.description,
                    tags: metadata.tags,
                    variables: metadata.variables
                } as PromptMetadata,
                true
            );
        } catch (error) {
            this.handleError(error, 'inspecting prompt');
        }
    }

    private async executePromptWithMetadata(
        promptContent: string,
        metadata: PromptMetadata,
        dynamicOptions: Record<string, string>,
        fileInputs: Record<string, string>
    ): Promise<string> {
        if (metadata.id) {
            try {
                await recordPromptExecution(metadata.id);
            } catch (error) {
                console.error('Failed to record prompt execution:', error);
            }
        }

        if (process.env.CLI_ENV === 'cli' && metadata.variables && metadata.variables.length > 0) {
            console.log(chalk.cyan('\nPrompt Variables:'));
            console.log(chalk.gray('─'.repeat(60)));

            const userInputs: Record<string, string> = {};
            let needsInput = false;

            for (const variable of metadata.variables) {
                const variableName = variable.name.replace(/[{}]/g, '');
                const snakeCaseName = variableName.toLowerCase();

                if (variable.value) {
                    userInputs[variable.name] = variable.value;
                    console.log(
                        `${chalk.green('✓')} ${formatSnakeCase(variableName)}: ${chalk.dim('Using stored value')}`
                    );
                    continue;
                }

                const hasValueInOptions = dynamicOptions && snakeCaseName in dynamicOptions;
                const hasValueInFiles = fileInputs && snakeCaseName in fileInputs;

                if (hasValueInOptions) {
                    userInputs[variable.name] = dynamicOptions[snakeCaseName];
                    console.log(
                        `${chalk.green('✓')} ${formatSnakeCase(variableName)}: ${chalk.dim('Using provided value')}`
                    );
                } else if (hasValueInFiles) {
                    try {
                        userInputs[variable.name] = await fs.readFile(fileInputs[snakeCaseName], 'utf-8');
                        console.log(
                            `${chalk.green('✓')} ${formatSnakeCase(variableName)}: ${chalk.dim('Using file input')}`
                        );
                    } catch {
                        console.log(
                            `${chalk.red('✗')} ${formatSnakeCase(variableName)}: ${chalk.red('Error reading file')}`
                        );
                        needsInput = true;
                    }
                } else {
                    console.log(
                        `${chalk.yellow('?')} ${formatSnakeCase(variableName)}${variable.optional_for_user ? '' : chalk.red(' *')}: ${chalk.gray(variable.role || '')}`
                    );
                    needsInput = true;
                }
            }

            if (needsInput) {
                console.log(chalk.gray('─'.repeat(60)));
                console.log(chalk.cyan('Please provide values for the variables:'));

                for (const variable of metadata.variables) {
                    if (variable.name in userInputs) continue;

                    const variableName = variable.name.replace(/[{}]/g, '');
                    const snakeCaseName = variableName.toLowerCase();
                    console.log(chalk.cyan(`\nEnter value for ${formatSnakeCase(variableName)}:`));
                    console.log(chalk.gray(variable.role || ''));

                    if (!variable.optional_for_user) {
                        console.log(chalk.red('(Required)'));
                    }

                    const value = await this.getMultilineInput(`Value for ${formatSnakeCase(variableName)}:`);

                    if (value.trim() || variable.optional_for_user) {
                        userInputs[variable.name] = value;
                    } else {
                        throw new Error(`Required variable ${snakeCaseName} cannot be empty`);
                    }
                }
            }

            const missingVariables = metadata.variables
                .filter((v) => !v.optional_for_user && (!userInputs[v.name] || userInputs[v.name].trim() === ''))
                .map((v) => formatSnakeCase(v.name));

            if (missingVariables.length > 0) {
                throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
            }

            console.log(chalk.cyan('\nUsing variables:'));
            console.log(chalk.gray('─'.repeat(60)));
            Object.entries(userInputs).forEach(([key, value]) => {
                const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
                console.log(`${chalk.green('✓')} ${formatSnakeCase(key)}: ${displayValue}`);
            });
            console.log(chalk.gray('─'.repeat(60)));

            console.log(chalk.green('All variables set. Ready to execute prompt.'));

            const updatedPromptContent = updatePromptWithVariables(promptContent, userInputs);
            console.log(chalk.cyan('\nExecuting prompt...\n'));
            console.log(chalk.gray('─'.repeat(60)));
            const result = await processPromptContent([{ role: 'user', content: updatedPromptContent }], false, false);

            if (typeof result !== 'string') {
                throw new Error('Unexpected result format from prompt processing');
            }

            console.log(result);
            console.log(chalk.gray('─'.repeat(60)));
            console.log(chalk.green('Prompt execution completed successfully.'));
            await this.pressKeyToContinue();
            return result;
        } else {
            const userInputs: Record<string, string> = {};
            const missingVariables: string[] = [];

            for (const variable of metadata.variables) {
                const variableName = variable.name.replace(/[{}]/g, '');
                const snakeCaseName = variableName.toLowerCase();

                if (variable.value) {
                    userInputs[variable.name] = variable.value;
                    continue;
                }

                if (!variable.optional_for_user) {
                    const hasValue =
                        (dynamicOptions && snakeCaseName in dynamicOptions) ||
                        (fileInputs && snakeCaseName in fileInputs);

                    if (!hasValue) {
                        missingVariables.push(snakeCaseName);
                    }
                }
            }

            if (missingVariables.length > 0) {
                throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
            }

            for (const variable of metadata.variables) {
                const variableName = variable.name.replace(/[{}]/g, '');
                const snakeCaseName = variableName.toLowerCase();

                if (variable.name in userInputs) {
                    continue;
                }

                let value = dynamicOptions[snakeCaseName];

                if (fileInputs[snakeCaseName]) {
                    try {
                        value = await fs.readFile(fileInputs[snakeCaseName], 'utf-8');
                    } catch (error) {
                        console.error(chalk.red(`Error reading file for ${snakeCaseName}:`, error));
                        throw new Error(`Failed to read file for ${snakeCaseName}`);
                    }
                }

                if (value !== undefined) {
                    userInputs[variable.name] = value;
                } else if (!variable.optional_for_user) {
                    throw new Error(`Required variable ${snakeCaseName} is not set`);
                }
            }

            console.log(chalk.cyan('\nUsing variables:'));
            Object.entries(userInputs).forEach(([key, value]) => {
                console.log(`  ${formatSnakeCase(key)}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
            });

            const updatedPromptContent = updatePromptWithVariables(promptContent, userInputs);
            const result = await processPromptContent([{ role: 'user', content: updatedPromptContent }], false, false);

            if (typeof result !== 'string') {
                throw new Error('Unexpected result format from prompt processing');
            }

            console.log(result);
            return result;
        }
    }
}

export default new ExecuteCommand();
