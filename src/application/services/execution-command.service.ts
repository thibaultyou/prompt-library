import { Injectable, Scope } from '@nestjs/common';
import chalk from 'chalk';
import yaml from 'js-yaml';

import { InputResolverService } from './input-resolver.service';
import { StringFormatterService } from '../../infrastructure/common/services/string-formatter.service';
import { FileSystemService } from '../../infrastructure/file-system/services/file-system.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { ERROR_MESSAGES } from '../../shared/constants';
import {
    ApiResult,
    PromptMetadata,
    Result,
    FileInputOptions,
    DynamicVariableOptions,
    CommandInterface,
    ConversationManager
} from '../../shared/types';
import { ConversationFacade } from '../facades/conversation.facade';
import { ExecutionFacade } from '../facades/execution.facade';
import { PromptFacade } from '../facades/prompt.facade';

@Injectable({ scope: Scope.DEFAULT })
export class ExecuteCommandService {
    constructor(
        private readonly promptFacade: PromptFacade,
        private readonly executionFacade: ExecutionFacade,
        private readonly conversationFacade: ConversationFacade,
        private readonly loggerService: LoggerService,
        private readonly stringFormatterService: StringFormatterService,
        private readonly uiFacade: UiFacade,
        private readonly fsService: FileSystemService,
        private readonly inputResolverService: InputResolverService
    ) {}

