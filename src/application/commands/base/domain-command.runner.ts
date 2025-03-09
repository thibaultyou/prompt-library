import { Injectable } from '@nestjs/common';

import { BaseCommandRunner } from './base-command.runner';
import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';

@Injectable()
export abstract class DomainCommandRunner extends BaseCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        protected readonly loggerService: LoggerService
    ) {
        super(uiFacade, errorService, repositoryService);
    }

    protected isInteractiveMode(options: { nonInteractive?: boolean }): boolean {
        const isCI = this.isRunningInCIEnvironment();
        const nonInteractiveFlag = options?.nonInteractive === true;
        const isInteractive = !nonInteractiveFlag && !isCI;
        this.loggerService.debug(
            `isInteractiveMode check: options.nonInteractive=${options?.nonInteractive}, nonInteractiveFlag=${nonInteractiveFlag}, isCI=${isCI}, result=${isInteractive}`
        );
        return isInteractive;
    }

    protected handleMissingArguments(isJsonOutput: boolean, displayMessage: string, jsonError?: string): void {
        if (isJsonOutput) {
            this.writeJsonResponse({ success: false, error: jsonError || displayMessage });
        } else {
            this.loggerService.error(displayMessage);
        }
    }

    abstract run(passedParams: string[], options?: Record<string, any>): Promise<void>;
}
