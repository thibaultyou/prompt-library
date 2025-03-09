import chalk from 'chalk';
import fs from 'fs-extra';
import yaml from 'js-yaml';

import { BaseCommand } from './base-command';
import { PromptMetadata } from '../../shared/types';
import { processPromptContent, updatePromptWithVariables } from '../../shared/utils/prompt-processing';
import { formatSnakeCase } from '../../shared/utils/string-formatter';
import { getPromptFiles, viewPromptDetails } from '../utils/prompts';
import { allAsync } from '../utils/database';

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

            const dynamicOptions = command ? this.parseDynamicOptions(command.args) : {};

            if (options.prompt) {
                // Direct execution with a specific prompt ID/name
                await this.handleStoredPrompt(options.prompt, dynamicOptions, options.inspect, options.fileInput);
            } else if (options.promptFile && options.metadataFile) {
                // Direct execution with specific files
                await this.handleFilePrompt(
                    options.promptFile,
                    options.metadataFile,
                    dynamicOptions,
                    options.inspect,
                    options.fileInput
                );
            } else if (process.env.CLI_ENV === 'cli') {
                // Interactive browse and run workflow when called from the menu
                await this.browseAndRunWorkflow(options.inspect, options.fileInput);
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
            // Import necessary functions
            const { getPromptDetails } = await import('../utils/database');
            
            // Get prompt details including variables
            const promptDetailsResult = await getPromptDetails(promptId);
            if (!promptDetailsResult.success || !promptDetailsResult.data) {
                throw new Error(`Failed to get prompt details for ID: ${promptId}`);
            }
            
            // Get the prompt files with content
            const promptFiles = await this.handleApiResult(
                await getPromptFiles(promptId, { cleanVariables: false }),
                'Fetched prompt files'
            );

            if (!promptFiles) return;

            const { promptContent, metadata } = promptFiles;
            
            // Display prompt details with options to edit variables or execute
            if (process.env.CLI_ENV === 'cli') {
                // Import the interactive variable editing functionality from prompts-command 
                const { default: promptsCommand } = await import('./prompts-command');
                await promptsCommand.handlePromptExecution(promptId);
                return;
            }

            // For direct CLI execution (non-interactive)
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

    /**
     * Enhanced browse and run workflow that combines browsing and execution
     * @param inspect Whether to inspect variables without executing
     * @param fileInputs File inputs for variables
     */
    private async browseAndRunWorkflow(
        inspect: boolean = false, 
        fileInputs: Record<string, string> = {}
    ): Promise<void> {
        // Use a loop to keep the browsing session active until user explicitly exits
        while (true) {
            try {
                // First, offer different ways to browse prompts
                const browseAction = await this.showMenu<'category' | 'all' | 'recent' | 'favorites' | 'search' | 'back'>(
                    'How would you like to browse prompts?',
                    [
                        { 
                            name: chalk.bold('Browse by category'), 
                            value: 'category' 
                        },
                        { 
                            name: chalk.bold('View all prompts'), 
                            value: 'all' 
                        },
                        { 
                            name: chalk.bold('View recently used prompts'), 
                            value: 'recent' 
                        },
                        { 
                            name: chalk.bold('View favorite prompts'), 
                            value: 'favorites' 
                        },
                        { 
                            name: chalk.bold('Search for a prompt'), 
                            value: 'search' 
                        }
                    ]
                );

                if (browseAction === 'back') return;

                // Get prompt ID based on browse action
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

                if (!promptId) continue; // Go back to browse menu if no prompt was selected

                try {
                    // Execute the selected prompt
                    await this.handleStoredPrompt(promptId, {}, inspect, fileInputs);
                    
                    // No need for an extra menu - continue directly to browse options
                    // This avoids an extra menu step and streamlines the workflow
                } catch (execError) {
                    this.handleError(execError, 'executing prompt');
                    // Continue browsing even if execution failed
                    await this.pressKeyToContinue();
                }
            } catch (error) {
                this.handleError(error, 'browse and run workflow');
                await this.pressKeyToContinue();
                return; // Exit on serious errors
            }
        }
    }

    /**
     * Browse prompts by category
     */
    private async browseByCategory(): Promise<string | null> {
        try {
            // Import necessary functions
            const { getPromptCategories } = await import('../utils/prompt-utils');
            const categories = await getPromptCategories();
            
            if (!categories || Object.keys(categories).length === 0) {
                console.log(chalk.yellow('No prompt categories found.'));
                return null;
            }
            
            // Select a category
            const sortedCategories = Object.keys(categories).sort();
            const category = await this.showMenu<string | 'back'>(
                'Select a category:',
                sortedCategories.map(cat => ({
                    name: this.formatTitleCase(cat),
                    value: cat
                }))
            );
            
            if (category === 'back') return null;
            
            // Select a prompt from the category
            const promptsInCategory = categories[category];
            if (!promptsInCategory || promptsInCategory.length === 0) {
                console.log(chalk.yellow(`No prompts found in category: ${category}`));
                return null;
            }
            
            const prompt = await this.showMenu<{id: number} | 'back'>(
                `Select a prompt from ${this.formatTitleCase(category)}:`,
                promptsInCategory.map(prompt => ({
                    name: `${prompt.id.toString().padEnd(4)} | ${chalk.green(prompt.title)}`,
                    value: {id: Number(prompt.id)},
                    description: typeof prompt === 'object' && 'one_line_description' in prompt ? String(prompt.one_line_description) : ''
                }))
            );
            
            if (prompt === 'back') return null;
            return prompt.id.toString();
        } catch (error) {
            this.handleError(error, 'browsing by category');
            return null;
        }
    }
    
    /**
     * Browse all prompts
     */
    private async browseAllPrompts(): Promise<string | null> {
        try {
            // Instead of using the separate selectPrompt function,
            // use our showMenu method for consistency
            const allPromptsResult = await allAsync<{ 
                id: number; 
                title: string; 
                directory: string; 
                primary_category: string; 
                one_line_description: string 
            }>('SELECT id, title, directory, primary_category, one_line_description FROM prompts ORDER BY id');
            
            if (!allPromptsResult.success || !allPromptsResult.data || allPromptsResult.data.length === 0) {
                console.log(chalk.yellow('No prompts found in the database.'));
                return null;
            }
            
            // Transform prompts to choices
            const promptChoices = allPromptsResult.data.map(prompt => ({
                name: `${prompt.id.toString().padEnd(4)} | ${chalk.green(prompt.title.padEnd(30))} | ${prompt.primary_category}`,
                value: {id: Number(prompt.id)},
                description: prompt.one_line_description || ''
            }));
            
            // Use our standard showMenu with consistent styling
            const selectedPrompt = await this.showMenu<{id: number} | 'back'>(
                'Select a prompt:',
                promptChoices,
                { pageSize: 15 } // Show more options at once
            );
            
            if (selectedPrompt === 'back') return null;
            return selectedPrompt.id.toString();
        } catch (error) {
            this.handleError(error, 'browsing all prompts');
            return null;
        }
    }
    
    /**
     * Browse recently used prompts
     */
    private async browseRecentPrompts(): Promise<string | null> {
        try {
            const { getRecentExecutions } = await import('../utils/database');
            const recentPrompts = await getRecentExecutions(10);
            
            if (!recentPrompts || recentPrompts.length === 0) {
                console.log(chalk.yellow('No recent prompt executions found.'));
                console.log(chalk.italic('Execute some prompts first to see them here.'));
                await this.pressKeyToContinue();
                return null;
            }
            
            const selectedPrompt = await this.showMenu<{id: number} | 'back'>(
                'Select a recently used prompt:',
                recentPrompts.map(prompt => ({
                    name: `${prompt.prompt_id.toString().padEnd(4)} | ${chalk.green(prompt.title || 'Untitled')} | ${new Date(prompt.execution_time).toLocaleString()}`,
                    value: {id: Number(prompt.prompt_id)}
                }))
            );
            
            if (selectedPrompt === 'back') return null;
            return selectedPrompt.id.toString();
        } catch (error) {
            this.handleError(error, 'browsing recent prompts');
            return null;
        }
    }
    
    /**
     * Browse favorite prompts
     */
    private async browseFavoritePrompts(): Promise<string | null> {
        try {
            const { getFavoritePrompts } = await import('../utils/database');
            const favoritesResult = await getFavoritePrompts();
            
            if (!favoritesResult.success || !favoritesResult.data || favoritesResult.data.length === 0) {
                console.log(chalk.yellow('No favorite prompts found.'));
                console.log(chalk.italic('You can add favorite prompts using the "Browse prompts" option from the main menu.'));
                await this.pressKeyToContinue();
                return null;
            }
            
            const selectedPrompt = await this.showMenu<{id: number} | 'back'>(
                'Select a favorite prompt:',
                favoritesResult.data.map(prompt => ({
                    name: `${prompt.prompt_id.toString().padEnd(4)} | ${chalk.green(prompt.title || 'Untitled')}`,
                    value: {id: Number(prompt.prompt_id)},
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
    
    /**
     * Search for prompts
     */
    private async searchPrompts(): Promise<string | null> {
        try {
            const keyword = await this.getInput('Enter search term:');
            if (!keyword) return null;
            
            const { getAllPrompts } = await import('../utils/prompt-utils');
            const { getPromptCategories } = await import('../utils/prompt-utils');
            const categories = await getPromptCategories();
            
            if (!categories) {
                console.log(chalk.yellow('No categories found.'));
                return null;
            }
            
            // Get all prompts and filter them based on the keyword
            const allPrompts = getAllPrompts(categories);
            const searchResults = allPrompts.filter(prompt => 
                prompt.title.toLowerCase().includes(keyword.toLowerCase()) ||
                prompt.category.toLowerCase().includes(keyword.toLowerCase()) ||
                (prompt.description && prompt.description.toLowerCase().includes(keyword.toLowerCase()))
            );
            
            if (!searchResults || searchResults.length === 0) {
                console.log(chalk.yellow(`No prompts found matching: "${keyword}"`));
                return null;
            }
            
            const selectedPrompt = await this.showMenu<{id: number} | 'back'>(
                `Search results for "${keyword}":`,
                searchResults.map(prompt => ({
                    name: `${prompt.id.toString().padEnd(4)} | ${chalk.green(prompt.title)} | ${prompt.category}`,
                    value: {id: Number(prompt.id)},
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
    
    /**
     * Helper to format title case
     */
    private formatTitleCase(text: string): string {
        return text
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
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
                const { recordPromptExecution } = await import('../utils/database');
                await recordPromptExecution(metadata.id);
            } catch (error) {
                console.error('Failed to record prompt execution:', error);
            }
        }

        // Create a unique temporary file identifier for this execution to prevent conflicts
        const executionId = `exec_${Date.now()}`;
        
        try {
            // Interactive variable collection mode for CLI
            if (process.env.CLI_ENV === 'cli' && metadata.variables && metadata.variables.length > 0) {
                console.log(chalk.cyan('\nPrompt Variables:'));
                console.log(chalk.gray('─'.repeat(60)));
                
                const userInputs: Record<string, string> = {};
                let needsInput = false;
                
                // First, check which variables need user input
                for (const variable of metadata.variables) {
                    const variableName = variable.name.replace(/[{}]/g, '');
                    const snakeCaseName = variableName.toLowerCase();
                    
                    // If variable already has a value, use it
                    if (variable.value) {
                        userInputs[variable.name] = variable.value;
                        console.log(`${chalk.green('✓')} ${formatSnakeCase(variableName)}: ${chalk.dim('Using stored value')}`);
                        continue;
                    }
                    
                    // Check for value in dynamicOptions or fileInputs
                    const hasValueInOptions = dynamicOptions && snakeCaseName in dynamicOptions;
                    const hasValueInFiles = fileInputs && snakeCaseName in fileInputs;
                    
                    if (hasValueInOptions) {
                        userInputs[variable.name] = dynamicOptions[snakeCaseName];
                        console.log(`${chalk.green('✓')} ${formatSnakeCase(variableName)}: ${chalk.dim('Using provided value')}`);
                    } else if (hasValueInFiles) {
                        try {
                            userInputs[variable.name] = await fs.readFile(fileInputs[snakeCaseName], 'utf-8');
                            console.log(`${chalk.green('✓')} ${formatSnakeCase(variableName)}: ${chalk.dim('Using file input')}`);
                        } catch (error) {
                            console.log(`${chalk.red('✗')} ${formatSnakeCase(variableName)}: ${chalk.red('Error reading file')}`);
                            needsInput = true;
                        }
                    } else {
                        // Variable needs user input
                        console.log(`${chalk.yellow('?')} ${formatSnakeCase(variableName)}${variable.optional_for_user ? '' : chalk.red(' *')}: ${chalk.gray(variable.role || '')}`);
                        needsInput = true;
                    }
                }
                
                // Directly collect values for any needed input
                if (needsInput) {
                    console.log(chalk.gray('─'.repeat(60)));
                    console.log(chalk.cyan('Please provide values for the variables:'));
                    
                    // Collect values for variables that need input
                    for (const variable of metadata.variables) {
                        if (variable.name in userInputs) continue;
                        
                        const variableName = variable.name.replace(/[{}]/g, '');
                        const snakeCaseName = variableName.toLowerCase();
                        
                        console.log(chalk.cyan(`\nEnter value for ${formatSnakeCase(variableName)}:`));
                        console.log(chalk.gray(variable.role || ''));
                        
                        if (!variable.optional_for_user) {
                            console.log(chalk.red('(Required)'));
                        }
                        
                        // Use multiline input for variables
                        const value = await this.getMultilineInput(`Value for ${formatSnakeCase(variableName)}:`);
                        
                        if (value.trim() || variable.optional_for_user) {
                            userInputs[variable.name] = value;
                        } else {
                            throw new Error(`Required variable ${snakeCaseName} cannot be empty`);
                        }
                    }
                }
                
                // Verify all required variables are set
                const missingVariables = metadata.variables
                    .filter(v => !v.optional_for_user && (!userInputs[v.name] || userInputs[v.name].trim() === ''))
                    .map(v => formatSnakeCase(v.name));
                
                if (missingVariables.length > 0) {
                    throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
                }
                
                // Show summary of variables being used
                console.log(chalk.cyan('\nUsing variables:'));
                console.log(chalk.gray('─'.repeat(60)));
                Object.entries(userInputs).forEach(([key, value]) => {
                    const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
                    console.log(`${chalk.green('✓')} ${formatSnakeCase(key)}: ${displayValue}`);
                });
                console.log(chalk.gray('─'.repeat(60)));
                
                // No confirmation needed - proceed directly to execution
                console.log(chalk.green('All variables set. Ready to execute prompt.'))
                
                // Process the prompt with our collected variables
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
                // Non-interactive mode (for direct CLI calls)
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
                            (dynamicOptions && snakeCaseName in dynamicOptions) || (fileInputs && snakeCaseName in fileInputs);
                        
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
        } catch (error) {
            throw error; // Re-throw to be caught by the handler in browseAndRunWorkflow
        }
    }
}

export default new ExecuteCommand();
