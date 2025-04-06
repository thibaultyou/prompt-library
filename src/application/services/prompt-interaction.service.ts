import { Injectable, Scope } from '@nestjs/common';
import chalk from 'chalk';

import { InputResolverService } from './input-resolver.service';
import { StringFormatterService } from '../../infrastructure/common/services/string-formatter.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { TextFormatter } from '../../infrastructure/ui/components/text.formatter';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { ENV_PREFIX, FRAGMENT_PREFIX, STYLE_TYPES } from '../../shared/constants';
import {
    CommandInterface,
    CategoryItem,
    PromptMetadata,
    PromptVariable,
    ApiResult,
    Result,
    MenuItem,
    ConversationManager,
    EnvVariable,
    PromptFragment,
    SpinnerWithStatus
} from '../../shared/types';
import { ExecutionFacade } from '../facades/execution.facade';
import { FragmentFacade } from '../facades/fragment.facade';
import { PromptFacade } from '../facades/prompt.facade';
import { VariableFacade } from '../facades/variable.facade';

@Injectable({ scope: Scope.DEFAULT })
export class PromptInteractionService {
    constructor(
        private readonly promptFacade: PromptFacade,
        private readonly executionFacade: ExecutionFacade,
        private readonly variableFacade: VariableFacade,
        private readonly inputResolverService: InputResolverService,
        private readonly fragmentFacade: FragmentFacade,
        private readonly uiFacade: UiFacade,
        private readonly loggerService: LoggerService,
        private readonly textFormatter: TextFormatter,
        private readonly stringFormatterService: StringFormatterService
    ) {}

