import chalk from 'chalk';

import { processCliPromptContent, resolveCliInputs } from './prompt.cli.util';
import { getPromptFiles } from './prompt.util';
import { ApiResult } from '../../shared/types';
import logger from '../../shared/utils/logger';
import { processPromptContent, processPromptWithVariables } from '../../shared/utils/prompt_operations';

export class ConversationManager {
    private conversationContext: string;
    private promptId: string;

    constructor(promptId: string) {
        this.promptId = promptId;
        this.conversationContext = '';
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
            let result: string;

            if (isExecuteCommand) {
                result = await processPromptContent(updatedPromptContent, {}, false);
            } else {
                console.log(chalk.green('\nHuman:'), updatedPromptContent);
                console.log(chalk.green('AI:'));
                result = await processCliPromptContent(updatedPromptContent, {}, true);
            }

            if (typeof result === 'string') {
                this.conversationContext = `Initial Prompt:\n${updatedPromptContent}\n\nAI: ${result}`;
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

    async continueConversation(userInput: string, useStreaming: boolean): Promise<ApiResult<string>> {
        try {
            const continuationPrompt = `${this.conversationContext}\n\nHuman: ${userInput}\n\nAI:`;
            let result: string;

            if (!useStreaming) {
                result = await processPromptContent(continuationPrompt, {}, false);
            } else {
                console.log(chalk.green('\nHuman:'), userInput);
                console.log(chalk.green('\nAI:'));
                result = await processCliPromptContent(continuationPrompt, {}, true);
                console.log();
            }

            if (typeof result === 'string') {
                this.conversationContext += `\nHuman: ${userInput}\nAI: ${result}`;
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
