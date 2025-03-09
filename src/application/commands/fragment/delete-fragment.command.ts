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
import { FragmentDeleteOptions } from '../../../shared/types';
import { FragmentFacade } from '../../facades/fragment.facade';
import { SyncFacade } from '../../facades/sync.facade';
import { FragmentCommandService } from '../../services/fragment-command.service';
import { SyncCommandService } from '../../services/sync-command.service';

interface IParsedDeleteFragOptions extends FragmentDeleteOptions {
    category?: string;
    name?: string;
    force?: boolean;
    nonInteractive?: boolean;
    json?: boolean;
}

@Injectable()
@SubCommand({
    name: 'delete',
    description: FRAGMENT_UI.DESCRIPTIONS.DELETE_COMMAND
})
export class DeleteFragmentCommand extends FragmentBaseCommandRunner {
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

    async run(passedParams: string[], options?: IParsedDeleteFragOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('deleting fragment', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const fragmentDetails = this.processFragmentDetails(opts);
            let category = fragmentDetails?.category;
            let name = fragmentDetails?.name;
            const force = opts.force || false;

            if (!category || !name) {
                const selectResult = await this.fragmentCommandService.selectFragmentForDeletion();

                if (!selectResult.success || !selectResult.data) {
                    const errorMsg = selectResult.error || FRAGMENT_UI.WARNINGS.NO_FRAGMENT_SELECTED;

                    if (isJsonOutput) this.writeJsonResponse({ success: false, error: errorMsg });
                    else this.loggerService.warn(errorMsg);
                    return;
                }

                category = selectResult.data.category;
                name = selectResult.data.name;
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
            let deleted = false;

            if (!force) {
                deleted = (await this.deleteSelectedFragment(fragmentData)) ?? false;
            } else {
                const deleteResult = await this.fragmentCommandService.deleteFragment(category, name);

                if (!deleteResult.success) {
                    const errorMsg = FRAGMENT_UI.ERRORS.DELETE_FAILED.replace(
                        '{0}',
                        deleteResult.error || GENERIC_ERRORS.UNKNOWN_ERROR
                    );

                    if (isJsonOutput)
                        this.writeJsonResponse({
                            success: false,
                            error: errorMsg,
                            data: { category, name, deleted: false }
                        });
                    else this.loggerService.error(errorMsg);
                    return;
                }

                this.loggerService.success(
                    FRAGMENT_UI.SUCCESS.FRAGMENT_DELETED.replace('{0}', fragmentData.category).replace(
                        '{1}',
                        fragmentData.name
                    )
                );
                await this.offerRemoteSync();
                deleted = true;
            }

            if (isJsonOutput) {
                this.writeJsonResponse({ success: deleted, data: { category, name, deleted } });
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

    @Option({ flags: '--force', description: FRAGMENT_UI.OPTIONS.FORCE_DELETE })
    parseForce(val: boolean): boolean {
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
