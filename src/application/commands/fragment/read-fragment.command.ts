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
import { FRAGMENT_UI } from '../../../shared/constants';
import { FragmentFacade } from '../../facades/fragment.facade';
import { SyncFacade } from '../../facades/sync.facade';
import { FragmentCommandService } from '../../services/fragment-command.service';
import { SyncCommandService } from '../../services/sync-command.service';

interface IParsedReadFragOptions {
    category?: string;
    name?: string;
    json?: boolean;
    nonInteractive?: boolean;
}

@Injectable()
@SubCommand({
    name: 'read',
    description: FRAGMENT_UI.DESCRIPTIONS.READ_COMMAND,
    aliases: ['view', 'get']
})
export class ReadFragmentCommand extends FragmentBaseCommandRunner {
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

    async run(passedParams: string[], options?: IParsedReadFragOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('reading fragment', async () => {
            const isJsonOutput = this.isJsonOutput(opts);
            const isInteractive = this.isInteractiveMode(opts);
            const fragmentDetails = this.processFragmentDetails(opts);
            let category = fragmentDetails?.category;
            let name = fragmentDetails?.name;

            if ((!category || !name) && isInteractive) {
                const fragment = await this.selectFragment('Select Fragment to View');

                if (!fragment) {
                    this.loggerService.warn(FRAGMENT_UI.WARNINGS.NO_FRAGMENT_SELECTED);
                    return;
                }

                category = fragment.category;
                name = fragment.name;
            }

            if (!category || !name) {
                this.handleMissingArguments(
                    isJsonOutput,
                    'Category and name required.',
                    'Provide --category and --name.'
                );
                return;
            }

            if (isJsonOutput) {
                const contentResult = await this.fragmentFacade.getFragmentContent(category, name);

                if (!contentResult.success || !contentResult.data) {
                    this.writeJsonResponse({
                        success: false,
                        error:
                            contentResult.error ||
                            FRAGMENT_UI.ERRORS.LOAD_CONTENT_FAILED.replace('{0}', category).replace('{1}', name)
                    });
                } else {
                    this.writeJsonResponse({ success: true, data: { category, name, content: contentResult.data } });
                }
            } else {
                await this.displayFragmentContent({ category, name });
            }
        });
    }

    @Option({ flags: '--category <category>', description: FRAGMENT_UI.OPTIONS.CATEGORY })
    parseCategory(val: string): string {
        return val;
    }

    @Option({ flags: '--name <name>', description: FRAGMENT_UI.OPTIONS.NAME })
    parseName(val: string): string {
        return val;
    }

    @Option({ flags: '--json', description: FRAGMENT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }

    @Option({ flags: '--nonInteractive', description: 'Run without interactive prompts', defaultValue: true })
    parseNonInteractive(val: boolean): boolean {
        return val;
    }
}
