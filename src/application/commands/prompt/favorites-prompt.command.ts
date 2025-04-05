import { Injectable } from '@nestjs/common';
import { SubCommand, Option } from 'nest-commander';

import { PromptCommandRunner } from './base-prompt.command.runner';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { PROMPT_UI, STYLE_TYPES } from '../../../shared/constants';
import { CategoryItem } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';

interface IParsedFavoritesOptions {
    json?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'favorites',
    description: PROMPT_UI.DESCRIPTIONS.FAVORITES_COMMAND
})
export class FavoritesPromptCommand extends PromptCommandRunner {
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

    async run(passedParams: string[], options?: IParsedFavoritesOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('favorite prompts', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);

            if (isJsonOutput) {
                await this.listFavoritesInJson();
                return;
            }

            if (isInteractive) {
                await this.showFavoritesInteractive();
            } else {
                await this.listFavoritesForDisplay();
            }
        });
    }

    @Option({ flags: '--json', description: PROMPT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--nonInteractive', description: 'Run without prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private async listFavoritesInJson(): Promise<void> {
        const favorites = await this.promptFacade.getFavoritePrompts();
        this.writeJsonResponse({ success: true, data: favorites });
    }

    private async listFavoritesForDisplay(): Promise<void> {
        const favorites = await this.promptFacade.getFavoritePrompts();

        if (!favorites || favorites.length === 0) {
            this.loggerService.info(`\n${PROMPT_UI.SECTION_HEADER.FAVORITES}:`);
            this.loggerService.warn(PROMPT_UI.MESSAGES.NO_FAVORITES);
            this.loggerService.info(PROMPT_UI.HINTS.NO_FAVORITES_CLI_HINT);
            this.loggerService.info(`  ${PROMPT_UI.HINTS.FAVORITES_CLI_COMMAND}`);
            return;
        }

        this.loggerService.info(`\n${PROMPT_UI.SECTION_HEADER.FAVORITES}:`);
        this.uiFacade.printSeparator();
        const tableData = this.promptFacade.formatPromptsTable(favorites);
        this.loggerService.info(tableData.headers);
        this.uiFacade.printSeparator();
        tableData.rows.forEach((row) => this.loggerService.info(row));
        this.uiFacade.printSeparator();
        this.loggerService.info(`Total: ${favorites.length} favorite prompts\n`);
    }

    private async showFavoritesInteractive(): Promise<void> {
        let stayInFavorites = true;
        while (stayInFavorites) {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(
                PROMPT_UI.SECTION_HEADER.FAVORITES,
                PROMPT_UI.SECTION_HEADER.FAVORITES_ICON
            );
            const favorites = await this.promptFacade.getFavoritePrompts();

            if (!favorites || favorites.length === 0) {
                this.loggerService.warn(PROMPT_UI.MESSAGES.NO_FAVORITES);
                this.loggerService.info(PROMPT_UI.HINTS.NO_FAVORITES_HINT);
                await this.pressKeyToContinue();
                return;
            }

            const tableData = this.promptFacade.formatPromptsTable(favorites, { showDirectory: false });
            const tableChoices = this.promptFacade.createTableMenuChoices<CategoryItem>(tableData.itemsMap, {
                headers: tableData.headers,
                rows: tableData.rows,
                separator: tableData.separator,
                infoText: PROMPT_UI.MESSAGES.FOUND_FAVORITES.replace('{0}', String(favorites.length)),
                extraActions: [
                    {
                        name: PROMPT_UI.LABELS.REMOVE_FAVORITE,
                        value: PROMPT_UI.ACTIONS.REMOVE,
                        style: STYLE_TYPES.WARNING
                    }
                ]
            });
            const selection = await this.selectMenu<CategoryItem | 'back' | 'remove'>(
                PROMPT_UI.MENU.FAVORITE_PROMPT,
                tableChoices as any
            );

            if (selection === 'back') {
                stayInFavorites = false;
            } else if (selection === PROMPT_UI.ACTIONS.REMOVE) {
                await this.removeFavoriteInteractive(favorites);

                if (favorites.length === 0) stayInFavorites = false;
            } else if (typeof selection === 'object') {
                await this.managePrompt(selection as CategoryItem);
            }
        }
    }

    private async removeFavoriteInteractive(favorites: CategoryItem[]): Promise<void> {
        try {
            const choices = favorites.map((prompt) => ({
                name: `${prompt.title} (ID: ${prompt.id})`,
                value: prompt.id
            }));
            const promptId = await this.selectMenu<string | 'back'>(PROMPT_UI.MENU.FAVORITE_REMOVE_PROMPT, choices);

            if (promptId && promptId !== 'back') {
                const success = await this.promptFacade.removeFromFavorites(promptId);

                if (success) {
                    this.loggerService.success(PROMPT_UI.MESSAGES.PROMPT_REMOVED_FAVORITES);
                    const refreshResult = await this.promptFacade.getFavoritePrompts();
                    favorites.length = 0;

                    if (refreshResult && refreshResult.length > 0) {
                        favorites.push(...refreshResult);
                        this.loggerService.info(
                            PROMPT_UI.MESSAGES.FAVORITES_UPDATED.replace('{0}', String(refreshResult.length))
                        );
                    } else {
                        this.loggerService.info(PROMPT_UI.MESSAGES.NO_FAVORITES_REMAINING);
                    }

                    await new Promise((resolve) => setTimeout(resolve, 1000));
                } else {
                    this.loggerService.error('Failed to remove from favorites.');
                }
            } else {
                this.loggerService.info('Removal cancelled.');
            }
        } catch (error) {
            this.handleError(error, 'removing from favorites');
            await this.pressKeyToContinue();
        }
    }
}
