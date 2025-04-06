import { Injectable } from '@nestjs/common';
import { SubCommand, Option } from 'nest-commander';

import { PromptCommandRunner } from './base-prompt.command.runner';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { PROMPT_UI } from '../../../shared/constants';
import { CategoryItem } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';

interface IParsedSearchPromptOptions {
    keyword?: string;
    json?: boolean;
    contentOnly?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'search',
    description: PROMPT_UI.DESCRIPTIONS.SEARCH_COMMAND
})
export class SearchPromptCommand extends PromptCommandRunner {
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

    async run(passedParams: string[], options?: IParsedSearchPromptOptions): Promise<void> {
        const opts = options || {};
        const keywordFromOpt = opts.keyword;
        const keywordFromArg = passedParams[0];
        let keyword: string | undefined | null = keywordFromOpt || keywordFromArg;
        await this.executeWithErrorHandling('search prompts', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);

            if (!keyword && isInteractive) {
                keyword = await this.getSearchKeyword();
            }

            if (!keyword) {
                this.handleMissingArguments(
                    isJsonOutput,
                    'Search keyword required.',
                    'Provide keyword via argument or --keyword.'
                );
                return;
            }

            const searchResult = await this.promptFacade.searchPrompts(keyword);

            if (isJsonOutput) {
                this.writeJsonResponse({ success: true, data: searchResult });
                return;
            }

            if (!searchResult.length) {
                this.loggerService.warn(PROMPT_UI.MESSAGES.NO_RESULTS.replace('{0}', keyword));

                if (isInteractive) await this.handleNoResults(keyword);
                return;
            }

            if (isInteractive) await this.showSearchResultsInteractive(searchResult, keyword);
            else this.displaySearchResults(searchResult, keyword);
        });
    }

    @Option({ flags: '--keyword <keyword>', description: PROMPT_UI.OPTIONS.KEYWORD })
    parseKeywordOpt(val: string): string {
        return val;
    }

    @Option({ flags: '--json', description: PROMPT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--content-only', description: PROMPT_UI.OPTIONS.CONTENT_ONLY })
    parseContentOnly(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--nonInteractive', description: 'Run without prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private async getSearchKeyword(): Promise<string | undefined> {
        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader(PROMPT_UI.SECTION_HEADER.SEARCH, PROMPT_UI.SECTION_HEADER.SEARCH_ICON);
        const keyword = await this.getInput(PROMPT_UI.INPUT.SEARCH_KEYWORD, { allowCancel: true });
        return keyword?.trim() || undefined;
    }

    private async handleNoResults(_keyword: string): Promise<void> {
        const action = await this.selectMenu<'new_search' | 'back'>(PROMPT_UI.MENU.ACTION_PROMPT, [
            { name: PROMPT_UI.LABELS.TRY_SEARCH, value: 'new_search' }
        ]);

        if (action === 'new_search') {
            const newKeyword = await this.getSearchKeyword();

            if (newKeyword) {
                await this.run([], { keyword: newKeyword, nonInteractive: false });
            }
        }
    }

    private displaySearchResults(results: CategoryItem[], keyword: string): void {
        this.loggerService.info(
            PROMPT_UI.MESSAGES.FOUND_RESULTS.replace('{0}', results.length.toString()).replace('{1}', keyword)
        );
        const tableData = this.promptFacade.formatPromptsTable(results);
        this.loggerService.info(tableData.headers);
        this.uiFacade.printSeparator();
        tableData.rows.forEach((row) => this.loggerService.info(row));
        this.uiFacade.printSeparator();
        this.loggerService.info(PROMPT_UI.HINTS.USE_PROMPT_ID);
    }

    private async showSearchResultsInteractive(results: CategoryItem[], keyword: string): Promise<void> {
        let currentResults = results;
        const currentKeyword = keyword;
        while (true) {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(
                `${PROMPT_UI.SECTION_HEADER.SEARCH}: "${currentKeyword}"`,
                PROMPT_UI.SECTION_HEADER.SEARCH_ICON
            );
            const tableData = this.promptFacade.formatPromptsTable(currentResults);
            const tableChoices = this.uiFacade.createTableMenuChoices<CategoryItem, 'new_search'>(tableData, {
                infoText: PROMPT_UI.MESSAGES.FOUND_RESULTS.replace('{0}', String(currentResults.length)).replace(
                    '{1}',
                    currentKeyword
                ),
                extraActions: [{ name: PROMPT_UI.LABELS.NEW_SEARCH, value: 'new_search', style: 'primary' }]
            });
            const selection = await this.selectMenu<CategoryItem | 'back' | 'new_search'>(
                PROMPT_UI.MENU.SEARCH_RESULT_PROMPT,
                tableChoices
            );

            if (selection === 'back') break;
            else if (selection === 'new_search') {
                const newKeyword = await this.getSearchKeyword();

                if (newKeyword) {
                    await this.run([], { keyword: newKeyword, nonInteractive: false });
                    break;
                }
            } else if (typeof selection === 'object') {
                await this.managePrompt(selection as CategoryItem);
                const updatedResults = await this.promptFacade.searchPrompts(currentKeyword);

                if (updatedResults.length === 0) {
                    this.loggerService.warn(PROMPT_UI.MESSAGES.NO_RESULTS.replace('{0}', currentKeyword));
                    await this.pressKeyToContinue();
                    break;
                }

                currentResults = updatedResults;
            }
        }
    }
}
