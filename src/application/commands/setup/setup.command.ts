import { Injectable } from '@nestjs/common';
import { Command } from 'nest-commander';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { RepositoryService as InfraRepoService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { SETUP_UI } from '../../../shared/constants';
import { SetupCommandService } from '../../services/setup-command.service';
import { BaseCommandRunner } from '../base/base-command.runner';

@Injectable()
@Command({
    name: 'setup',
    description: SETUP_UI.DESCRIPTIONS.COMMAND
})
export class SetupCommand extends BaseCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        infraRepoService: InfraRepoService,
        private readonly setupCommandService: SetupCommandService
    ) {
        super(uiFacade, errorService, infraRepoService);
    }

    async run(_passedParams: string[], _options?: Record<string, any>): Promise<void> {
        await this.executeWithErrorHandling('setup command', async () => {
            const setupNeededResult = await this.setupCommandService.checkIfSetupNeeded();

            if (!setupNeededResult.success) {
                throw new Error(setupNeededResult.error || SETUP_UI.ERRORS.CHECK_FAILED);
            }

            const setupNeeded = setupNeededResult.data;

            if (!setupNeeded) {
                const confirmResult = await this.setupCommandService.confirmSetupRedo(this);

                if (!confirmResult.success) {
                    throw new Error(confirmResult.error || SETUP_UI.ERRORS.CONFIRM_REDO_FAILED);
                }

                if (!confirmResult.data) return;
            }

            const result = await this.setupCommandService.setupRepository(this);

            if (!result.success) {
                throw new Error(result.error || SETUP_UI.ERRORS.SETUP_FAILED);
            }

            await this.pressKeyToContinue();
        });
    }
}
