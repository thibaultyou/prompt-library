import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { StringFormatterService } from '../../../infrastructure/common/services/string-formatter.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import {
    AI_CLIENT_TOKEN,
    AIClient,
    ApiResult,
    ConversationManager,
    ConversationMessage,
    Result
} from '../../../shared/types';
import { IPromptService, IPromptServiceToken } from '../../prompt/interfaces/prompt.service.interface';
import { processPromptContent } from '../../prompt/services/prompt-processing';

@Injectable({ scope: Scope.DEFAULT })
export class ConversationService {
    constructor(
        @Inject(IPromptServiceToken)
        private readonly promptService: IPromptService,
        @Inject(forwardRef(() => StringFormatterService))
        private readonly stringFormatterService: StringFormatterService,
        @Inject(AI_CLIENT_TOKEN) private readonly aiClient: AIClient,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService
    ) {}

    public async createConversationManager(promptId: string): Promise<ApiResult<ConversationManager>> {
        try {
            const messages: ConversationMessage[] = [];
            const manager: ConversationManager = {
                promptId,
                messages,
                initializeConversation: this.initializeConversation.bind(this, promptId, messages),
                continueConversation: this.continueConversation.bind(this, messages)
            };
            this.loggerService.debug(`ConversationManager created for prompt ID: ${promptId}`);
            return Result.success(manager);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Failed to create ConversationManager for prompt ID ${promptId}: ${message}`);
            return Result.failure(`Failed to create conversation manager: ${message}`);
        }
    }

    private async initializeConversation(
        promptId: string,
        messages: ConversationMessage[],
        userInputs: Record<string, string>
    ): Promise<ApiResult<string>> {
        try {
            this.loggerService.debug(`Initializing conversation for prompt ID: ${promptId}`);
            const promptFilesResult = await this.promptService.getPromptFiles(promptId);

            if (!promptFilesResult.success || !promptFilesResult.data) {
                return Result.failure(promptFilesResult.error || 'Failed to get prompt files');
            }

            const { promptContent } = promptFilesResult.data;
            const resolvedInputs = userInputs;
            this.loggerService.debug('Using pre-resolved inputs for conversation initialization.');
            const updatedPromptContent = this.stringFormatterService.updatePromptWithVariables(
                promptContent,
                resolvedInputs
            );
            this.loggerService.debug(
                `Initial prompt content length after variable substitution: ${updatedPromptContent.length}`
            );
            messages.length = 0;
            messages.push({ role: 'user', content: updatedPromptContent });
            this.loggerService.debug('Sending initial message to AI model...');
            const isJsonMode = process.argv.includes('--json');
            const useStreaming = !isJsonMode;
            const result = await processPromptContent(messages, useStreaming, this.aiClient, true);

            if (typeof result === 'string') {
                messages.push({ role: 'assistant', content: result });
                this.loggerService.debug(`Conversation initialized. AI response length: ${result.length}`);
                return Result.success(result);
            } else {
                this.loggerService.error('Unexpected result format during conversation initialization.');
                return Result.failure('Unexpected result format from AI processing');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Failed to initialize conversation for prompt ID ${promptId}: ${message}`);
            return Result.failure(`Failed to initialize conversation: ${message}`);
        }
    }

    private async continueConversation(messages: ConversationMessage[], userInput: string): Promise<ApiResult<string>> {
        try {
            this.loggerService.debug(`Continuing conversation. User input length: ${userInput.length}`);
            messages.push({ role: 'user', content: userInput });
            this.loggerService.debug('Sending continued message to AI model...');

            const isJsonMode = process.argv.includes('--json');
            const useStreaming = !isJsonMode;
            const result = await processPromptContent(messages, useStreaming, this.aiClient, true);

            if (typeof result === 'string') {
                messages.push({ role: 'assistant', content: result });
                this.loggerService.debug(`Conversation continued. AI response length: ${result.length}`);
                return Result.success(result);
            } else {
                this.loggerService.error('Unexpected result format during conversation continuation.');
                return Result.failure('Unexpected result format from AI processing');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Failed to continue conversation: ${message}`);
            return Result.failure(`Failed to continue conversation: ${message}`);
        }
    }
}