    async handleStoredPrompt(
        command: CommandInterface,
        promptId: string,
        dynamicOptions: DynamicVariableOptions,
        inspect: boolean,
        fileInputs: FileInputOptions
    ): Promise<ApiResult<void>> {
        try {
            const promptDetailsResult = await this.promptFacade.getPromptDetails(promptId);

            if (!promptDetailsResult) {
                this.loggerService.error(ERROR_MESSAGES.PROMPT_NOT_FOUND, 'execution', promptId);
                return Result.failure(ERROR_MESSAGES.PROMPT_NOT_FOUND.replace('{0}', promptId));
            }

            const metadata = promptDetailsResult;

            if (inspect) {
                await this.inspectPrompt(command, metadata);
                return Result.success(undefined);
            }

            const inputsToResolve: Record<string, string> = {};
            const missingRequired: string[] = [];

            for (const variable of metadata.variables) {
                const varNameWithBraces = variable.name;
                const varNameKey = varNameWithBraces.replace(/[{}]/g, '');
                const snakeCaseName = this.stringFormatterService.formatSnakeCase(varNameKey);

                if (dynamicOptions[snakeCaseName]) {
                    inputsToResolve[varNameWithBraces] = dynamicOptions[snakeCaseName];
                } else if (fileInputs[snakeCaseName]) {
                    inputsToResolve[varNameWithBraces] = `file:${fileInputs[snakeCaseName]}`;
                } else if (variable.value && variable.value.trim() !== '') {
                    inputsToResolve[varNameWithBraces] = variable.value;
                } else if (!variable.optional_for_user) {
                    if (command && typeof command.getMultilineInput === 'function') {
                        this.loggerService.debug(`Prompting user for required variable: ${varNameKey}`);
                        const value = await command.getMultilineInput(
                            `Enter value for required variable "${snakeCaseName}":\n${chalk.dim(variable.role || '')}`,
                            ''
                        );

                        if (value === null) {
                            this.loggerService.warn(`Input cancelled for required variable ${varNameKey}`);
                            return Result.failure(`Input cancelled for required variable ${varNameKey}`);
                        }

                        inputsToResolve[varNameWithBraces] = value;
                    } else {
                        missingRequired.push(snakeCaseName);
                    }
                } else {
                    inputsToResolve[varNameWithBraces] = ' ';
                }
            }

            if (missingRequired.length > 0) {
                await this.handleMissingVariablesCli(promptId, metadata, missingRequired);
                return Result.failure(ERROR_MESSAGES.REQUIRED_VARIABLES_NOT_SET);
            }

            this.loggerService.debug('Resolving final inputs (files, env, fragments)...');
            const resolvedInputsResult = await this.inputResolverService.resolveInputs(inputsToResolve);

            if (!resolvedInputsResult.success || !resolvedInputsResult.data) {
                return Result.failure(resolvedInputsResult.error || 'Failed to resolve input variables');
            }

            const resolvedInputs = resolvedInputsResult.data;
            this.loggerService.debug('Inputs resolved.');
            const executionResult = await this.executionFacade.executePromptById(promptId, resolvedInputs);

            if (!executionResult.success || !executionResult.data) {
                return Result.failure(executionResult.error || 'Core execution service failed');
            }

            const conversationManager = executionResult.data;
            await this.manageConversationFlow(command, conversationManager);
            return Result.success(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(ERROR_MESSAGES.PROMPT_EXECUTION_FAILED, 'execution', message);
            return Result.failure(ERROR_MESSAGES.PROMPT_EXECUTION_FAILED.replace('{0}', message));
        }
    }

    private async handleMissingVariablesCli(
        promptId: string,
        metadata: PromptMetadata,
        missingRequired: string[]
    ): Promise<void> {
        const isJsonMode = process.argv.includes('--json');

        if (isJsonMode) {
            const missingVarsInfo = missingRequired.map((varName) => {
                const variable = metadata.variables.find(
                    (v) => this.stringFormatterService.formatSnakeCase(v.name.replace(/[{}]/g, '')) === varName
                );
                return { name: varName, description: variable?.role || '', optional: false };
            });
            console.log(
                JSON.stringify(
                    {
                        success: false,
                        error: 'Missing required variables',
                        prompt_id: promptId,
                        prompt_title: metadata.title,
                        missing_variables: missingVarsInfo,
                        example_command: `prompt-library-cli execute -p ${promptId} ${missingRequired.map((v) => `--${v} "value"`).join(' ')}`
                    },
                    null,
                    2
                )
            );
            return;
        }

        console.error(chalk.red('Error: Missing required variables for this prompt.'));
        console.log(chalk.cyan('\nRequired variables:'));
        missingRequired.forEach((varName) => {
            const variable = metadata.variables.find(
                (v) => this.stringFormatterService.formatSnakeCase(v.name.replace(/[{}]/g, '')) === varName
            );

            if (!variable) return;

            console.log(chalk.yellow(`  --${varName}: ${chalk.gray(variable.role || '')}`));
        });
        console.log(chalk.cyan('\nExample usage:'));
        const exampleVars = missingRequired.map((v) => `--${v} "value"`).join(' ');
        console.log(`  prompt-library-cli execute -p ${promptId} ${exampleVars}`);
        console.log('\nOr run interactively: prompt-library-cli execute');
    }

    async handleFilePrompt(
        command: CommandInterface,
        promptFile: string,
        metadataFile: string,
        dynamicOptions: DynamicVariableOptions,
        inspect: boolean,
        fileInputs: FileInputOptions
    ): Promise<ApiResult<void>> {
        try {
            const promptContentRes = await this.fsService.readFileContent(promptFile);
            const metadataContentRes = await this.fsService.readFileContent(metadataFile);

            if (!promptContentRes.success || !promptContentRes.data) {
                return Result.failure(promptContentRes.error || `Failed to read prompt file: ${promptFile}`);
            }

            if (!metadataContentRes.success || !metadataContentRes.data) {
                return Result.failure(metadataContentRes.error || `Failed to read metadata file: ${metadataFile}`);
            }

            const promptContent = promptContentRes.data;
            const metadata = yaml.load(metadataContentRes.data) as PromptMetadata;

            if (inspect) {
                await this.inspectPrompt(command, metadata);
                return Result.success(undefined);
            }

            const inputsToResolve: Record<string, string> = {};
            const missingRequired: string[] = [];

            for (const variable of metadata.variables || []) {
                const varNameWithBraces = variable.name;
                const varNameKey = varNameWithBraces.replace(/[{}]/g, '');
                const snakeCaseName = this.stringFormatterService.formatSnakeCase(varNameKey);

                if (dynamicOptions[snakeCaseName]) inputsToResolve[varNameWithBraces] = dynamicOptions[snakeCaseName];
                else if (fileInputs[snakeCaseName])
                    inputsToResolve[varNameWithBraces] = `file:${fileInputs[snakeCaseName]}`;
                else if (variable.value && variable.value.trim() !== '')
                    inputsToResolve[varNameWithBraces] = variable.value;
                else if (!variable.optional_for_user) missingRequired.push(snakeCaseName);
                else inputsToResolve[varNameWithBraces] = ' ';
            }

            if (missingRequired.length > 0) {
                await this.handleMissingVariablesCli(metadata.title || 'local_file', metadata, missingRequired);
                return Result.failure(ERROR_MESSAGES.REQUIRED_VARIABLES_NOT_SET);
            }

            const resolvedInputsResult = await this.inputResolverService.resolveInputs(inputsToResolve);

            if (!resolvedInputsResult.success || !resolvedInputsResult.data) {
                return Result.failure(resolvedInputsResult.error || 'Failed to resolve input variables');
            }

            const resolvedInputs = resolvedInputsResult.data;
            const result = await this.executionFacade.executePromptWithMetadata(
                promptContent,
                metadata,
                resolvedInputs,
                {}
            );

            if (result.success && result.data) {
                this.uiFacade.print(chalk.green(chalk.bold('\nAI Response:')));
                this.uiFacade.print(result.data);
            }
            return { success: result.success, error: result.error };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(ERROR_MESSAGES.PROMPT_EXECUTION_FAILED, 'execution', message);
            return Result.failure(ERROR_MESSAGES.PROMPT_EXECUTION_FAILED.replace('{0}', message));
        }
    }

    async browseAndRunWorkflow(
        command: CommandInterface,
        inspect: boolean = false,
        fileInputs: FileInputOptions = {}
    ): Promise<ApiResult<void>> {
        while (true) {
            try {
                const browseAction = await command.selectMenu<
                    'category' | 'all' | 'recent' | 'favorites' | 'search' | 'back'
                >('Select a prompt source:', [
                    { name: 'Browse by Category', value: 'category' },
                    { name: 'List All Prompts', value: 'all' },
                    { name: 'Recent Prompts', value: 'recent' },
                    { name: 'Favorite Prompts', value: 'favorites' },
                    { name: 'Search Prompts', value: 'search' }
                ]);

                if (browseAction === 'back') return Result.success(undefined);

                let promptId: string | null = null;
                switch (browseAction) {
                    case 'category':
                        promptId = await this.browseByCategory(command);
                        break;
                    case 'all':
                        promptId = await this.browseAllPrompts(command);
                        break;
                    case 'recent':
                        promptId = await this.browseRecentPrompts(command);
                        break;
                    case 'favorites':
                        promptId = await this.browseFavoritePrompts(command);
                        break;
                    case 'search':
                        promptId = await this.searchPrompts(command);
                        break;
                }

                if (!promptId) continue;

                try {
                    const result = await this.handleStoredPrompt(command, promptId, {}, inspect, fileInputs);

                    if (!result.success) {
                        await command.pressKeyToContinue('Execution failed. Press any key...');
                    }
                } catch (execError) {
                    command.handleError(execError, 'executing selected prompt');
                    await command.pressKeyToContinue();
                }
            } catch (error) {
                command.handleError(error, 'browse and run workflow');
                await command.pressKeyToContinue();
                return Result.failure(
                    `Error in browse/run: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        }
    }

    private async browseByCategory(command: CommandInterface): Promise<string | null> {
        try {
            const categories = await this.promptFacade.getAllPromptsByCategory();

            if (!categories || Object.keys(categories).length === 0) {
                this.loggerService.warn('No prompt categories found.');
                return null;
            }

            const sortedCategories = Object.keys(categories).sort();
            const category = await command.selectMenu<string | 'back'>(
                'Select a category:',
                sortedCategories.map((cat) => ({ name: this.stringFormatterService.formatTitleCase(cat), value: cat }))
            );

            if (category === 'back') return null;

            const promptsInCategory = categories[category];

            if (!promptsInCategory || promptsInCategory.length === 0) {
                this.loggerService.warn(`No prompts found in category: ${category}`);
                return null;
            }

            const prompt = await command.selectMenu<{ id: string } | 'back'>(
                `Select a prompt from ${this.stringFormatterService.formatTitleCase(category)}:`,
                promptsInCategory.map((p) => ({
                    name: `${p.id.padEnd(4)} | ${chalk.green(p.title)}`,
                    value: { id: p.id },
                    description: p.description || ''
                }))
            );

            if (prompt === 'back') return null;
            return (prompt as { id: string }).id;
        } catch (error) {
            this.loggerService.error('Error browsing by category:', error);
            return null;
        }
    }

    private async browseAllPrompts(command: CommandInterface): Promise<string | null> {
        try {
            const allPrompts = await this.promptFacade.getAllPrompts();

            if (!allPrompts || allPrompts.length === 0) {
                this.loggerService.warn('No prompts found.');
                return null;
            }

            const promptChoices = allPrompts.map((p) => ({
                name: `${p.id.padEnd(4)} | ${chalk.green(p.title.padEnd(30))} | ${p.primary_category}`,
                value: { id: p.id },
                description: p.description || ''
            }));
            const selectedPrompt = await command.selectMenu<{ id: string } | 'back'>(
                'Use ↑↓ to select a prompt:',
                promptChoices,
                { pageSize: 15 }
            );

            if (selectedPrompt === 'back') return null;
            return (selectedPrompt as { id: string }).id;
        } catch (error) {
            this.loggerService.error('Error browsing all prompts:', error);
            return null;
        }
    }

    private async browseRecentPrompts(command: CommandInterface): Promise<string | null> {
        try {
            const recentPrompts = await this.promptFacade.getRecentPrompts(10);

            if (!recentPrompts || recentPrompts.length === 0) {
                this.loggerService.warn('No recent prompt executions found.');
                await command.pressKeyToContinue();
                return null;
            }

            const selectedPrompt = await command.selectMenu<{ id: string } | 'back'>(
                'Select a recently used prompt:',
                recentPrompts.map((p) => ({
                    name: `${String(p.prompt_id).padEnd(4)} | ${chalk.green(p.title || 'Untitled')} | ${new Date(p.execution_time).toLocaleString()}`,
                    value: { id: String(p.prompt_id) }
                }))
            );

            if (selectedPrompt === 'back') return null;
            return (selectedPrompt as { id: string }).id;
        } catch (error) {
            this.loggerService.error('Error browsing recent prompts:', error);
            return null;
        }
    }

    private async browseFavoritePrompts(command: CommandInterface): Promise<string | null> {
        try {
            const favorites = await this.promptFacade.getFavoritePrompts();

            if (!favorites || favorites.length === 0) {
                this.loggerService.warn('No favorite prompts found.');
                await command.pressKeyToContinue();
                return null;
            }

            const selectedPrompt = await command.selectMenu<{ id: string } | 'back'>(
                'Select a favorite prompt:',
                favorites.map((p) => ({
                    name: `${p.id.padEnd(4)} | ${chalk.green(p.title || 'Untitled')}`,
                    value: { id: p.id },
                    description: p.description || ''
                }))
            );

            if (selectedPrompt === 'back') return null;
            return (selectedPrompt as { id: string }).id;
        } catch (error) {
            this.loggerService.error('Error browsing favorite prompts:', error);
            return null;
        }
    }

    private async searchPrompts(command: CommandInterface): Promise<string | null> {
        try {
            const keyword = await command.getInput('Enter search term:', { allowCancel: true });

            if (keyword === null || !keyword.trim()) return null;

            const searchResults = await this.promptFacade.searchPrompts(keyword.trim());

            if (!searchResults || searchResults.length === 0) {
                this.loggerService.warn(`No prompts found matching: "${keyword.trim()}"`);
                await command.pressKeyToContinue();
                return null;
            }

            const selectedPrompt = await command.selectMenu<{ id: string } | 'back'>(
                `Search results for "${keyword.trim()}":`,
                searchResults.map((p) => ({
                    name: `${p.id.padEnd(4)} | ${chalk.green(p.title)} | ${p.primary_category}`,
                    value: { id: p.id },
                    description: p.description || ''
                }))
            );

            if (selectedPrompt === 'back') return null;
            return (selectedPrompt as { id: string }).id;
        } catch (error) {
            this.loggerService.error('Error searching prompts:', error);
            return null;
        }
    }

    async inspectPrompt(command: CommandInterface, metadata: PromptMetadata): Promise<void> {
        try {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader('Prompt Inspection', '🔍');
            const formattedMetadata = this.promptFacade.formatPromptMetadata(metadata, { showVariables: true });
            console.log(formattedMetadata);
            await command.pressKeyToContinue();
        } catch (error) {
            this.loggerService.error('Error inspecting prompt:', error);
            throw error;
        }
    }

    private async manageConversationFlow(
        command: CommandInterface,
        conversationManager: ConversationManager
    ): Promise<void> {
        this.loggerService.debug('Managing conversation flow (Application Layer).');
        const initialResponse = conversationManager.messages[conversationManager.messages.length - 1]?.content;

        if (initialResponse) {
            this.uiFacade.print(chalk.green(chalk.bold('\nAI:')));
            this.uiFacade.print(initialResponse);
        }

        while (true) {
            try {
                const nextAction = await command.selectMenu<'continue' | 'back'>('Conversation:', [
                    { name: chalk.green('Continue conversation'), value: 'continue' }
                ]);

                if (nextAction === 'back') {
                    this.loggerService.debug('Exiting conversation flow.');
                    break;
                }

                const userInput = await command.getMultilineInput(chalk.blue('You: '), '');

                if (userInput === null) {
                    this.loggerService.warn('User cancelled input.');
                    break;
                }

                const spinner = this.uiFacade.showSpinner('AI is thinking...');
                const response = await conversationManager.continueConversation(userInput);
                spinner.stop();

                if (!response.success) {
                    this.loggerService.error(`Error continuing conversation: ${response.error}`);
                    await command.pressKeyToContinue('An error occurred. Press any key to continue.');
                } else {
                    this.uiFacade.print(chalk.green(chalk.bold('\nAI:')));
                    this.uiFacade.print(response.data || '');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.loggerService.error(`Error in conversation flow: ${message}`);
                await command.pressKeyToContinue('An error occurred. Press any key to return to menu.');
                break;
            }
        }
    }
}
