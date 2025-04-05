import chalk from 'chalk';

import { ErrorService } from '../../../infrastructure/error/services/error.service';
import { LoggerService } from '../../../infrastructure/logger/services/logger.service';
import { PromptVariable } from '../../../shared/types';
import { AIClient, AIMessage } from '../../../shared/types/infrastructure';

export async function processPromptContent(
    messages: AIMessage[],
    useStreaming: boolean = false,
    aiClient: AIClient,
    logOutput: boolean = true,
    errorService?: ErrorService,
    loggerService?: LoggerService
): Promise<string> {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages must be a non-empty array');
    }

    try {
        const isJsonMode = process.argv.includes('--json');
        const shouldLog = !isJsonMode && logOutput;

        if (shouldLog && messages.length > 0 && messages[messages.length - 1]?.role === 'user') {
            console.log(chalk.blue(chalk.bold('\nYou:')));
            console.log(messages[messages.length - 1].content);
            console.log(chalk.green(chalk.bold('\nAI:')));
        }

        let responseContent = '';

        if (useStreaming && shouldLog) {
            responseContent = await processStreamingResponse(aiClient, messages, loggerService);
        } else {
            const response = await aiClient.sendRequest(messages);

            if (response && response.content) {
                responseContent = response.content;

                if (shouldLog) {
                    process.stdout.write(responseContent + '\n');
                }
            }
        }
        return responseContent;
    } catch (error) {
        if (errorService) {
            errorService.handleError(error, 'processing prompt content');
        } else {
            console.error('Error processing prompt content:', error);
        }

        throw error;
    }
}

async function processStreamingResponse(
    client: AIClient,
    messages: AIMessage[],
    loggerService?: LoggerService
): Promise<string> {
    if (!Array.isArray(messages)) throw new Error('Messages must be an array');

    let fullResponse = '';

    try {
        for await (const event of client.sendStreamingRequest(messages)) {
            if (event.type === 'content' && event.content) {
                fullResponse += event.content;
                process.stdout.write(event.content);
            } else if (event.type === 'error') {
                loggerService?.error(`Streaming error: ${event.error}`);
            }
        }
        process.stdout.write('\n');
    } catch (error) {
        console.error('Error processing streaming response:', error);
        throw error;
    }
    return fullResponse;
}

export function extractVariablesFromPrompt(content: string): PromptVariable[] {
    const variableRegex = /\{\{([A-Z0-9_]+)\}\}/g;
    const variables: PromptVariable[] = [];
    const found = new Set<string>();
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
        const varName = match[1];

        if (!found.has(varName)) {
            found.add(varName);
            variables.push({
                name: `{{${varName}}}`,
                role: `Value for ${varName.toLowerCase().replace(/_/g, ' ')}`,
                optional_for_user: false
            });
        }
    }
    return variables;
}

export function updatePromptWithVariables(
    content: string,
    variables: Record<string, string>,
    loggerService?: LoggerService
): string {
    if (content === null || content === undefined) {
        throw new Error('Content cannot be null or undefined for variable substitution.');
    }

    loggerService?.debug(`Substituting variables. Provided: ${Object.keys(variables).join(', ')}`);
    let updatedContent = content;

    for (const [key, value] of Object.entries(variables)) {
        if (typeof value !== 'string') {
            throw new Error(`Variable value for key "${key}" must be a string, received type ${typeof value}.`);
        }

        const normalizedKey = key.replace(/[{}]/g, '');
        const regex = new RegExp(`{{\\s*${normalizedKey}\\s*}}`, 'gi');
        const occurrences = (updatedContent.match(regex) || []).length;

        if (occurrences > 0) {
            loggerService?.debug(`Replacing ${occurrences}x {{${normalizedKey}}} (value len ${value.length}).`);
        }

        updatedContent = updatedContent.replace(regex, value);
    }
    const remainingVars = updatedContent.match(/\{\{([A-Z0-9_]+)\}\}/gi);

    if (remainingVars) {
        loggerService?.warn(`Unsubstituted variables remaining: ${[...new Set(remainingVars)].join(', ')}`);
    }
    return updatedContent;
}
