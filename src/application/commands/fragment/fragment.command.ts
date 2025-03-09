import { Injectable } from '@nestjs/common';
import { Command, Option } from 'nest-commander';

import { CreateFragmentCommand } from './create-fragment.command';
import { DeleteFragmentCommand } from './delete-fragment.command';
import { ListFragmentCommand } from './list-fragment.command';
import { ReadFragmentCommand } from './read-fragment.command';
import { SearchFragmentCommand } from './search-fragment.command';
import { UpdateFragmentCommand } from './update-fragment.command';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { FRAGMENT_UI } from '../../../shared/constants';
import { FragmentFacade } from '../../facades/fragment.facade';
import { FragmentInteractionOrchestratorService } from '../../services/fragment-interaction-orchestrator.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

interface IParsedFragmentsOptions {
    json?: boolean;
    isInteractive?: boolean;
}

@Injectable()
@Command({
    name: 'fragment',
    description: FRAGMENT_UI.DESCRIPTIONS.COMMAND,
    subCommands: [
        CreateFragmentCommand,
        UpdateFragmentCommand,
        DeleteFragmentCommand,
        SearchFragmentCommand,
        ListFragmentCommand,
        ReadFragmentCommand
    ]
})
export class FragmentCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        private readonly fragmentFacade: FragmentFacade,
        private readonly fragmentInteractionOrchestratorService: FragmentInteractionOrchestratorService
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    async run(passedParams: string[], options?: IParsedFragmentsOptions): Promise<void> {
        const opts = options || {};
        await this.executeWithErrorHandling('fragments command', async () => {
            const isJsonOutput = this.isJsonOutput(opts);

            if (isJsonOutput) {
                const fragmentsResult = await this.fragmentFacade.getAllFragments();

                if (fragmentsResult.success && fragmentsResult.data) {
                    this.writeJsonResponse({ success: true, data: fragmentsResult.data });
                } else {
                    this.writeJsonResponse({
                        success: false,
                        error: fragmentsResult.error || FRAGMENT_UI.ERRORS.LOAD_CONTENT_FAILED
                    });
                }
                return;
            }

            await this.fragmentInteractionOrchestratorService.startFragmentInteractionWorkflow(this);
        });
    }

    @Option({ flags: '--json', description: FRAGMENT_UI.OPTIONS.JSON_FORMAT })
    parseJson(val: boolean): boolean {
        return val;
    }
}
