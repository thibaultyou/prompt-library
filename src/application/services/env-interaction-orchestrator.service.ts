import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { ErrorService } from '../../infrastructure/error/services/error.service';
import { CommandInterface } from '../../shared/types';
import { ListEnvCommand } from '../commands/env/list-env.command';

@Injectable({ scope: Scope.DEFAULT })
export class EnvInteractionOrchestratorService {
    constructor(
        private readonly errorService: ErrorService,
        @Inject(forwardRef(() => ListEnvCommand)) private readonly listProvider: ListEnvCommand
    ) {}

    public async startEnvInteractionWorkflow(command: CommandInterface): Promise<void> {
        try {
            await this.listProvider.run([], { json: false, nonInteractive: false });
        } catch (error) {
            this.errorService.handleCommandError(error, 'env interaction workflow');
            await command.pressKeyToContinue();
        }
    }
}
