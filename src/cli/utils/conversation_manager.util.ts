import { handleError } from './error.util';
import { resolveCliInputs } from './input_processing.util';
import { processCliPromptContent } from './input_resolution.util';
import { getPromptFiles } from './prompt_crud.util';
import { ApiResult } from '../../shared/types';
import { processPromptContent, processPromptWithVariables } from '../../shared/utils/prompt_processing.util';

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
            const resolvedInputs = isExecuteCommand ? userInputs : await resolveCliInputs(userInputs);
            const updatedPromptContent = await processPromptWithVariables(promptContent, resolvedInputs);
            this.messages.push({ role: 'user', content: updatedPromptContent });

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
            handleError(error, 'initializing conversation');
            return { success: false, error: 'Failed to initialize conversation' };
        }
    }

    async continueConversation(userInput: string, useStreaming: boolean = true): Promise<ApiResult<string>> {
        try {
            this.messages.push({ role: 'user', content: userInput });

            const result = useStreaming
                ? await processCliPromptContent(this.messages, {}, true)
                : await processPromptContent(this.messages, {}, false);

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