    async managePrompt(command: CommandInterface, prompt: CategoryItem): Promise<void> {
        let stayInPromptDetails = true;
        while (stayInPromptDetails) {
            try {
                const promptDetailsResult = await this.promptFacade.getPromptDetails(prompt.id);
                const apiResultForHandling: ApiResult<PromptMetadata | null> = promptDetailsResult
                    ? Result.success(promptDetailsResult)
                    : Result.failure(`Prompt not found: ${prompt.id}`);
                const details = await command.handleApiResult<PromptMetadata | null>(
                    apiResultForHandling,
                    'Fetched prompt details'
                );

                if (!details) {
                    stayInPromptDetails = false;
                    continue;
                }

                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader('Prompt Details', '🔬');
                this.promptFacade.viewPromptDetails(details);
                const promptVariables = details.variables || [];
                const isInFavorites = await this.promptFacade.isInFavorites(prompt.id);
                const hasSetValues = promptVariables.some((v) => v.value && v.value.trim() !== '');
                const allRequiredSet = this.promptFacade.allRequiredVariablesSet(details);
                const choices: MenuItem<string | PromptVariable>[] = [];

                if (allRequiredSet) {
                    if (choices.length > 0)
                        choices.push({ name: '─'.repeat(50), value: 'separator0', disabled: true, type: 'separator' });

                    choices.push(this.uiFacade.formatMenuItem('Execute prompt', 'execute', 'success'));
                }

                if (promptVariables.length > 0) {
                    if (choices.length > 0)
                        choices.push({ name: '─'.repeat(50), value: 'separator1', disabled: true, type: 'separator' });

                    choices.push(this.textFormatter.createSectionHeader<string>('🔧 Variables', undefined, 'primary'));
                    const envVarsResult = await this.variableFacade.getAllVariables();
                    const envVars = envVarsResult.success ? (envVarsResult.data ?? []) : [];
                    const varChoices = this.promptFacade.formatVariableChoices(promptVariables, envVars);
                    choices.push(...varChoices);
                }

                choices.push({ name: '─'.repeat(50), value: 'separator2', disabled: true, type: 'separator' });
                choices.push(this.textFormatter.createSectionHeader<string>('⚙️ Actions', undefined, 'primary'));
                choices.push(this.uiFacade.formatMenuItem('View prompt content', 'view_content', STYLE_TYPES.INFO));
                choices.push(
                    this.uiFacade.formatMenuItem(
                        isInFavorites ? 'Remove from favorites' : 'Add to favorites',
                        isInFavorites ? 'unfavorite' : 'favorite',
                        isInFavorites ? STYLE_TYPES.WARNING : STYLE_TYPES.SUCCESS
                    )
                );

                if (hasSetValues)
                    choices.push(this.uiFacade.formatMenuItem('Clear all values', 'unset_all', 'warning'));

                const action = await command.selectMenu<string | PromptVariable>(
                    `Select action for ${this.uiFacade.formatMenuItem(details.title, 'title', 'info').name}:`,
                    choices
                );

                if (
                    action === 'back' ||
                    (typeof action === 'string' && action.startsWith('separator')) ||
                    (typeof action === 'string' && action.endsWith('_header'))
                ) {
                    stayInPromptDetails = false;
                    continue;
                }

                if (typeof action === 'string') {
                    switch (action) {
                        case 'execute': {
                            const execResult = await this.resolveAndExecutePrompt(command, details);

                            if (!execResult.success) {
                                command.handleError(new Error(execResult.error), 'executing prompt');
                                await command.pressKeyToContinue();
                            } else if (execResult.data) {
                                await this.manageConversationFlow(command, execResult.data);
                            }

                            break;
                        }
                        case 'unset_all': {
                            const unsetResult = await this.promptFacade.unsetAllVariables(prompt.id, details.variables);

                            if (unsetResult.success) this.loggerService.success('All variables unset.');
                            else {
                                this.loggerService.error('Failed to unset some variables:');
                                unsetResult.errors?.forEach((err) =>
                                    this.loggerService.error(`  - ${err.variable}: ${err.error}`)
                                );
                            }

                            await command.pressKeyToContinue();
                            break;
                        }
                        case 'view_content': {
                            const promptFiles = await this.promptFacade.getPromptFiles(prompt.id);

                            if (promptFiles?.promptContent) {
                                await this.viewPromptContentPaginated(
                                    command,
                                    prompt.id,
                                    details.title,
                                    promptFiles.promptContent
                                );
                            } else {
                                this.loggerService.error('Failed to retrieve prompt content');
                                await command.pressKeyToContinue();
                            }

                            break;
                        }
                        case 'favorite': {
                            const favResult = await this.promptFacade.addToFavorites(prompt.id);

                            if (favResult) this.loggerService.success('Added to favorites!');
                            else this.loggerService.error('Failed to add to favorites.');

                            await command.pressKeyToContinue();
                            break;
                        }
                        case 'unfavorite': {
                            const unfavResult = await this.promptFacade.removeFromFavorites(prompt.id);

                            if (unfavResult) this.loggerService.success('Removed from favorites!');
                            else this.loggerService.error('Failed to remove from favorites.');

                            await command.pressKeyToContinue();
                            break;
                        }
                        default:
                            this.loggerService.warn(`Unhandled action string in managePrompt: ${action}`);
                            await command.pressKeyToContinue();
                            break;
                    }
                } else if (typeof action === 'object' && action !== null && 'name' in action && 'role' in action) {
                    await this.handleVariableAssignment(command, prompt.id, action as PromptVariable);
                } else {
                    this.loggerService.warn(`Unhandled action type in managePrompt: ${JSON.stringify(action)}`);
                    await command.pressKeyToContinue();
                }
            } catch (error) {
                command.handleError(error, 'managing prompt');
                await command.pressKeyToContinue();
                stayInPromptDetails = false;
            }
        }
    }

