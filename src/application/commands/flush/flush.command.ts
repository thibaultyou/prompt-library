import { Injectable } from '@nestjs/common';
import { Command } from 'nest-commander';

import { FlushCommandService } from '../../../infrastructure/database/services/flush.service';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { FLUSH_UI } from '../../../shared/constants';
import { DomainCommandRunner } from '../base/domain-command.runner';

@Injectable()
@Command({
    name: 'flush',
    description: FLUSH_UI.DESCRIPTIONS.COMMAND
})
export class FlushCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        private readonly flushCommandService: FlushCommandService
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
        await this.executeWithErrorHandling('flush command', async () => {
            const confirmResult = await this.flushCommandService.confirmFlush(this);

            if (!confirmResult.success) {
                throw new Error(confirmResult.error || FLUSH_UI.ERRORS.CONFIRM_FLUSH_FAILED);
            }

            if (confirmResult.data) {
                const flushResult = await this.flushCommandService.performFlush();

                if (!flushResult.success) {
                    throw new Error(flushResult.error || FLUSH_UI.ERRORS.FLUSH_OPERATION_FAILED);
                }

                this.uiFacade.print(this.uiFacade.textFormatter.successMessage(FLUSH_UI.SUCCESS.FLUSH_COMPLETED));
                process.exit(0);
            } else {
                this.loggerService.info(FLUSH_UI.WARNINGS.FLUSH_CANCELLED);
            }
        });
    }
}
