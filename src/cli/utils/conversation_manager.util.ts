import { handleError } from './error.util';
import { resolveInputs } from './input_resolution.util';
import { getPromptFiles } from './prompt_crud.util';
import { ApiResult } from '../../shared/types';
import { processPromptContent, updatePromptWithVariables } from '../../shared/utils/prompt_processing.util';

interface ConversationMessage {
    role: 'user' | 'assistant';
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
            const resolvedInputs = isExecuteCommand ? userInputs : await resolveInputs(userInputs);
            const updatedPromptContent = updatePromptWithVariables(promptContent, resolvedInputs);
            this.messages.push({ role: 'user', content: updatedPromptContent });

            const result = await processPromptContent(this.messages, isExecuteCommand ? false : true);

            if (typeof result === 'string') {
                this.messages.push({ role: 'assistant', content: result });
                return { success: true, data: result };
            } else {
                return { success: false, error: 'Unexpected result format' };
            }
        } catch (error) {
            handleError(error, 'initializing conversation');
            return { success: false, error: 'Failed to initialize conversation' };
        }
    }

    async continueConversation(userInput: string, useStreaming: boolean = true): Promise<ApiResult<string>> {
        try {
            this.messages.push({ role: 'user', content: userInput });
            const result = await processPromptContent(this.messages, useStreaming);

            if (typeof result === 'string') {
                this.messages.push({ role: 'user', content: result });
                return { success: true, data: result };
            } else {
                return { success: false, error: 'Unexpected result format' };
            }
        } catch (error) {
            handleError(error, 'continuing conversation');
            return { success: false, error: 'Failed to continue conversation' };
        }
    }
}
