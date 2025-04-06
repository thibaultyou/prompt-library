import { Injectable, Inject } from '@nestjs/common';
import chalk from 'chalk';
import { SubCommand, Option } from 'nest-commander';

import { PromptCommandRunner } from './base-prompt.command.runner';
import { UpdatePromptCommand } from './update-prompt.command';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { PROMPT_UI } from '../../../shared/constants';
import { PromptMetadata, MenuItem, CategoryItem } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';

interface IParsedReadPromptOptions {
    prompt?: string;
    json?: boolean;
    all?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'read',
    description: PROMPT_UI.DESCRIPTIONS.READ_COMMAND,
    aliases: ['view', 'get']
})
export class ReadPromptCommand extends PromptCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        promptFacade: PromptFacade,
        executionFacade: ExecutionFacade,
        variableFacade: VariableFacade,
        conversationFacade: ConversationFacade,
        promptInteractionService: PromptInteractionService,
        @Inject(UpdatePromptCommand) private readonly updateProvider: UpdatePromptCommand
    ) {
        super(
            uiFacade,
            errorService,
            repositoryService,
            loggerService,
            promptFacade,
            executionFacade,
            variableFacade,
            conversationFacade,
            promptInteractionService
        );
    }

    async run(passedParams: string[], options?: IParsedReadPromptOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('read prompt', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);
            const showAll = opts.all || false;
            let promptId = opts.prompt;

            if (!promptId && isInteractive) {
                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader(PROMPT_UI.SECTION_HEADER.READ, PROMPT_UI.SECTION_HEADER.READ_ICON);
                const allPrompts = await this.promptFacade.getAllPrompts();

                if (!allPrompts || allPrompts.length === 0) {
                    this.loggerService.warn('No prompts found.');
                    return;
                }

                const promptChoices: MenuItem<CategoryItem | 'back'>[] = allPrompts.map((p) => ({
                    name: `${p.id.padEnd(4)} | ${chalk.green(p.title)} (${p.primary_category})`,
                    value: p
                }));
                const selectedChoice = await this.selectMenu<CategoryItem | 'back'>(
                    'Select prompt to view:',
                    promptChoices,
                    { includeGoBack: true }
                );

                if (selectedChoice === 'back') {
                    this.loggerService.warn('No prompt selected');
                    return;
                }

                promptId = selectedChoice.id;
            }

            if (!promptId) {
                this.handleMissingArguments(
                    isJsonOutput,
                    PROMPT_UI.ERROR.PROMPT_ID_REQUIRED,
                    PROMPT_UI.ERROR.PROMPT_ID_REQUIRED
                );
                return;
            }

            if (isJsonOutput) await this.readPromptInJson(promptId);
            else if (showAll) await this.readPromptWithoutPagination(promptId);
            else await this.readPromptInDisplay(promptId, isInteractive);
        });
    }

    @Option({ flags: '--prompt <promptId>', description: PROMPT_UI.OPTIONS.PROMPT_ID })
    parsePrompt(val: string): string {
        return val;
    }

    @Option({ flags: '--json', description: PROMPT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--all', description: PROMPT_UI.OPTIONS.ALL })
    parseAll(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--nonInteractive', description: 'Run without prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private async readPromptInJson(promptId: string): Promise<void> {
        const promptResult = await this.promptFacade.getPromptById(Number(promptId));

        if (!promptResult.success || !promptResult.data) {
            this.writeJsonResponse({ success: false, error: `Prompt ID ${promptId} not found` });
        } else {
            this.writeJsonResponse({ success: true, data: promptResult.data });
        }
    }

    private async readPromptWithoutPagination(promptId: string): Promise<void> {
        const promptDetails = await this.getPromptDetailsInternal(promptId);

        if (!promptDetails) return;

        await this.displayFormattedPromptInternal(promptDetails, { showFull: true, showControls: false });
    }

    private async readPromptInDisplay(promptId: string, isInteractive: boolean): Promise<void> {
        const promptDetails = await this.getPromptDetailsInternal(promptId);

        if (!promptDetails) return;

        await this.displayFormattedPromptInternal(promptDetails, { showFull: false, showControls: isInteractive });

        if (isInteractive) {
            await this.handleInteractiveControls(promptDetails);
        }
    }

    private async getPromptDetailsInternal(promptId: string): Promise<PromptMetadata | null> {
        const promptResult = await this.promptFacade.getPromptById(Number(promptId));

        if (!promptResult.success || !promptResult.data) {
            this.loggerService.error(`Could not find prompt ID: ${promptId}`);
            return null;
        }
        return promptResult.data;
    }

    private async displayFormattedPromptInternal(
        prompt: PromptMetadata,
        options: { showFull: boolean; showControls: boolean }
    ): Promise<void> {
        const promptFiles = await this.promptFacade.getPromptFiles(prompt.id || '');
        const content = promptFiles?.promptContent || '';
        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader(
            `${PROMPT_UI.SECTION_HEADER.READ}: ${prompt.title}`,
            PROMPT_UI.SECTION_HEADER.READ_ICON
        );
        this.loggerService.info(`${PROMPT_UI.LABELS.CATEGORY} ${prompt.primary_category}`);
        this.loggerService.info(`${PROMPT_UI.LABELS.DESCRIPTION} ${prompt.one_line_description}`);
        this.loggerService.info(`${PROMPT_UI.LABELS.DIRECTORY} ${prompt.directory}`);

        if (prompt.variables?.length > 0) {
            this.loggerService.info(`\n${PROMPT_UI.LABELS.VARIABLES}`);
            prompt.variables.forEach((variable) => {
                const required = !variable.optional_for_user ? PROMPT_UI.LABELS.REQUIRED : '';
                this.loggerService.info(`- ${variable.name}${required}: ${variable.role || ''}`);

                if (variable.value)
                    this.loggerService.info(
                        `  ${PROMPT_UI.LABELS.CURRENT_VALUE} ${variable.value.substring(0, 50)}...`
                    );
            });
        }

        this.loggerService.info(`\n${PROMPT_UI.LABELS.CONTENT}`);
        this.uiFacade.printSeparator();

        if (options.showFull) {
            this.loggerService.info(content);
        } else {
            const lines = content.split('\n');
            const pageSize = process.stdout.rows - 20;
            this.loggerService.info(lines.slice(0, pageSize).join('\n'));

            if (lines.length > pageSize && options.showControls) {
                this.loggerService.info(`\n${PROMPT_UI.HINTS.PAGINATION_HINT}`);
            }
        }

        this.uiFacade.printSeparator();
    }

    private async handleInteractiveControls(prompt: PromptMetadata): Promise<void> {
        if (!prompt.id) {
            this.loggerService.error('Prompt ID missing.');
            return;
        }

        const action = await this.selectMenu(PROMPT_UI.MENU.ACTION_PROMPT, [
            { name: PROMPT_UI.LABELS.EXECUTE, value: PROMPT_UI.ACTIONS.EXECUTE },
            { name: PROMPT_UI.LABELS.EDIT, value: PROMPT_UI.ACTIONS.EDIT },
            { name: PROMPT_UI.LABELS.VIEW_VARIABLES, value: PROMPT_UI.ACTIONS.VARIABLES }
        ]);
        switch (action) {
            case PROMPT_UI.ACTIONS.EXECUTE: {
                const execResult = await this.promptInteractionService.resolveAndExecutePrompt(this, prompt);

                if (!execResult.success) {
                    this.handleError(new Error(execResult.error), 'executing prompt');
                    await this.pressKeyToContinue();
                } else if (execResult.data) {
                    await this.promptInteractionService.manageConversationFlow(this, execResult.data);
                }

                break;
            }
            case PROMPT_UI.ACTIONS.EDIT: {
                this.loggerService.info(`Triggering update command for prompt ID: ${prompt.id}`);
                await this.updateProvider.run([], { prompt: prompt.id, nonInteractive: false });
                break;
            }
            case PROMPT_UI.ACTIONS.VARIABLES: {
                await this.promptInteractionService.managePrompt(this, {
                    id: prompt.id,
                    title: prompt.title,
                    category: prompt.primary_category,
                    primary_category: prompt.primary_category,
                    description: prompt.one_line_description || '',
                    path: prompt.directory,
                    subcategories: prompt.subcategories || []
                });
                break;
            }
        }
    }
}
