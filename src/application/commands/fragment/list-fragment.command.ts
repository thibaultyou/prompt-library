import { Injectable } from '@nestjs/common';
import { SubCommand, Option } from 'nest-commander';

import { FragmentBaseCommandRunner } from './base-fragment.command.runner';
import { CreateFragmentCommand } from './create-fragment.command';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { FileSystemService } from '../../../infrastructure/file-system/services/file-system.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { TextFormatter } from '../../../infrastructure/ui/components/text.formatter';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { EditorService } from '../../../infrastructure/ui/services/editor.service';
import { FRAGMENT_UI, STYLE_TYPES } from '../../../shared/constants';
import { PromptFragment } from '../../../shared/types';
import { FragmentFacade } from '../../facades/fragment.facade';
import { SyncFacade } from '../../facades/sync.facade';
import { FragmentCommandService } from '../../services/fragment-command.service';
import { SyncCommandService } from '../../services/sync-command.service';

interface IParsedListFragOptions {
    json?: boolean;
    category?: boolean;
    categories?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'list',
    description: FRAGMENT_UI.DESCRIPTIONS.LIST_COMMAND,
    aliases: ['ls']
})
export class ListFragmentCommand extends FragmentBaseCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        fragmentFacade: FragmentFacade,
        syncFacade: SyncFacade,
        syncCommandService: SyncCommandService,
        fsService: FileSystemService,
        editorService: EditorService,
        textFormatter: TextFormatter,
        private readonly fragmentCommandService: FragmentCommandService,
        private readonly createFragmentCmd: CreateFragmentCommand
    ) {
        super(
            uiFacade,
            errorService,
            repositoryService,
            loggerService,
            fragmentFacade,
            syncFacade,
            syncCommandService,
            fsService,
            editorService,
            textFormatter
        );
    }

    async run(passedParams: string[], options?: IParsedListFragOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('listing fragments', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);
            const fragmentsResult = await this.fragmentFacade.getAllFragments();

            if (!fragmentsResult.success || !fragmentsResult.data) {
                this.loggerService.warn(fragmentsResult.error || FRAGMENT_UI.WARNINGS.NO_FRAGMENTS_FOUND);

                if (isJsonOutput)
                    this.writeJsonResponse({
                        success: false,
                        error: fragmentsResult.error || FRAGMENT_UI.WARNINGS.NO_FRAGMENTS_FOUND
                    });
                return;
            }

            const fragments = fragmentsResult.data;

            if (fragments.length === 0) {
                this.loggerService.warn(FRAGMENT_UI.WARNINGS.NO_FRAGMENTS_FOUND);

                if (isJsonOutput) this.writeJsonResponse({ success: true, data: [] });
                return;
            }

            const fragmentsByCategory = this.groupFragmentsByCategory(fragments);

            if (isJsonOutput) {
                if (opts.categories) this.listCategoriesInJson(fragmentsByCategory);
                else this.listFragmentsInJson(fragments);
                return;
            }

            if (!isInteractive) {
                if (opts.categories) await this.listCategoriesForDisplay(fragmentsByCategory);
                else this.listAllFragmentsForDisplay(fragments);
                return;
            }

            if (opts.category || opts.categories) await this.browseFragmentsByCategory(fragmentsByCategory);
            else await this.browseAllFragments(fragments);
        });
    }

    @Option({ flags: '--json', description: FRAGMENT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--category', description: FRAGMENT_UI.OPTIONS.BROWSE_CATEGORY })
    parseCategoryBrowse(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--categories', description: FRAGMENT_UI.OPTIONS.CATEGORIES })
    parseCategoriesList(val: boolean): boolean {
        return val;
    }
    @Option({ flags: '--nonInteractive', description: 'Run without interactive prompts', defaultValue: true })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private groupFragmentsByCategory(fragments: PromptFragment[]): Record<string, PromptFragment[]> {
        return fragments.reduce(
            (acc, frag) => {
                (acc[frag.category] = acc[frag.category] || []).push(frag);
                return acc;
            },
            {} as Record<string, PromptFragment[]>
        );
    }

    private listFragmentsInJson(fragments: PromptFragment[]): void {
        const formatted = fragments.map((f) => ({ ...f, path: this.formatFragmentPath(f) }));
        this.writeJsonResponse({ success: true, data: formatted });
    }

    private listCategoriesInJson(fragmentsByCategory: Record<string, PromptFragment[]>): void {
        const data = Object.keys(fragmentsByCategory)
            .sort()
            .map((cat) => ({
                name: cat,
                count: fragmentsByCategory[cat].length,
                fragments: fragmentsByCategory[cat].map((f) => ({ name: f.name, category: f.category }))
            }));
        this.writeJsonResponse({ success: true, data });
    }

    private listAllFragmentsForDisplay(fragments: PromptFragment[]): void {
        const tableData = this.fragmentFacade.formatFragmentsTable(fragments);
        this.uiFacade.printSectionHeader(FRAGMENT_UI.SECTION_HEADER.ALL_FRAGMENTS, FRAGMENT_UI.SECTION_HEADER.ICON);
        this.uiFacade.printSeparator();

        if (tableData.headers) this.uiFacade.print(tableData.headers);

        if (tableData.separator) this.uiFacade.print(tableData.separator);

        tableData.rows.forEach((row) => this.uiFacade.print(row));

        if (tableData.separator) this.uiFacade.print(tableData.separator);

        this.uiFacade.print(FRAGMENT_UI.HINTS.TOTAL_FRAGMENTS.replace('{0}', fragments.length.toString()));
    }

    private async listCategoriesForDisplay(fragmentsByCategory: Record<string, PromptFragment[]>): Promise<void> {
        const categoryList = Object.keys(fragmentsByCategory).sort();
        const tableDataInput = categoryList.map((cat) => ({
            category: cat,
            count: fragmentsByCategory[cat].length
        }));
        const tableData = this.uiFacade.tableRenderer.formatCategoryTable(tableDataInput);
        this.uiFacade.printSectionHeader(
            FRAGMENT_UI.SECTION_HEADER.FRAGMENT_CATEGORIES,
            FRAGMENT_UI.SECTION_HEADER.CATEGORIES_ICON
        );
        this.uiFacade.printSeparator();

        if (tableData.headers) this.uiFacade.print(tableData.headers);

        if (tableData.separator) this.uiFacade.print(tableData.separator);

        tableData.rows.forEach((row) => this.uiFacade.print(row));

        if (tableData.separator) this.uiFacade.print(tableData.separator);

        this.uiFacade.print(FRAGMENT_UI.HINTS.TOTAL_CATEGORIES.replace('{0}', categoryList.length.toString()));
    }

    private async browseAllFragments(fragments: PromptFragment[]): Promise<void> {
        const sorted = [...fragments].sort((a, b) =>
            `${a.category}/${a.name}`.localeCompare(`${b.category}/${b.name}`)
        );
        await this.viewFragmentMenu(sorted);
    }

    private async browseFragmentsByCategory(fragmentsByCategory: Record<string, PromptFragment[]>): Promise<void> {
        let currentData = fragmentsByCategory;
        while (true) {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader('Fragment Categories', '📚');
            const categoryList = Object.keys(currentData).sort();
            const categoryChoices = categoryList.map((cat) => {
                const count = currentData[cat].length;
                const examples =
                    count > 0
                        ? currentData[cat]
                              .slice(0, 2)
                              .map((f) => f.name)
                              .join(', ') + (count > 2 ? ', ...' : '')
                        : this.textFormatter.dim(this.textFormatter.italic('Empty'));
                const formattedName = `${this.textFormatter.style(cat.padEnd(20), STYLE_TYPES.INFO)} ${this.textFormatter.style(`(${count})`.padEnd(8), STYLE_TYPES.WARNING)} ${examples}`;
                return { name: formattedName, value: cat };
            });
            const choices = [
                {
                    name: `${'Category'.padEnd(20)} ${'Count'.padEnd(8)} Examples`,
                    value: 'header' as const,
                    disabled: true
                },
                { name: '─'.repeat(50), value: 'separator' as const, disabled: true },
                ...categoryChoices,
                { name: '─'.repeat(50), value: 'separator' as const, disabled: true },
                this.uiFacade.formatMenuItem('Create new category', 'create_category' as const, STYLE_TYPES.SUCCESS),
                this.uiFacade.formatMenuItem('Delete a category', 'delete_category' as const, STYLE_TYPES.DANGER),
                { name: `Found ${categoryList.length} categories`, value: 'info' as const, disabled: true }
            ];
            const selected = await this.selectMenu<
                'header' | 'separator' | 'info' | 'create_category' | 'delete_category' | 'back' | string
            >('Use ↑↓ to select a category:', choices, { includeGoBack: true });

            if (selected === 'back') return;

            if (selected === 'header' || selected === 'separator' || selected === 'info') continue;

            if (selected === 'create_category') await this.createNewCategory(currentData);
            else if (selected === 'delete_category') await this.deleteCategory(currentData);
            else {
                const category = selected as string;
                const categoryFragments = currentData[category] || [];

                if (categoryFragments.length === 0) await this.handleEmptyCategory(category, currentData);
                else await this.viewFragmentMenu(categoryFragments, { category });
            }

            const refreshResult = await this.fragmentFacade.getAllFragments();
            currentData = this.groupFragmentsByCategory(refreshResult.success ? (refreshResult.data ?? []) : []);
        }
    }

    private async viewFragmentMenu(fragments: PromptFragment[], categoryInfo?: { category: string }): Promise<void> {
        let currentFragments = [...fragments];
        while (true) {
            try {
                this.uiFacade.clearConsole();

                if (categoryInfo)
                    this.uiFacade.printSectionHeader(
                        `${this.textFormatter.style(categoryInfo.category, STYLE_TYPES.INFO)} Fragments`,
                        '📚'
                    );
                else this.uiFacade.printSectionHeader('All Fragments', '🧩');

                const tableData = this.fragmentFacade.formatFragmentsTable(currentFragments);
                const tableChoices = this.uiFacade.createTableMenuChoices<PromptFragment, 'create'>(tableData, {
                    infoText: `Found ${currentFragments.length} fragments.`,
                    extraActions: [
                        {
                            name: this.textFormatter.style(
                                categoryInfo ? `Create new in '${categoryInfo.category}'` : 'Create new fragment',
                                STYLE_TYPES.SUCCESS
                            ),
                            value: 'create'
                        }
                    ]
                });
                const selected = await this.selectMenu<PromptFragment | 'back' | 'create'>(
                    'Use ↑↓ to select a fragment:',
                    tableChoices
                );

                if (selected === 'back') return;

                if (selected === 'create') {
                    await this.createFragmentCmd.run([], {
                        nonInteractive: false,
                        ...(categoryInfo ? { category: categoryInfo.category } : {})
                    });
                    const refreshResult = await this.fragmentFacade.getAllFragments();

                    if (refreshResult.success && refreshResult.data) {
                        currentFragments = categoryInfo
                            ? refreshResult.data.filter((f) => f.category === categoryInfo.category)
                            : refreshResult.data;
                    }

                    continue;
                }

                if (typeof selected === 'object') {
                    const needsRefresh = await this.displayFragmentContent(selected);

                    if (needsRefresh) {
                        const refreshResult = await this.fragmentFacade.getAllFragments();

                        if (refreshResult.success && refreshResult.data) {
                            currentFragments = categoryInfo
                                ? refreshResult.data.filter((f) => f.category === categoryInfo.category)
                                : refreshResult.data;

                            if (categoryInfo && currentFragments.length === 0) return;
                        }
                    }
                }
            } catch (error) {
                this.handleError(error, 'fragment menu display');
                await this.pressKeyToContinue();
                return;
            }
        }
    }

    private async createNewCategory(_fragmentsByCategory: Record<string, PromptFragment[]>): Promise<void> {
        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader(
            FRAGMENT_UI.SECTION_HEADER.CREATE_CATEGORY,
            FRAGMENT_UI.SECTION_HEADER.CREATE_CATEGORY_ICON
        );
        const newCategory = await this.getInput(FRAGMENT_UI.INPUT.ENTER_CATEGORY, { allowCancel: true });

        if (newCategory === null || !newCategory.trim()) {
            this.loggerService.warn(FRAGMENT_UI.ERRORS.CATEGORY_CREATE_CANCELLED);
            await this.pressKeyToContinue();
            return;
        }

        const formattedCategory = this.uiFacade.formatMessage(
            newCategory
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '')
        );
        const createResult = await this.fragmentCommandService.createCategory(formattedCategory);

        if (!createResult.success) {
            this.loggerService.error(
                FRAGMENT_UI.ERRORS.CATEGORY_NOT_FOUND.replace('{0}', formattedCategory).replace(
                    '{1}',
                    createResult.error || 'Unknown'
                )
            );
            await this.pressKeyToContinue();
            return;
        }

        this.loggerService.success(FRAGMENT_UI.SUCCESS.CATEGORY_CREATED.replace('{0}', formattedCategory));
        const createFragment = await this.confirmAction(FRAGMENT_UI.HINTS.CREATE_FRAGMENT_HINT, { default: false });

        if (createFragment) {
            await this.createFragmentCmd.run([], { category: formattedCategory, nonInteractive: false });
        }
    }

    private async deleteCategory(fragmentsByCategory: Record<string, PromptFragment[]>): Promise<void> {
        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader(
            FRAGMENT_UI.SECTION_HEADER.DELETE_CATEGORY,
            FRAGMENT_UI.SECTION_HEADER.DELETE_CATEGORY_ICON
        );
        const categoryList = Object.keys(fragmentsByCategory).sort();
        const choices = categoryList.map((cat) => ({
            name: `${this.textFormatter.style(cat.padEnd(20), STYLE_TYPES.INFO)} ${this.textFormatter.style(`(${fragmentsByCategory[cat].length} fragments)`, STYLE_TYPES.WARNING)}`,
            value: cat
        }));

        if (choices.length === 0) {
            this.loggerService.warn(FRAGMENT_UI.WARNINGS.NO_FRAGMENTS_FOUND);
            await this.pressKeyToContinue();
            return;
        }

        const selectedCategory = await this.selectMenu(FRAGMENT_UI.MENU.SELECT_CATEGORY, choices, {
            includeGoBack: true
        });

        if (selectedCategory === 'back') return;

        const fragmentCount = fragmentsByCategory[selectedCategory].length;
        const fragmentsText =
            fragmentCount > 0
                ? FRAGMENT_UI.CONFIRM.DELETE_CATEGORY_WITH_FRAGMENTS.replace('{0}', String(fragmentCount))
                : FRAGMENT_UI.CONFIRM.DELETE_EMPTY_CATEGORY;
        const message = FRAGMENT_UI.CONFIRM.DELETE_CATEGORY.replace('{0}', selectedCategory).replace(
            '{1}',
            fragmentsText
        );
        const confirm = await this.confirmAction(message, { default: false });

        if (!confirm) {
            this.loggerService.info(FRAGMENT_UI.WARNINGS.OPERATION_CANCELLED);
            return;
        }

        const deleteResult = await this.fragmentCommandService.deleteCategory(selectedCategory);

        if (deleteResult.success)
            this.loggerService.success(FRAGMENT_UI.SUCCESS.CATEGORY_DELETED.replace('{0}', selectedCategory));
        else {
            this.loggerService.error(
                deleteResult.error || FRAGMENT_UI.ERRORS.CATEGORY_NOT_FOUND.replace('{0}', selectedCategory)
            );
            await this.pressKeyToContinue();
        }
    }

    private async handleEmptyCategory(
        category: string,
        _fragmentsByCategory: Record<string, PromptFragment[]>
    ): Promise<void> {
        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader(
            `${this.textFormatter.style(category, STYLE_TYPES.INFO)} Fragments`,
            FRAGMENT_UI.SECTION_HEADER.CATEGORIES_ICON
        );
        this.uiFacade.print(FRAGMENT_UI.WARNINGS.EMPTY_CATEGORY, 'warning');
        const emptyOptions = [
            this.uiFacade.formatMenuItem(FRAGMENT_UI.LABELS.CREATE_FRAGMENT, 'create' as const, STYLE_TYPES.SUCCESS),
            this.uiFacade.formatMenuItem(FRAGMENT_UI.LABELS.DELETE_CATEGORY, 'delete' as const, STYLE_TYPES.DANGER)
        ];
        const emptyAction = await this.selectMenu(FRAGMENT_UI.MENU.WHAT_NEXT, emptyOptions);

        if (emptyAction === 'create') {
            await this.createFragmentCmd.run([], { nonInteractive: false, category });
        } else if (emptyAction === 'delete') {
            const confirm = await this.confirmAction(
                FRAGMENT_UI.CONFIRM.DELETE_CATEGORY.replace('{0}', category).replace(
                    '{1}',
                    FRAGMENT_UI.CONFIRM.DELETE_EMPTY_CATEGORY
                ),
                { default: false }
            );

            if (confirm) {
                const deleteResult = await this.fragmentCommandService.deleteCategory(category);

                if (deleteResult.success)
                    this.loggerService.success(FRAGMENT_UI.SUCCESS.CATEGORY_DELETED.replace('{0}', category));
                else {
                    this.loggerService.error(
                        FRAGMENT_UI.ERRORS.CATEGORY_NOT_FOUND.replace('{0}', category).replace(
                            '{1}',
                            deleteResult.error || 'Unknown'
                        )
                    );
                    await this.pressKeyToContinue();
                }
            }
        }
    }
}
