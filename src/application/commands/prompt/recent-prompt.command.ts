import { Injectable } from '@nestjs/common';
import chalk from 'chalk';
import { SubCommand, Option } from 'nest-commander';

import { PromptCommandRunner } from './base-prompt.command.runner';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { PROMPT_UI } from '../../../shared/constants';
import { CategoryItem, MenuItem } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';

interface IParsedRecentOptions {
    json?: boolean;
    limit?: string;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'recent',
    description: PROMPT_UI.DESCRIPTIONS.RECENT_COMMAND
})
export class RecentPromptCommand extends PromptCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        promptFacade: PromptFacade,
        executionFacade: ExecutionFacade,
        variableFacade: VariableFacade,
        conversationFacade: ConversationFacade,
        promptInteractionService: PromptInteractionService
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

    async run(passedParams: string[], options?: IParsedRecentOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('recent prompts', async () => {
            const limit = opts.limit ? parseInt(opts.limit, 10) : 10;

            if (isNaN(limit) || limit <= 0) {
                this.loggerService.warn('Invalid limit specified, using default 10.');
            }

            const finalLimit = isNaN(limit) || limit <= 0 ? 10 : limit;
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);
            const recentPrompts = await this.promptFacade.getRecentPrompts(finalLimit);

            if (isJsonOutput) {
                this.writeJsonResponse({ success: true, data: recentPrompts });
                return;
            }

            if (recentPrompts.length === 0) {
                this.loggerService.warn(PROMPT_UI.MESSAGES.NO_RECENT);

                if (isInteractive) await this.pressKeyToContinue();
                return;
            }

            if (isInteractive) await this.showRecentPromptsInteractive(recentPrompts);
            else this.displayRecentPrompts(recentPrompts);
        });
    }

    @Option({ flags: '--json', description: PROMPT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--limit <n>', description: PROMPT_UI.OPTIONS.LIMIT })
    parseLimit(val: string): string {
        return val;
    }

    @Option({ flags: '--nonInteractive', description: 'Run without prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private displayRecentPrompts(prompts: CategoryItem[]): void {
        this.uiFacade.printSectionHeader(PROMPT_UI.SECTION_HEADER.RECENT, PROMPT_UI.SECTION_HEADER.RECENT_ICON);
        const tableData = this.promptFacade.formatPromptsTable(prompts);
        this.loggerService.info(tableData.headers);
        this.uiFacade.printSeparator();
        tableData.rows.forEach((row) => this.loggerService.info(row));
        this.uiFacade.printSeparator();
        this.loggerService.info(PROMPT_UI.MESSAGES.FOUND_RECENT.replace('{0}', prompts.length.toString()));
    }

    private async showRecentPromptsInteractive(prompts: CategoryItem[]): Promise<void> {
        let currentPrompts = [...prompts];
        while (true) {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(PROMPT_UI.SECTION_HEADER.RECENT, PROMPT_UI.SECTION_HEADER.RECENT_ICON);
            const tableData = this.promptFacade.formatPromptsTable(currentPrompts);
            const choices = this.promptFacade.createTableMenuChoices(tableData.itemsMap, {
                headers: tableData.headers,
                rows: tableData.rows,
                separator: tableData.separator,
                infoText: PROMPT_UI.MESSAGES.FOUND_RECENT.replace('{0}', String(currentPrompts.length)),
                extraActions: [
                    { name: PROMPT_UI.LABELS.EXECUTE_AGAIN, value: PROMPT_UI.ACTIONS.EXECUTE, style: 'primary' }
                ]
            });
            const selection = await this.selectMenu<CategoryItem | 'back' | 'execute'>(
                PROMPT_UI.MENU.PROMPT_SELECT,
                choices as any
            );

            if (selection === 'back') break;
            else if (selection === PROMPT_UI.ACTIONS.EXECUTE) {
                const recentChoices: MenuItem<CategoryItem | 'back'>[] = currentPrompts.map((p) => ({
                    name: `${p.id.padEnd(4)} | ${chalk.green(p.title)} (${p.primary_category})`,
                    value: p
                }));
                const promptToExecute = await this.selectMenu<CategoryItem | 'back'>(
                    'Select prompt to execute again:',
                    recentChoices,
                    { includeGoBack: true }
                );

                if (promptToExecute !== 'back') {
                    const promptDetails = await this.promptFacade.getPromptDetails(String(promptToExecute.id));

                    if (promptDetails) {
                        const execResult = await this.promptInteractionService.resolveAndExecutePrompt(
                            this,
                            promptDetails
                        );

                        if (!execResult.success) {
                            this.handleError(new Error(execResult.error), 'executing prompt');
                            await this.pressKeyToContinue();
                        } else if (execResult.data) {
                            await this.promptInteractionService.manageConversationFlow(this, execResult.data);
                        }
                    } else {
                        this.loggerService.error(`Could not find details for prompt ID ${promptToExecute.id}`);
                        await this.pressKeyToContinue();
                    }
                }
            } else if (typeof selection === 'object') {
                await this.managePrompt(selection as CategoryItem);
                currentPrompts = await this.promptFacade.getRecentPrompts(prompts.length);

                if (currentPrompts.length === 0) break;
            }
        }
    }
}
