import { Injectable } from '@nestjs/common';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { FileSystemService } from '../../../infrastructure/file-system/services/file-system.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { TextFormatter } from '../../../infrastructure/ui/components/text.formatter';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { EditorService } from '../../../infrastructure/ui/services/editor.service';
import { FRAGMENT_UI, STYLE_TYPES, GENERIC_ERRORS } from '../../../shared/constants';
import { PromptFragment } from '../../../shared/types';
import { FragmentFacade } from '../../facades/fragment.facade';
import { SyncFacade } from '../../facades/sync.facade';
import { SyncCommandService } from '../../services/sync-command.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

@Injectable()
export abstract class FragmentBaseCommandRunner extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        protected readonly fragmentFacade: FragmentFacade,
        protected readonly syncFacade: SyncFacade,
        protected readonly syncCommandService: SyncCommandService,
        protected readonly fsService: FileSystemService,
        protected readonly editorService: EditorService,
        protected readonly textFormatter: TextFormatter
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    protected processFragmentDetails(options: { category?: string; name?: string }): {
        category?: string;
        name?: string;
    } {
        return { category: options.category, name: options.name };
    }

    protected async selectFragment(
        promptMessage: string = FRAGMENT_UI.MENU.SELECT_FRAGMENT
    ): Promise<PromptFragment | null> {
        const fragmentsResult = await this.fragmentFacade.getAllFragments();
        const fragments = this.handleApiResultSync<PromptFragment[]>(fragmentsResult);

        if (!fragments || fragments.length === 0) {
            this.loggerService.warn(fragmentsResult.error || FRAGMENT_UI.WARNINGS.NO_FRAGMENTS_FOUND);
            return null;
        }

        const mappedFragments = fragments.map(
            (f) =>
                ({
                    id: `${f.category}/${f.name}`,
                    name: f.name,
                    category: f.category
                }) as PromptFragment
        );
        const selectedFragment = await this.selectMenu<PromptFragment | 'back'>(
            promptMessage,
            mappedFragments.map((f) => ({
                ...this.uiFacade.formatMenuItem(`${f.category} > ${f.name}`, f, STYLE_TYPES.INFO),
                disabled: false
            })),
            { includeGoBack: true }
        );

        if (selectedFragment === 'back') {
            this.loggerService.warn(FRAGMENT_UI.WARNINGS.OPERATION_CANCELLED);
            return null;
        }
        return selectedFragment as PromptFragment;
    }

    protected async offerRemoteSync(): Promise<void> {
        try {
            const doSync = await this.confirmAction(FRAGMENT_UI.CONFIRM.SYNC_REMOTE, { default: false });

            if (!doSync) {
                this.loggerService.info(FRAGMENT_UI.WARNINGS.REMOTE_SYNC_NOTE);
                return;
            }

            const syncResult = await this.syncCommandService.offerRemoteSync();

            if (!syncResult.success) {
                this.loggerService.warn(syncResult.error || GENERIC_ERRORS.UNKNOWN_ERROR);
            }
        } catch (error) {
            this.handleError(error, 'syncing fragment changes');
        }
    }

    protected async displayFragmentContent(fragment: PromptFragment): Promise<boolean | void> {
        try {
            const contentResult = await this.fragmentFacade.getFragmentContent(fragment.category, fragment.name);

            if (!contentResult.success || !contentResult.data) {
                this.loggerService.error(
                    FRAGMENT_UI.ERRORS.LOAD_CONTENT_FAILED.replace('{0}', fragment.category)
                        .replace('{1}', fragment.name)
                        .replace('{2}', contentResult.error || GENERIC_ERRORS.UNKNOWN_ERROR)
                );
                await this.pressKeyToContinue();
                return;
            }

            const content = contentResult.data;
            this.uiFacade.printSectionHeader(FRAGMENT_UI.SECTION_HEADER.FRAGMENT_DETAILS);
            this.uiFacade.print(`${FRAGMENT_UI.PROPERTIES.CATEGORY} ${fragment.category}`, STYLE_TYPES.INFO);
            this.uiFacade.print(`${FRAGMENT_UI.PROPERTIES.NAME} ${fragment.name}`, STYLE_TYPES.INFO);
            this.uiFacade.printSeparator();
            this.uiFacade.print(FRAGMENT_UI.PROPERTIES.CONTENT, STYLE_TYPES.INFO);
            this.uiFacade.print(content);
            this.uiFacade.printSeparator();
            const action = await this.selectMenu<'edit' | 'delete' | 'back'>(FRAGMENT_UI.MENU.SELECT_ACTION, [
                this.uiFacade.formatMenuItem(FRAGMENT_UI.LABELS.EDIT_FRAGMENT, 'edit', STYLE_TYPES.WARNING),
                this.uiFacade.formatMenuItem(FRAGMENT_UI.LABELS.DELETE_FRAGMENT, 'delete', STYLE_TYPES.DANGER)
            ]);

            if (action === 'edit') await this.editSelectedFragment(fragment);
            else if (action === 'delete') {
                const deleted = await this.deleteSelectedFragment(fragment);

                if (deleted) return true;
            }
            return false;
        } catch (error) {
            this.handleError(error, 'viewing fragment content');
            await this.pressKeyToContinue();
            return false;
        }
    }

    protected async editSelectedFragment(fragment: PromptFragment): Promise<void> {
        try {
            const contentResult = await this.fragmentFacade.getFragmentContent(fragment.category, fragment.name);

            if (!contentResult.success || !contentResult.data) {
                this.loggerService.error(
                    FRAGMENT_UI.ERRORS.LOAD_CONTENT_FAILED.replace('{0}', fragment.category)
                        .replace('{1}', fragment.name)
                        .replace('{2}', contentResult.error || GENERIC_ERRORS.UNKNOWN_ERROR)
                );
                return;
            }

            const content = contentResult.data;
            this.uiFacade.printSectionHeader(
                FRAGMENT_UI.SECTION_HEADER.UPDATE_FRAGMENT,
                FRAGMENT_UI.SECTION_HEADER.UPDATE_ICON
            );
            const newContent = await this.getMultilineInput(FRAGMENT_UI.INPUT.EDIT_CONTENT, content);

            if (newContent === content) {
                this.loggerService.info('No changes detected.');
                return;
            }

            const updateResult = await this.fragmentFacade.updateFragment(fragment.category, fragment.name, newContent);

            if (updateResult.success) {
                this.loggerService.success(
                    FRAGMENT_UI.SUCCESS.FRAGMENT_UPDATED.replace('{0}', fragment.category).replace('{1}', fragment.name)
                );
                await this.offerRemoteSync();
            } else {
                this.loggerService.error(
                    FRAGMENT_UI.ERRORS.UPDATE_FAILED.replace('{0}', updateResult.error || GENERIC_ERRORS.UNKNOWN_ERROR)
                );
            }
        } catch (error) {
            this.handleError(error, 'editing fragment');
        }
    }

    protected async deleteSelectedFragment(fragment: PromptFragment): Promise<boolean> {
        try {
            this.uiFacade.printSectionHeader(
                FRAGMENT_UI.SECTION_HEADER.DELETE_FRAGMENT,
                FRAGMENT_UI.SECTION_HEADER.DELETE_ICON
            );
            const confirmed = await this.confirmAction(FRAGMENT_UI.CONFIRM.DELETE_FRAGMENT, { default: false });

            if (!confirmed) {
                this.loggerService.warn(FRAGMENT_UI.WARNINGS.OPERATION_CANCELLED);
                return false;
            }

            const deleteResult = await this.fragmentFacade.deleteFragment(fragment.category, fragment.name);

            if (deleteResult.success) {
                this.loggerService.success(
                    FRAGMENT_UI.SUCCESS.FRAGMENT_DELETED.replace('{0}', fragment.category).replace('{1}', fragment.name)
                );
                await this.offerRemoteSync();
                return true;
            } else {
                this.loggerService.error(
                    FRAGMENT_UI.ERRORS.DELETE_FAILED.replace('{0}', deleteResult.error || GENERIC_ERRORS.UNKNOWN_ERROR)
                );
                return false;
            }
        } catch (error) {
            this.handleError(error, 'deleting fragment');
            return false;
        }
    }

    protected async searchFragments(keyword: string, isJsonOutput: boolean = false): Promise<PromptFragment[]> {
        const searchResult = await this.fragmentFacade.searchFragments(keyword);

        if (isJsonOutput) {
            this.writeJsonResponse({
                success: searchResult.success,
                error: searchResult.error,
                data: searchResult.data
            });
            return [];
        }

        if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
            this.loggerService.warn(FRAGMENT_UI.WARNINGS.NO_MATCHES_FOUND.replace('{0}', keyword));
            return [];
        }
        return searchResult.data;
    }

    protected formatFragmentPath(fragment: PromptFragment): string {
        return this.fragmentFacade.formatFragmentPath(fragment);
    }

    protected formatFragmentDisplay(fragment: PromptFragment): string {
        return this.fragmentFacade.formatFragmentDisplay(fragment);
    }

    abstract run(passedParams: string[], options?: Record<string, any>): Promise<void>;
}
