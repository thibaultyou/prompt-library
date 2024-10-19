// Updated ConversationManager class

import { processCliPromptContent, resolveCliInputs } from './prompt.cli.util';
import { getPromptFiles } from './prompt.util';
import { ApiResult } from '../../shared/types';
import logger from '../../shared/utils/logger';
import { processPromptContent, processPromptWithVariables } from '../../shared/utils/prompt_operations';

interface ConversationMessage {
    role: 'human' | 'assistant';
    content: string;
}

export class ConversationManager {
    private messages: ConversationMessage[];
    private promptId: string;

    constructor(promptId: string) {
        this.promptId = promptId;
        this.messages = [];
    }

    async initializeConversation(
        userInputs: Record<string, string>,
        isExecuteCommand: boolean = false
    ): Promise<ApiResult<string>> {
        try {
            const promptFilesResult = await getPromptFiles(this.promptId);

            if (!promptFilesResult.success || !promptFilesResult.data) {
                return { success: false, error: promptFilesResult.error || 'Failed to get prompt files' };
            }

            const { promptContent } = promptFilesResult.data;
            const resolvedInputs = isExecuteCommand ? userInputs : await resolveCliInputs(userInputs);
            const updatedPromptContent = await processPromptWithVariables(promptContent, resolvedInputs);
            this.messages.push({ role: 'human', content: updatedPromptContent });

            const result = await (isExecuteCommand
                ? processPromptContent(this.messages, {}, false)
                : processCliPromptContent(this.messages, {}, true));

            if (typeof result === 'string') {
                this.messages.push({ role: 'assistant', content: result });
                return { success: true, data: result };
            } else {
                return { success: false, error: 'Unexpected result format' };
            }
        } catch (error) {
            logger.error('Error initializing conversation:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    async continueConversation(userInput: string, useStreaming: boolean = true): Promise<ApiResult<string>> {
        try {
            this.messages.push({ role: 'human', content: userInput });

            const result = useStreaming
                ? await processCliPromptContent(this.messages, {}, true)
                : await processPromptContent(this.messages, {}, false);

            if (typeof result === 'string') {
                this.messages.push({ role: 'assistant', content: result });
                return { success: true, data: result };
            } else {
                return { success: false, error: 'Unexpected result format' };
            }
        } catch (error) {
            logger.error('Error continuing conversation:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}
