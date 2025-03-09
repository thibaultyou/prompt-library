import { Injectable } from '@nestjs/common';
import chalk from 'chalk';
import { SubCommand, Option } from 'nest-commander';

import { PromptCommandRunner } from './base-prompt.command.runner';
import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { PROMPT_UI } from '../../../shared/constants/ui';
import { CategoryItem, MenuItem } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';

interface IParsedListPromptOptions {
    json?: boolean;
    id?: boolean;
    all?: boolean;
    category?: boolean;
    categories?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'list',
    description: PROMPT_UI.DESCRIPTIONS.LIST_COMMAND,
    aliases: ['ls']
})
export class ListPromptCommand extends PromptCommandRunner {
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
        private readonly stringFormatterService: StringFormatterService
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

    async run(passedParams: string[], options?: IParsedListPromptOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('list prompts', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const categories = await this.loadCategories();
            const isInteractive = this.isInteractiveMode(opts);

            if (isJsonOutput) {
                if (opts.categories) await this.listAllCategoriesInJson(categories);
                else await this.listAllPromptsInJson();
                return;
            }

            if (!isInteractive) {
                if (opts.categories) await this.listAllCategoriesForDisplay(categories);
                else await this.listAllPromptsForDisplay();
                return;
            }

            if (opts.category || opts.categories) await this.browsePromptsByCategory(categories);
            else if (opts.id) await this.listPromptsSortedById();
            else await this.listAllPrompts();
        });
    }

    @Option({ flags: '--json', description: PROMPT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--id', description: PROMPT_UI.OPTIONS.ID_SORT })
    parseIdSort(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--all', description: PROMPT_UI.OPTIONS.ALL_PROMPTS, defaultValue: true })
    parseAll(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--category', description: PROMPT_UI.OPTIONS.CATEGORY_BROWSE })
    parseCategoryBrowse(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--categories', description: PROMPT_UI.OPTIONS.CATEGORIES })
    parseCategoriesList(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--nonInteractive', description: 'Run without prompts', defaultValue: true })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private async listAllPromptsInJson(): Promise<void> {
        const allPrompts = await this.promptFacade.getAllPrompts();
        this.writeJsonResponse({ success: true, data: allPrompts });
    }

    private async listAllCategoriesInJson(categories: Record<string, CategoryItem[]>): Promise<void> {
        const categoryList = Object.keys(categories).sort();
        const categoryData = categoryList.map((cat) => ({
            name: cat,
            count: categories[cat].length,
            prompts: categories[cat].map((p) => ({ id: p.id, title: p.title }))
        }));
        this.writeJsonResponse({ success: true, data: categoryData });
    }

    private async listAllPromptsForDisplay(): Promise<void> {
        const allPrompts = await this.promptFacade.getAllPrompts();
        this.loggerService.info(`\n${PROMPT_UI.SECTION_HEADER.TITLE}:`);
        this.uiFacade.printSeparator();
        const tableData = this.promptFacade.formatPromptsTable(allPrompts);
        this.loggerService.info(tableData.headers);
        this.uiFacade.printSeparator();
        tableData.rows.forEach((row) => this.loggerService.info(row));
        this.uiFacade.printSeparator();
        this.loggerService.info(`Total: ${allPrompts.length} prompts\n`);
    }

    private async listAllCategoriesForDisplay(categories: Record<string, CategoryItem[]>): Promise<void> {
        const categoryList = Object.keys(categories).sort();
        this.loggerService.info(`\n${PROMPT_UI.SECTION_HEADER.PROMPT_CATEGORIES}:`);
        this.uiFacade.printSeparator();
        this.loggerService.info(`${'Category'.padEnd(20)} ${'Count'.padEnd(10)} Example Prompts`);
        this.uiFacade.printSeparator();
        categoryList.forEach((category) => {
            const count = categories[category].length;
            let examplePrompts = '';

            if (count > 0) {
                const examples = categories[category]
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .slice(0, 3)
                    .map((p) => p.title);
                examplePrompts = examples.join(', ');

                if (count > 3) examplePrompts += ', ...';
            }

            this.loggerService.info(`${category.padEnd(20)} ${count.toString().padEnd(10)} ${examplePrompts}`);
        });
        this.uiFacade.printSeparator();
        this.loggerService.info(`Total: ${categoryList.length} categories\n`);
    }

    private async listAllPrompts(): Promise<void> {
        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader('All Prompts', '📚');
        const allPrompts = await this.promptFacade.getAllPrompts();

        if (!allPrompts || allPrompts.length === 0) {
            this.loggerService.warn('No prompts found.');
            await this.pressKeyToContinue();
            return;
        }

        const tableData = this.promptFacade.formatPromptsTable(allPrompts);
        const choices = this.promptFacade.createTableMenuChoices(tableData.itemsMap, {
            headers: tableData.headers,
            rows: tableData.rows,
            separator: tableData.separator,
            infoText: `Found ${allPrompts.length} prompts.`
        });
        type SelectionType = CategoryItem | 'back' | 'header' | 'separator' | 'info';
        const selection = await this.selectMenu<SelectionType>(
            'Select a prompt:',
            choices as MenuItem<SelectionType>[]
        );

        if (selection !== 'back' && typeof selection === 'object' && 'id' in selection) {
            await this.managePrompt(selection);
        }
    }

    private async listPromptsSortedById(): Promise<void> {
        const sortedPromptsResult = await this.promptFacade.getPromptsSortedById();

        if (!sortedPromptsResult || sortedPromptsResult.length === 0) {
            this.loggerService.warn('No prompts found.');
            return;
        }

        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader('Prompts By ID', '🔢');
        const tableData = this.promptFacade.formatPromptsTable(sortedPromptsResult, { sortById: true });
        const choices = this.promptFacade.createTableMenuChoices(tableData.itemsMap, {
            headers: tableData.headers,
            rows: tableData.rows,
            separator: tableData.separator,
            infoText: `Found ${sortedPromptsResult.length} prompts.`
        });
        type SelectionType = CategoryItem | 'back' | 'header' | 'separator' | 'info';
        const selection = await this.selectMenu<SelectionType>(
            'Select a prompt:',
            choices as MenuItem<SelectionType>[]
        );

        if (selection !== 'back' && typeof selection === 'object' && 'id' in selection) {
            await this.managePrompt(selection);
        }
    }

    private async browsePromptsByCategory(categories: Record<string, CategoryItem[]>): Promise<void> {
        while (true) {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(
                PROMPT_UI.SECTION_HEADER.PROMPT_CATEGORIES,
                PROMPT_UI.SECTION_HEADER.CATEGORIES_ICON
            );
            const categoryList = Object.keys(categories).sort();
            const categoryData = categoryList.map((cat) => ({
                name: cat,
                count: categories[cat].length,
                formatted: `${chalk.cyan(cat.padEnd(20))} ${chalk.yellow(`${categories[cat].length}`.padEnd(8))} ${
                    categories[cat].length > 0
                        ? categories[cat]
                              .slice(0, 2)
                              .map((p) => p.title)
                              .join(', ') + (categories[cat].length > 2 ? ', ...' : '')
                        : ''
                }`
            }));
            type CategoryMenuValue = 'header' | 'separator' | 'info' | 'back' | string;
            const choices: MenuItem<CategoryMenuValue>[] = [
                {
                    name: `${PROMPT_UI.TABLE.CATEGORY_HEADER.padEnd(20)} ${PROMPT_UI.TABLE.COUNT_HEADER.padEnd(8)} ${PROMPT_UI.TABLE.EXAMPLE_HEADER}`,
                    value: 'header',
                    disabled: true,
                    type: 'header'
                },
                { name: '─'.repeat(50), value: 'separator', disabled: true, type: 'separator' },
                ...categoryData.map((cat) => ({ name: cat.formatted, value: cat.name, type: 'item' as const })),
                { name: '─'.repeat(50), value: 'separator', disabled: true, type: 'separator' },
                {
                    name: PROMPT_UI.MESSAGES.FOUND_CATEGORIES.replace('{0}', String(categoryList.length)).replace(
                        '{1}',
                        String(Object.values(categories).flat().length)
                    ),
                    value: 'info',
                    disabled: true,
                    type: 'separator'
                }
            ];
            const selectedCategory = await this.selectMenu<CategoryMenuValue>(PROMPT_UI.MENU.CATEGORY_SELECT, choices, {
                includeGoBack: true
            });

            if (selectedCategory === 'back') return;

            if (selectedCategory === 'header' || selectedCategory === 'separator' || selectedCategory === 'info')
                continue;

            try {
                const category = selectedCategory as string;
                const title = `${this.stringFormatterService.formatTitleCase(category)} Prompts`;
                const categoryPrompts = categories[category];

                if (categoryPrompts.length === 0) {
                    this.loggerService.warn(PROMPT_UI.MESSAGES.NO_RESULTS.replace('{0}', category));
                    await this.pressKeyToContinue();
                    continue;
                }

                this.uiFacade.clearConsole();
                this.uiFacade.printSectionHeader(title, PROMPT_UI.SECTION_HEADER.CATEGORIES_ICON);
                const tableData = this.promptFacade.formatPromptsTable(categoryPrompts, { showDirectory: true });
                const promptChoices = this.promptFacade.createTableMenuChoices(tableData.itemsMap, {
                    headers: tableData.headers,
                    rows: tableData.rows,
                    separator: tableData.separator,
                    infoText: PROMPT_UI.MESSAGES.FOUND_PROMPTS_CATEGORY.replace(
                        '{0}',
                        String(categoryPrompts.length)
                    ).replace('{1}', category),
                    includeGoBack: false
                });
                type PromptSelectionType = CategoryItem | 'back' | 'header' | 'separator' | 'info';
                const selection = await this.selectMenu<PromptSelectionType>(
                    PROMPT_UI.MENU.PROMPT_SELECT,
                    promptChoices as MenuItem<PromptSelectionType>[]
                );

                if (selection !== 'back' && typeof selection === 'object' && 'id' in selection) {
                    await this.managePrompt(selection);
                }
            } catch (error) {
                this.handleError(error, `listing prompts in ${selectedCategory}`);
                await this.pressKeyToContinue();
            }
        }
    }
}
