import { Injectable } from '@nestjs/common';
import { Command, Option } from 'nest-commander';

import { CreatePromptCommand } from './create-prompt.command';
import { DeletePromptCommand } from './delete-prompt.command';
import { FavoritesPromptCommand } from './favorites-prompt.command';
import { ListPromptCommand } from './list-prompt.command';
import { ReadPromptCommand } from './read-prompt.command';
import { RecentPromptCommand } from './recent-prompt.command';
import { RefreshPromptMetadataCommand } from './refresh-prompt-metadata.command';
import { SearchPromptCommand } from './search-prompt.command';
import { UpdatePromptCommand } from './update-prompt.command';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { PromptInteractionOrchestratorService } from '../../services/prompt-interaction-orchestrator.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

interface IParsedPromptsOptions {
    json?: boolean;
    isInteractive?: boolean;
}

@Injectable()
@Command({
    name: 'prompt',
    description: 'Manage and browse prompts in the library',
    subCommands: [
        CreatePromptCommand,
        UpdatePromptCommand,
        DeletePromptCommand,
        RefreshPromptMetadataCommand,
        SearchPromptCommand,
        ListPromptCommand,
        ReadPromptCommand,
        FavoritesPromptCommand,
        RecentPromptCommand
    ]
})
export class PromptCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        private readonly promptInteractionOrchestratorService: PromptInteractionOrchestratorService
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    async run(passedParams: string[], options?: IParsedPromptsOptions): Promise<void> {
        const _opts = options || {};
        await this.executeWithErrorHandling('prompts command', async () => {
            await this.promptInteractionOrchestratorService.startPromptInteractionWorkflow(this);
        });
    }

    @Option({ flags: '--json', description: 'Output in JSON format' })
    parseJson(val: boolean): boolean {
        return val;
    }
}
