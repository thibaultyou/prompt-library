import { Injectable } from '@nestjs/common';
import { Command } from 'nest-commander';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { MenuCommandService } from '../../services/menu-command.service';
import { BaseCommandRunner } from '../base/base-command.runner';

@Injectable()
@Command({
    name: 'menu',
    description: 'Main interactive menu for the CLI',
    options: { isDefault: true }
})
export class MenuCommand extends BaseCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        private readonly menuCommandService: MenuCommandService,
        private readonly loggerService: LoggerService
    ) {
        super(uiFacade, errorService, repositoryService);
    }

    async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
        this.loggerService.debug('MenuCommand run: Starting main menu loop via MenuCommandService.');

        try {
            await this.menuCommandService.showMainMenu(this);
        } catch (error) {
            this.handleError(error, 'main menu execution');
        }

        this.loggerService.debug('MenuCommand run: Exiting.');
    }
}