    async handleVariableAssignment(
        command: CommandInterface,
        promptId: string,
        variable: PromptVariable
    ): Promise<void> {
        const variableDisplayName = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));
        this.loggerService.debug(`Handling assignment for variable "${variableDisplayName}" in prompt ID ${promptId}.`);

        try {
            this.uiFacade.clearConsole();
            this.textFormatter.printSectionHeader(`Assign Value: ${variableDisplayName}`, '🔧');
            this.loggerService.info(`${this.textFormatter.bold('Role:')} ${variable.role || 'N/A'}`);
            this.loggerService.info(
                `${this.textFormatter.bold('Required:')} ${!variable.optional_for_user ? this.textFormatter.style('Yes', STYLE_TYPES.DANGER) : 'No'}`
            );

            if (variable.value && variable.value.trim() !== '') {
                let displayValue = variable.value;

                if (variable.value.startsWith(FRAGMENT_PREFIX))
                    displayValue = this.textFormatter.style(variable.value, STYLE_TYPES.INFO);
                else if (variable.value.startsWith(ENV_PREFIX))
                    displayValue = this.textFormatter.style(variable.value, STYLE_TYPES.SECONDARY);
                else
                    displayValue = this.textFormatter.style(
                        variable.value.length > 60 ? variable.value.substring(0, 57) + '...' : variable.value,
                        STYLE_TYPES.SUCCESS
                    );

                this.loggerService.info(`${this.textFormatter.bold('Current Value:')} ${displayValue}`);
            } else {
                this.loggerService.info(
                    `${this.textFormatter.bold('Current Value:')} ${this.textFormatter.style('Not Set', STYLE_TYPES.WARNING)}`
                );
            }

            this.textFormatter.printSectionHeader('', '');
            const choices: MenuItem<'enter' | 'fragment' | 'env' | 'unset' | 'back'>[] = [
                { name: 'Enter value directly', value: 'enter', type: 'item' },
                { name: 'Use a fragment', value: 'fragment', type: 'item' },
                { name: 'Use an environment variable', value: 'env', type: 'item' }
            ];

            if (variable.value && variable.value.trim() !== '') {
                choices.push({
                    name: this.textFormatter.style('Clear current value', STYLE_TYPES.WARNING),
                    value: 'unset',
                    type: 'item'
                });
            }

            const assignAction = await command.selectMenu<'enter' | 'fragment' | 'env' | 'unset' | 'back'>(
                `How do you want to set the value for "${variableDisplayName}"?`,
                choices
            );
            let assignmentSuccess = false;
            switch (assignAction) {
                case 'enter':
                    assignmentSuccess = await this.assignDirectValue(command, promptId, variable);
                    break;
                case 'fragment':
                    assignmentSuccess = await this.assignFragmentReference(command, promptId, variable);
                    break;
                case 'env':
                    assignmentSuccess = await this.assignEnvVarReference(command, promptId, variable);
                    break;
                case 'unset':
                    assignmentSuccess = await this.clearVariableValue(promptId, variable);
                    break;
                case 'back':
                    this.loggerService.debug('Variable assignment cancelled.');
                    return;
                default:
                    this.loggerService.warn(`Unknown action: ${assignAction}`);
                    return;
            }

            if (!assignmentSuccess) await command.pressKeyToContinue('Assignment failed. Press key...');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error assigning variable "${variableDisplayName}": ${message}`);
            await command.pressKeyToContinue('An error occurred. Press key...');
        }
    }

    private async assignDirectValue(
        command: CommandInterface,
        promptId: string,
        variable: PromptVariable
    ): Promise<boolean> {
        const variableDisplayName = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));
        this.loggerService.info(
            this.textFormatter.style(`\nEnter value for ${variableDisplayName}:`, STYLE_TYPES.PRIMARY)
        );
        this.loggerService.info(this.textFormatter.dim(variable.role || 'No description.'));

        if (!variable.optional_for_user)
            this.loggerService.warn(this.textFormatter.style('(Required)', STYLE_TYPES.WARNING));

        this.loggerService.info(this.textFormatter.style('Editor will open. Save & close.', STYLE_TYPES.INFO));
        const initialValue =
            variable.value && !variable.value.startsWith(FRAGMENT_PREFIX) && !variable.value.startsWith(ENV_PREFIX)
                ? variable.value
                : '';
        const value = await command.getMultilineInput(`Value for ${variableDisplayName}`, initialValue);

        if (value === null) {
            this.loggerService.warn('Input cancelled.');
            return false;
        }

        if (value === initialValue) {
            this.loggerService.info('No changes.');
            return true;
        }

        if (!variable.optional_for_user && value.trim() === '') {
            this.loggerService.error(`Value required for "${variableDisplayName}".`);
            return false;
        }

        const result = await this.promptFacade.setVariableValue(promptId, variable.name, value);

        if (result.success) this.loggerService.success(`Value set directly for ${variableDisplayName}.`);
        else this.loggerService.error(`Failed to set value for ${variableDisplayName}.`);
        return result.success;
    }

    private async assignFragmentReference(
        command: CommandInterface,
        promptId: string,
        variable: PromptVariable
    ): Promise<boolean> {
        const variableDisplayName = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));
        this.loggerService.debug(`Assigning fragment to var "${variableDisplayName}".`);
        const fragmentsResult = await this.fragmentFacade.getAllFragments();

        if (!fragmentsResult.success || !fragmentsResult.data || fragmentsResult.data.length === 0) {
            this.loggerService.warn('No fragments available.');
            return false;
        }

        const fragmentChoices = fragmentsResult.data.map((f) => ({
            name: `${f.category}/${f.name}`,
            value: f,
            type: 'item' as const
        }));
        const selectedFragment = await command.selectMenu<PromptFragment | 'back'>(
            `Select fragment for "${variableDisplayName}":`,
            fragmentChoices
        );

        if (selectedFragment === 'back') {
            this.loggerService.info('Cancelled.');
            return false;
        }

        if (typeof selectedFragment !== 'object' || !selectedFragment?.category || !selectedFragment?.name) {
            this.loggerService.error('Invalid selection.');
            return false;
        }

        const assignedContent = await this.promptFacade.assignFragmentToVariable(
            promptId,
            variable.name,
            selectedFragment.category,
            selectedFragment.name
        );

        if (assignedContent !== null) {
            this.loggerService.success(
                `Var "${variableDisplayName}" references fragment "${selectedFragment.category}/${selectedFragment.name}".`
            );
            this.loggerService.info(
                '\nPreview:',
                assignedContent.substring(0, 200) + (assignedContent.length > 200 ? '...' : '')
            );
            return true;
        } else {
            this.loggerService.error(`Failed assign fragment "${selectedFragment.category}/${selectedFragment.name}".`);
            return false;
        }
    }

    private async assignEnvVarReference(
        command: CommandInterface,
        promptId: string,
        variable: PromptVariable
    ): Promise<boolean> {
        const variableDisplayName = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));
        this.loggerService.debug(`Assigning env var to var "${variableDisplayName}".`);
        const envVarsResult = await this.variableFacade.getAllVariables();

        if (!envVarsResult.success || !envVarsResult.data || envVarsResult.data.length === 0) {
            this.loggerService.warn('No env vars available.');
            return false;
        }

        const envVars = envVarsResult.data;
        const matchingEnvVars = this.promptFacade.getMatchingEnvironmentVariables(variable, envVars);
        const envVarChoices: Array<MenuItem<EnvVariable | 'separator'>> = [
            ...matchingEnvVars.map((v) => ({
                name: this.textFormatter.bold(
                    this.textFormatter.style(
                        `${this.stringFormatterService.formatSnakeCase(v.name)} - Suggested Match`,
                        'success'
                    )
                ),
                value: v,
                type: 'item' as const
            })),
            ...(matchingEnvVars.length > 0 && envVars.length > matchingEnvVars.length
                ? [{ name: '─'.repeat(30), value: 'separator' as const, disabled: true, type: 'separator' as const }]
                : []),
            ...envVars
                .filter((v) => !matchingEnvVars.some((mv) => mv.id === v.id))
                .map((v) => ({
                    name: `${this.stringFormatterService.formatSnakeCase(v.name)}`,
                    value: v,
                    type: 'item' as const
                }))
        ];
        const selectedEnvVar = await command.selectMenu<EnvVariable | 'back' | 'separator'>(
            `Select env var for "${variableDisplayName}":`,
            envVarChoices
        );

        if (selectedEnvVar === 'back' || selectedEnvVar === 'separator') {
            this.loggerService.info('Cancelled.');
            return false;
        }

        if (typeof selectedEnvVar !== 'object' || !selectedEnvVar?.name || selectedEnvVar.value === undefined) {
            this.loggerService.error('Invalid selection.');
            return false;
        }

        const assignedValue = await this.promptFacade.assignEnvironmentVariable(
            promptId,
            variable.name,
            selectedEnvVar.name,
            selectedEnvVar.value
        );

        if (assignedValue !== null) {
            this.loggerService.success(
                `Var "${variableDisplayName}" references env var "${this.stringFormatterService.formatSnakeCase(selectedEnvVar.name)}".`
            );
            const displayValue = this.variableFacade.isSensitiveVariable(selectedEnvVar)
                ? '********'
                : assignedValue.length > 60
                  ? assignedValue.substring(0, 57) + '...'
                  : assignedValue;
            this.loggerService.info(`Current value: ${this.textFormatter.style(displayValue, STYLE_TYPES.SUCCESS)}`);
            return true;
        } else {
            this.loggerService.error(
                `Failed assign env var "${this.stringFormatterService.formatSnakeCase(selectedEnvVar.name)}".`
            );
            return false;
        }
    }

    private async clearVariableValue(promptId: string, variable: PromptVariable): Promise<boolean> {
        const variableDisplayName = this.stringFormatterService.formatSnakeCase(variable.name.replace(/[{}]/g, ''));
        this.loggerService.debug(`Clearing value for var "${variableDisplayName}".`);
        const result = await this.promptFacade.setVariableValue(promptId, variable.name, '');

        if (result.success) this.loggerService.success(`Value cleared for var "${variableDisplayName}".`);
        else this.loggerService.error(`Failed clear value for var "${variableDisplayName}".`);
        return result.success;
    }

    async resolveAndExecutePrompt(
        command: CommandInterface,
        metadata: PromptMetadata
    ): Promise<ApiResult<ConversationManager | null>> {
        try {
            const inputsToResolve: Record<string, string> = {};

            for (const variable of metadata.variables) {
                const varNameWithBraces = variable.name;
                const varNameKey = varNameWithBraces.replace(/[{}]/g, '');
                const snakeCaseName = this.stringFormatterService.formatSnakeCase(varNameKey);

                if (variable.value && variable.value.trim() !== '') {
                    inputsToResolve[varNameWithBraces] = variable.value;
                } else if (!variable.optional_for_user) {
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
                    inputsToResolve[varNameWithBraces] = ' ';
                }
            }
            this.loggerService.debug('Resolving final inputs (files, env, fragments)...');
            const resolvedInputsResult = await this.inputResolverService.resolveInputs(inputsToResolve);

            if (!resolvedInputsResult.success || !resolvedInputsResult.data) {
                return Result.failure(resolvedInputsResult.error || 'Failed to resolve input variables');
            }

            const resolvedInputs = resolvedInputsResult.data;
            this.loggerService.debug('Inputs resolved.');
            const executionResult = await this.executionFacade.executePromptById(metadata.id!, resolvedInputs);
            return executionResult;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error resolving/executing prompt ID ${metadata.id}: ${message}`);
            return Result.failure(`Failed to execute prompt: ${message}`);
        }
    }

    async manageConversationFlow(command: CommandInterface, conversationManager: ConversationManager): Promise<void> {
        this.loggerService.debug('Managing conversation flow (Application Layer).');

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

                const isJsonMode = process.argv.includes('--json');
                let spinner: SpinnerWithStatus | null = null;

                if (isJsonMode) {
                    spinner = this.uiFacade.showSpinner('AI is thinking...');
                } else {
                    this.uiFacade.print(chalk.dim('AI is thinking...'));
                }

                const response = await conversationManager.continueConversation(userInput);

                if (spinner) {
                    spinner.stop();
                }

                if (!response.success) {
                    this.loggerService.error(`Error continuing conversation: ${response.error}`);
                    await command.pressKeyToContinue('An error occurred. Press any key to continue.');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.loggerService.error(`Error in conversation flow: ${message}`);
                await command.pressKeyToContinue('An error occurred. Press any key to return to menu.');
                break;
            }
        }
    }

    async selectPromptInteractive(
        title: string,
        emoji: string
    ): Promise<
        ApiResult<{
            id: number;
            title: string;
            directory: string;
            primary_category: string;
            one_line_description: string;
        } | null>
    > {
        try {
            const allPromptsResult = await this.promptFacade.getAllPrompts();

            if (!allPromptsResult || allPromptsResult.length === 0) {
                this.loggerService.warn('No prompts found.');
                return Result.success(null);
            }

            this.uiFacade.clearConsole();
            this.textFormatter.printSectionHeader(title, emoji);
            const tableData = this.promptFacade.formatPromptsTable(allPromptsResult, {
                showDirectory: false,
                tableWidth: 80
            });
            const choices = this.promptFacade.createTableMenuChoices(tableData.itemsMap, {
                headers: tableData.headers,
                rows: tableData.rows,
                separator: tableData.separator,
                infoText: `Found ${allPromptsResult.length} prompts.`
            });
            const selection = await this.uiFacade.selectMenu<{ id: string } | 'back' | string>(
                'Use ↑↓ to select a prompt:',
                choices.map((item) => ({
                    name: item.name,
                    value: item.value as { id: string } | string,
                    disabled: item.disabled
                })),
                { includeGoBack: true, menuType: 'prompt' }
            );

            if (selection === 'back' || typeof selection === 'string') return Result.success(null);

            const promptDetailsResult = await this.promptFacade.getPromptById(Number(selection.id));

            if (!promptDetailsResult.success || !promptDetailsResult.data) {
                this.loggerService.error(`Failed get prompt details: ${promptDetailsResult.error || 'Unknown'}`);
                return Result.failure(promptDetailsResult.error || 'Failed get prompt details', { data: null });
            }

            const selectedPrompt = promptDetailsResult.data;
            return Result.success({
                id: Number(selectedPrompt.id),
                title: selectedPrompt.title,
                directory: selectedPrompt.directory,
                primary_category: selectedPrompt.primary_category,
                one_line_description: selectedPrompt.one_line_description || ''
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error selecting prompt: ${message}`);

            if (error instanceof Error && error.stack)
                this.loggerService.debug(`Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
            return Result.failure(`Failed select prompt: ${message}`, { data: null });
        }
    }

    async viewPromptContentPaginated(
        command: CommandInterface,
        promptId: string,
        title: string,
        content: string
    ): Promise<void> {
        try {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(`Prompt Content - ${title}`, '📄');
            const contentLines = content.split('\n');
            const allDisplayLines = contentLines.map(
                (line, index) => `${chalk.gray(String(index + 1).padStart(4, ' '))} │ ${line}`
            );
            const terminalRows = process.stdout.rows || 24;
            const contentRows = terminalRows - 6;
            const totalPages = Math.ceil(allDisplayLines.length / contentRows);
            await this.displayContentPage(command, allDisplayLines, promptId, title, 1, contentRows, totalPages);
        } catch (error) {
            this.loggerService.error(`Error viewing prompt content: ${error}`);
            await command.pressKeyToContinue();
        }
    }

    async displayContentPage(
        command: CommandInterface,
        lines: string[],
        promptId: string,
        title: string,
        currentPage: number,
        pageSize: number,
        totalPages: number
    ): Promise<void> {
        try {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(`Prompt Content - ${title} (ID: ${promptId})`, '📄');
            const startIdx = (currentPage - 1) * pageSize;
            const endIdx = Math.min(startIdx + pageSize, lines.length);
            this.loggerService.info(lines.slice(startIdx, endIdx).join('\n'));
            this.uiFacade.printSeparator();
            this.loggerService.info(chalk.cyan(`Page ${currentPage}/${totalPages}`));
            const navigationOptions: MenuItem<'prev' | 'next' | 'goto' | 'back'>[] = [];

            if (currentPage > 1) navigationOptions.push({ name: chalk.yellow('◀ Previous page'), value: 'prev' });

            if (currentPage < totalPages) navigationOptions.push({ name: chalk.yellow('▶ Next page'), value: 'next' });

            if (totalPages > 2) navigationOptions.push({ name: 'Go to page...', value: 'goto' });

            const action = await command.selectMenu<'prev' | 'next' | 'goto' | 'back'>(
                'Navigation:',
                navigationOptions
            );

            if (action === 'prev')
                await this.displayContentPage(command, lines, promptId, title, currentPage - 1, pageSize, totalPages);
            else if (action === 'next')
                await this.displayContentPage(command, lines, promptId, title, currentPage + 1, pageSize, totalPages);
            else if (action === 'goto') {
                const pageInput = await command.getInput(`Enter page number (1-${totalPages}):`, {
                    default: String(currentPage)
                });
                const pageNum = parseInt(pageInput || String(currentPage), 10);

                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                    await this.displayContentPage(command, lines, promptId, title, pageNum, pageSize, totalPages);
                } else {
                    this.loggerService.warn(`Invalid page number.`);
                    await command.pressKeyToContinue();
                    await this.displayContentPage(command, lines, promptId, title, currentPage, pageSize, totalPages);
                }
            }
        } catch (error) {
            this.loggerService.error(`Error displaying content page: ${error}`);
            await command.pressKeyToContinue();
        }
    }
}
