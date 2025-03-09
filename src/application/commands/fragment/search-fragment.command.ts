import { Injectable } from '@nestjs/common';
import { SubCommand, Option } from 'nest-commander';

import { FragmentBaseCommandRunner } from './base-fragment.command.runner';
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

interface IParsedSearchFragOptions {
    keyword?: string;
    json?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'search',
    description: FRAGMENT_UI.DESCRIPTIONS.SEARCH_COMMAND
})
export class SearchFragmentCommand extends FragmentBaseCommandRunner {
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
        private readonly fragmentCommandService: FragmentCommandService
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

    async run(passedParams: string[], options?: IParsedSearchFragOptions): Promise<void> {
        const opts = options || {};
        const keywordFromOpt = opts.keyword;
        const keywordFromArg = passedParams[0];
        let keyword: string | null | undefined = keywordFromOpt || keywordFromArg;
        await this.executeWithErrorHandling('searching fragments', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);

            if (!keyword && isInteractive) {
                keyword = await this.promptForKeyword();
            }

            if (!keyword) {
                this.handleMissingArguments(
                    isJsonOutput,
                    FRAGMENT_UI.ERRORS.KEYWORD_REQUIRED,
                    FRAGMENT_UI.ERRORS.KEYWORD_REQUIRED
                );
                return;
            }

            await this.performSearch(keyword, isJsonOutput, isInteractive);
        });
    }

    @Option({ flags: '--keyword <keyword>', description: FRAGMENT_UI.OPTIONS.KEYWORD })
    parseKeywordOpt(val: string): string {
        return val;
    }

    @Option({ flags: '--json', description: FRAGMENT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--nonInteractive', description: 'Run without interactive prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }

    private async promptForKeyword(): Promise<string | null> {
        this.uiFacade.clearConsole();
        this.uiFacade.printSectionHeader(
            FRAGMENT_UI.SECTION_HEADER.SEARCH_RESULTS.replace('{0}', ''),
            FRAGMENT_UI.SECTION_HEADER.SEARCH_RESULTS_ICON
        );
        const keyword = await this.getInput(FRAGMENT_UI.INPUT.SEARCH_KEYWORD, { allowCancel: true });
        return keyword?.trim() || null;
    }

    private async performSearch(keyword: string, isJsonOutput: boolean, isInteractive: boolean): Promise<void> {
        const matchingFragments = await this.searchFragments(keyword, isJsonOutput);

        if (isJsonOutput || matchingFragments.length === 0) {
            if (matchingFragments.length === 0 && !isJsonOutput) {
                if (isInteractive) {
                    const newSearch = await this.confirmAction(FRAGMENT_UI.CONFIRM.TRY_ANOTHER_SEARCH);

                    if (newSearch) {
                        const newKeyword = await this.promptForKeyword();

                        if (newKeyword) return this.performSearch(newKeyword, isJsonOutput, isInteractive);
                    }
                }
            }
            return;
        }

        if (!isInteractive) this.displaySearchResultsList(matchingFragments, keyword);
        else await this.displaySearchResultsInteractive(matchingFragments, keyword);
    }

    private displaySearchResultsList(fragments: PromptFragment[], keyword: string): void {
        const tableData = this.fragmentFacade.formatFragmentsTable(fragments);
        this.uiFacade.print(
            '\n' + FRAGMENT_UI.HINTS.FOUND_FRAGMENTS.replace('{0}', String(fragments.length)).replace('{1}', keyword),
            'info'
        );
        this.uiFacade.printSeparator();

        if (tableData.headers) this.uiFacade.print(tableData.headers);

        if (tableData.separator) this.uiFacade.print(tableData.separator);

        tableData.rows.forEach((row) => this.uiFacade.print(row));

        if (tableData.separator) this.uiFacade.print(tableData.separator);
    }

    private async displaySearchResultsInteractive(fragments: PromptFragment[], keyword: string): Promise<void> {
        let currentFragments = fragments;
        let currentKeyword = keyword;
        while (true) {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(
                FRAGMENT_UI.SECTION_HEADER.SEARCH_RESULTS.replace('{0}', currentKeyword),
                FRAGMENT_UI.SECTION_HEADER.SEARCH_RESULTS_ICON
            );
            const tableData = this.fragmentFacade.formatFragmentsTable(currentFragments);
            const tableChoices = this.uiFacade.createTableMenuChoices<PromptFragment, 'new_search'>(tableData, {
                infoText: FRAGMENT_UI.HINTS.FOUND_FRAGMENTS.replace('{0}', String(currentFragments.length)).replace(
                    '{1}',
                    currentKeyword
                ),
                extraActions: [
                    {
                        name: this.textFormatter.style(FRAGMENT_UI.LABELS.NEW_SEARCH, STYLE_TYPES.PRIMARY),
                        value: 'new_search'
                    }
                ]
            });
            const selection = await this.selectMenu<PromptFragment | 'back' | 'new_search'>(
                FRAGMENT_UI.MENU.SELECT_FRAGMENT,
                tableChoices
            );

            if (selection === 'back') return;

            if (selection === 'new_search') {
                const newKeyword = await this.promptForKeyword();

                if (newKeyword) {
                    const newSearchResults = await this.searchFragments(newKeyword, false);

                    if (newSearchResults.length > 0) {
                        currentFragments = newSearchResults;
                        currentKeyword = newKeyword;
                        continue;
                    } else {
                        await this.pressKeyToContinue();
                    }
                }
            } else if (typeof selection === 'object') {
                const needsRefresh = await this.displayFragmentContent(selection);

                if (needsRefresh) {
                    const refreshResult = await this.searchFragments(currentKeyword, false);
                    currentFragments = refreshResult;

                    if (currentFragments.length === 0) return;
                }
            }
        }
    }
}
