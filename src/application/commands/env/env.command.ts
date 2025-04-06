import { Injectable } from '@nestjs/common';
import { Command, Option } from 'nest-commander';

import { CreateEnvCommand } from './create-env.command';
import { DeleteEnvCommand } from './delete-env.command';
import { ListEnvCommand } from './list-env.command';
import { ReadEnvCommand } from './read-env.command';
import { UpdateEnvCommand } from './update-env.command';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { ENV_UI } from '../../../shared/constants';
import { EnvCommandOptions } from '../../../shared/types/commands/env';
import { EnvInteractionOrchestratorService } from '../../services/env-interaction-orchestrator.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

interface IParsedEnvOptions extends EnvCommandOptions {
    json?: boolean;
}

@Injectable()
@Command({
    name: 'env',
    description: ENV_UI.DESCRIPTIONS.COMMAND,
    subCommands: [ListEnvCommand, CreateEnvCommand, ReadEnvCommand, UpdateEnvCommand, DeleteEnvCommand]
})
export class EnvCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        private readonly envInteractionOrchestratorService: EnvInteractionOrchestratorService
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    async run(passedParams: string[], options?: IParsedEnvOptions): Promise<void> {
        const _opts = options || {};
        await this.executeWithErrorHandling('env command', async () => {
            await this.envInteractionOrchestratorService.startEnvInteractionWorkflow(this);
        });
    }

    @Option({ flags: '--json', description: 'Output in JSON format (legacy support)' })
    parseJson(val: boolean): boolean {
        return val;
    }
}
