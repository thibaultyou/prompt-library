import { Injectable } from '@nestjs/common';
import { Command } from 'nest-commander';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService as InfraRepoService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { REPOSITORY_UI } from '../../../shared/constants';
import { RepositoryCommandService } from '../../services/repository-command.service';
import { BaseCommandRunner } from '../base/base-command.runner';

@Injectable()
@Command({
    name: 'repository',
    description: REPOSITORY_UI.DESCRIPTIONS.COMMAND
})
export class RepositoryCommand extends BaseCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        infraRepoService: InfraRepoService,
        private readonly repositoryCommandService: RepositoryCommandService,
        private readonly loggerService: LoggerService
    ) {
        super(uiFacade, errorService, infraRepoService);
    }

    async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
        await this.executeWithErrorHandling('repository command', async () => {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(REPOSITORY_UI.SECTION_HEADER.TITLE, REPOSITORY_UI.SECTION_HEADER.ICON);
            const infoResult = await this.repositoryCommandService.showRepositoryInfo();

            if (!infoResult.success) {
                await this.pressKeyToContinue();
                return;
            }

            const action = await this.selectMenu<'setup' | 'branch' | 'status' | 'back'>(REPOSITORY_UI.MENU.PROMPT, [
                { name: REPOSITORY_UI.MENU.OPTIONS.SETUP, value: 'setup' },
                { name: REPOSITORY_UI.MENU.OPTIONS.BRANCH, value: 'branch' },
                { name: REPOSITORY_UI.MENU.OPTIONS.STATUS, value: 'status' }
            ]);

            if (action === 'back') return;

            let result;

            if (action === 'setup') {
                result = await this.repositoryCommandService.setupRepositoryMenu(this);
            } else if (action === 'branch') {
                result = await this.repositoryCommandService.changeBranch(this);
            } else if (action === 'status') {
                result = await this.repositoryCommandService.displayDetailedRepositoryInfo();

                if (result.success) await this.pressKeyToContinue();
            }

            if (result && !result.success) {
                await this.pressKeyToContinue();
            }
        });
    }
}
