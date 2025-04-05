import { Injectable } from '@nestjs/common';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { RepositoryService } from '../../../infrastructure/repository/services/repository.service';
import { UiFacade } from '../../../infrastructure/ui/facades/ui.facade';
import { CategoryItem, PromptVariable } from '../../../shared/types';
import { ConversationFacade } from '../../facades/conversation.facade';
import { ExecutionFacade } from '../../facades/execution.facade';
import { PromptFacade } from '../../facades/prompt.facade';
import { VariableFacade } from '../../facades/variable.facade';
import { PromptInteractionService } from '../../services/prompt-interaction.service';
import { DomainCommandRunner } from '../base/domain-command.runner';

@Injectable()
export abstract class PromptCommandRunner extends DomainCommandRunner {
    constructor(
        uiFacade: UiFacade,
        errorService: ErrorService,
        repositoryService: RepositoryService,
        loggerService: LoggerService,
        protected readonly promptFacade: PromptFacade,
        protected readonly executionFacade: ExecutionFacade,
        protected readonly variableFacade: VariableFacade,
        protected readonly conversationFacade: ConversationFacade,
        protected readonly promptInteractionService: PromptInteractionService
    ) {
        super(uiFacade, errorService, repositoryService, loggerService);
    }

    protected async loadCategories(): Promise<Record<string, CategoryItem[]>> {
        return await this.promptFacade.getAllPromptsByCategory();
    }

    protected async managePrompt(prompt: CategoryItem): Promise<void> {
        try {
            await this.promptInteractionService.managePrompt(this, prompt);
        } catch (error) {
            this.handleError(error, 'managing prompt');
            await this.pressKeyToContinue();
        }
    }

    protected async handleVariableAssignment(promptId: string, variable: PromptVariable): Promise<void> {
        try {
            await this.promptInteractionService.handleVariableAssignment(this, promptId, variable);
        } catch (error) {
            this.handleError(error, `assigning variable ${variable.name}`);
            await this.pressKeyToContinue();
        }
    }

    abstract run(passedParams: string[], options?: Record<string, any>): Promise<void>;
}
