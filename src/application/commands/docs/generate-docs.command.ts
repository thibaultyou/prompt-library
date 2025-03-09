import { Injectable } from '@nestjs/common';
import { Command } from 'nest-commander';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { DocumentationService } from '../../services/documentation.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

@Injectable()
@Command({
    name: 'generate-docs',
    description: 'Generate README documentation based on prompt metadata.',
    aliases: ['docs', 'update-views']
})
export class GenerateDocsCommand extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        private readonly documentationService: DocumentationService
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
        await this.executeWithErrorHandling('generate-docs', async () => {
            this.loggerService.info('Starting documentation generation...');
            const result = await this.documentationService.generateDocumentation();

            if (result.success) {
                this.loggerService.success('Documentation generated successfully.');
            } else {
                this.loggerService.error(`Documentation generation failed: ${result.error || 'Unknown error'}`);
            }
        });
    }
}
