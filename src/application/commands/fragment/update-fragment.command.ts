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
import { FRAGMENT_UI, GENERIC_ERRORS } from '../../../shared/constants';
import { FragmentEditOptions } from '../../../shared/types';
import { FragmentFacade } from '../../facades/fragment.facade';
import { SyncFacade } from '../../facades/sync.facade';
import { FragmentCommandService } from '../../services/fragment-command.service';
import { SyncCommandService } from '../../services/sync-command.service';

interface IParsedUpdateFragOptions extends FragmentEditOptions {
    category?: string;
    name?: string;
    content?: string;
    file?: string;
    nonInteractive?: boolean;
    json?: boolean;
}

@Injectable()
@SubCommand({
    name: 'update',
    description: FRAGMENT_UI.DESCRIPTIONS.UPDATE_COMMAND,
    aliases: ['edit']
})
export class UpdateFragmentCommand extends FragmentBaseCommandRunner {
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

    async run(passedParams: string[], options?: IParsedUpdateFragOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('updating fragment', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const fragmentDetails = this.processFragmentDetails(opts);
            let category = fragmentDetails?.category;
            let name = fragmentDetails?.name;

            if ((!category || !name) && this.isInteractiveMode(opts)) {
                const selectResult = await this.fragmentCommandService.selectFragmentForEditing();

                if (!selectResult.success || !selectResult.data) {
                    const errorMsg = selectResult.error || FRAGMENT_UI.WARNINGS.NO_FRAGMENT_SELECTED;

                    if (isJsonOutput) this.writeJsonResponse({ success: false, error: errorMsg });
                    else this.loggerService.warn(errorMsg);
                    return;
                }

                category = selectResult.data.category;
                name = selectResult.data.name;
            }

            if (!category || !name) {
                this.handleMissingArguments(
                    isJsonOutput,
                    'Category and name required.',
                    'Provide --category and --name.'
                );
                return;
            }

            const fragmentResult = await this.fragmentCommandService.loadFragmentForEditing(category, name);

            if (!fragmentResult.success || !fragmentResult.data) {
                const errorMsg =
                    fragmentResult.error ||
                    FRAGMENT_UI.ERRORS.FRAGMENT_NOT_FOUND.replace('{0}', category)
                        .replace('{1}', name)
                        .replace('{2}', GENERIC_ERRORS.UNKNOWN_ERROR);

                if (isJsonOutput) this.writeJsonResponse({ success: false, error: errorMsg });
                else this.loggerService.error(errorMsg);
                return;
            }

            const fragmentData = fragmentResult.data;

            if (opts.content || opts.file) {
                let newContent: string | undefined;

                if (opts.content) newContent = opts.content;
                else if (opts.file) {
                    const contentResult = await this.fsService.readFileContent(opts.file);

                    if (!contentResult.success || !contentResult.data) {
                        const errorMsg =
                            contentResult.error ||
                            FRAGMENT_UI.ERRORS.READ_FILE_FAILED.replace('{0}', opts.file).replace(
                                '{1}',
                                GENERIC_ERRORS.UNKNOWN_ERROR
                            );

                        if (isJsonOutput) this.writeJsonResponse({ success: false, error: errorMsg });
                        else this.loggerService.error(errorMsg);
                        return;
                    }

                    newContent = contentResult.data;
                }

                if (!newContent || newContent.trim() === '') {
                    const errorMsg = FRAGMENT_UI.ERRORS.EMPTY_CONTENT;

                    if (isJsonOutput) this.writeJsonResponse({ success: false, error: errorMsg });
                    else this.loggerService.error(errorMsg);
                    return;
                }

                const updateResult = await this.fragmentCommandService.updateFragment(category, name, newContent);

                if (isJsonOutput) {
                    this.writeJsonResponse({
                        success: updateResult.success,
                        error: updateResult.error,
                        data: { category, name, updated: updateResult.success }
                    });
                } else if (!updateResult.success) {
                    this.loggerService.error(
                        FRAGMENT_UI.ERRORS.UPDATE_FAILED.replace(
                            '{0}',
                            updateResult.error || GENERIC_ERRORS.UNKNOWN_ERROR
                        )
                    );
                } else {
                    await this.fragmentCommandService.trackFragmentChange(fragmentData, 'modify');
                    this.loggerService.success(
                        FRAGMENT_UI.SUCCESS.FRAGMENT_UPDATED.replace('{0}', fragmentData.category).replace(
                            '{1}',
                            fragmentData.name
                        )
                    );
                    await this.offerRemoteSync();
                }
            } else if (this.isInteractiveMode(opts)) {
                await this.editSelectedFragment(fragmentData);
            } else {
                this.handleMissingArguments(
                    isJsonOutput,
                    'Requires --content or --file in non-interactive mode.',
                    'Provide --content or --file.'
                );
            }
        });
    }

    @Option({ flags: '--category <category>', description: FRAGMENT_UI.OPTIONS.CATEGORY })
    parseCategory(val: string): string {
        return val;
    }

    @Option({ flags: '--name <n>', description: FRAGMENT_UI.OPTIONS.NAME })
    parseName(val: string): string {
        return val;
    }

    @Option({ flags: '--content <content>', description: FRAGMENT_UI.OPTIONS.CONTENT })
    parseContent(val: string): string {
        return val;
    }

    @Option({ flags: '--file <file>', description: FRAGMENT_UI.OPTIONS.FILE })
    parseFile(val: string): string {
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
}
