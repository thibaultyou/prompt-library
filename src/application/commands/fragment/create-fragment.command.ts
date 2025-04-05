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
import { FragmentFacade } from '../../facades/fragment.facade';
import { SyncFacade } from '../../facades/sync.facade';
import { FragmentCommandService } from '../../services/fragment-command.service';
import { SyncCommandService } from '../../services/sync-command.service';

interface IParsedCreateFragOptions {
    category?: string;
    name?: string;
    nonInteractive?: boolean;
    json?: boolean;
}

@Injectable()
@SubCommand({
    name: 'create',
    description: FRAGMENT_UI.DESCRIPTIONS.CREATE_COMMAND
})
export class CreateFragmentCommand extends FragmentBaseCommandRunner {
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

    async run(passedParams: string[], options?: IParsedCreateFragOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('creating fragment', async () => {
            const fragmentDetails = this.processFragmentDetails(opts);
            const isInteractive = this.isInteractiveMode(opts);
            const fragmentDataResult = await this.fragmentCommandService.collectFragmentData({
                category: fragmentDetails.category,
                name: fragmentDetails.name,
                isInteractive
            });

            if (!fragmentDataResult.success || !fragmentDataResult.data) {
                this.loggerService.warn(
                    FRAGMENT_UI.ERRORS.CREATE_CANCELLED.replace(
                        '{0}',
                        fragmentDataResult.error || GENERIC_ERRORS.UNKNOWN_ERROR
                    )
                );

                if (fragmentDataResult._createdNewCategory && fragmentDataResult._categoryName) {
                    await this.fragmentCommandService.cleanupEmptyCategory(fragmentDataResult._categoryName);
                }
                return;
            }

            const fragmentData = fragmentDataResult.data;
            const contentResult = await this.fragmentCommandService.collectFragmentContent(fragmentData);

            if (!contentResult.success || !contentResult.data || contentResult.data.trim() === '') {
                this.loggerService.warn(
                    FRAGMENT_UI.ERRORS.EMPTY_CONTENT.replace('{0}', contentResult.error || GENERIC_ERRORS.UNKNOWN_ERROR)
                );

                if (fragmentDataResult._createdNewCategory && fragmentDataResult._categoryName) {
                    await this.fragmentCommandService.cleanupEmptyCategory(fragmentDataResult._categoryName);
                }
                return;
            }

            const fragmentContent = contentResult.data;
            const saveResult = await this.fragmentCommandService.saveFragmentContent(fragmentData, fragmentContent);

            if (!saveResult.success) {
                this.loggerService.error(
                    FRAGMENT_UI.ERRORS.SAVE_FAILED.replace('{0}', saveResult.error || 'Unknown error')
                );
                return;
            }

            await this.fragmentCommandService.trackFragmentChange(fragmentData, 'add');
            this.loggerService.success(
                FRAGMENT_UI.SUCCESS.FRAGMENT_CREATED.replace('{0}', fragmentData.category).replace(
                    '{1}',
                    fragmentData.name
                )
            );
            await this.offerRemoteSync();
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

    @Option({ flags: '--json', description: FRAGMENT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--nonInteractive', description: 'Run without interactive prompts' })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }
}
