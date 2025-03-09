import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { ConversationService } from './conversation.service';
import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { ERROR_MESSAGES } from '../../../shared/constants';
import {
    ApiResult,
    PromptMetadata,
    ConversationManager,
    Result,
    AI_CLIENT_TOKEN,
    AIClient
} from '../../../shared/types';
import { IPromptService, IPromptServiceToken } from '../../prompt/interfaces/prompt.service.interface';
import { IPromptExecutionRepository } from '../../prompt/repositories/prompt-execution.repository.interface';
import { processPromptContent } from '../../prompt/services/prompt-processing';

@Injectable({ scope: Scope.DEFAULT })
export class ExecutionService {
    constructor(
        private readonly conversationService: ConversationService,
        @Inject(IPromptServiceToken)
        private readonly promptService: IPromptService,
        @Inject(IPromptExecutionRepository)
        private readonly promptExecRepo: IPromptExecutionRepository,
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(AI_CLIENT_TOKEN) private readonly aiClient: AIClient,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService
    ) {}

    async executePromptById(
        promptId: string,
        userInputs: Record<string, string>
    ): Promise<ApiResult<ConversationManager>> {
        try {
            this.loggerService.debug(`Core Execution: Executing prompt ID: ${promptId} with provided variables.`);
            const detailsResult = await this.promptService.getPromptById(promptId);

            if (!detailsResult.success || !detailsResult.data) {
                this.loggerService.error(`Prompt not found for ID: ${promptId}`);
                return Result.failure(detailsResult.error || ERROR_MESSAGES.PROMPT_NOT_FOUND.replace('{0}', promptId));
            }

            const details = detailsResult.data;

            try {
                await this.promptExecRepo.recordExecution(promptId);
                this.loggerService.debug(`Execution recorded for prompt ID: ${promptId}`);
            } catch (recordError) {
                this.loggerService.warn(`Failed to record execution for prompt ID ${promptId}: ${recordError}`);
            }

            this.loggerService.debug(`Creating ConversationManager for prompt ID: ${promptId}`);
            const managerResult = await this.conversationService.createConversationManager(promptId);

            if (!managerResult.success || !managerResult.data) {
                return Result.failure(`Failed to create conversation manager: ${managerResult.error}`);
            }

            const conversationManager = managerResult.data;
            this.loggerService.debug(`Initializing conversation for prompt ID: ${promptId}`);
            const initResult = await conversationManager.initializeConversation(userInputs);

            if (!initResult.success) {
                return Result.failure(`Failed to initialize conversation: ${initResult.error}`);
            }

            this.loggerService.debug(`Conversation initialized for prompt ID: ${promptId}. Returning manager.`);
            return Result.success(conversationManager);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Failed to execute prompt ID ${promptId}: ${message}`);
            return Result.failure(ERROR_MESSAGES.PROMPT_EXECUTION_FAILED.replace('{0}', message));
        }
    }

    async executePromptWithMetadata(
        promptContent: string,
        metadata: PromptMetadata,
        resolvedInputs: Record<string, string>,
        options: { isJsonMode?: boolean; isVerbose?: boolean; shouldShowFullOutput?: boolean } = {}
    ): Promise<ApiResult<string>> {
        const promptId = metadata.id || 'local_prompt';
        this.loggerService.debug(`Executing prompt "${metadata.title}" (ID: ${promptId}) directly with metadata.`);

        if (metadata.id) {
            try {
                await this.promptExecRepo.recordExecution(metadata.id);
            } catch (recordError) {
                this.loggerService.warn(`Failed to record execution for prompt ID ${metadata.id}: ${recordError}`);
            }
        }

        const { isJsonMode = false, isVerbose = false } = options;
        const updatedPromptContent = this.stringFormatterService.updatePromptWithVariables(
            promptContent,
            resolvedInputs
        );
        this.loggerService.debug(`Sending final prompt (length: ${updatedPromptContent.length}) to AI.`);
        const useStreamingForOutput = !isJsonMode && options.shouldShowFullOutput;
        const result = await processPromptContent(
            [{ role: 'user', content: updatedPromptContent }],
            false,
            this.aiClient,
            false
        );

        if (typeof result !== 'string') {
            return Result.failure('Unexpected result format from AI processing');
        }

        this.loggerService.debug(`Received AI response (length: ${result.length}).`);
        return Result.success(result);
    }
}
