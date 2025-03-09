import chalk from 'chalk';

import { getAIClient, AIMessage, AIClient } from './ai-client';
import { handleError } from '../../cli/utils/errors';

export function updatePromptWithVariables(content: string, variables: Record<string, string>): string {
    if (content === null || content === undefined) {
        throw new Error('Content cannot be null or undefined');
    }

    try {
        return Object.entries(variables).reduce((updatedContent, [key, value]) => {
            if (typeof value !== 'string') {
                throw new Error(`Variable value for key "${key}" must be a string`);
            }

            if (value.startsWith('<') && value.endsWith('>')) {
                if (value.includes('Fragment:')) {
                    console.warn(`Warning: Fragment reference not resolved for ${key}: ${value}`);
                } else if (value.includes('Env var not found:')) {
                    console.warn(`Warning: Environment variable not resolved for ${key}: ${value}`);
                }
            }

            const regex = new RegExp(`{{${key.replace(/[{}]/g, '')}}}`, 'g');
            return updatedContent.replace(regex, value);
        }, content);
    } catch (error) {
        handleError(error, 'processing prompt with variables');
        throw error;
    }
}

export async function processPromptContent(
    messages: AIMessage[],
    useStreaming: boolean = false,
    logging: boolean = true
): Promise<string> {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages must be a non-empty array');
    }

    try {
        if (logging) {
            console.log(chalk.blue(chalk.bold('You:')));
            console.log(messages[messages.length - 1]?.content);

            console.log(chalk.green(chalk.bold('AI:')));
        }

        const client = await getAIClient();

        if (useStreaming) {
            return await processStreamingResponse(client, messages);
        } else {
            const response = await client.sendRequest(messages);

            if (response && response.content) {
                return response.content;
            }
            return '';
        }
    } catch (error) {
        handleError(error, 'processing prompt content');
        throw error;
    }
}

async function processStreamingResponse(client: AIClient, messages: AIMessage[]): Promise<string> {
    if (!Array.isArray(messages)) {
        throw new Error('Messages must be an array');
    }

    let fullResponse = '';

    try {
        for await (const event of client.sendStreamingRequest(messages)) {
            if (event.type === 'content' && event.content) {
                fullResponse += event.content;
                process.stdout.write(event.content);
            }
        }

        process.stdout.write('\n');
    } catch (error) {
        handleError(error, 'processing CLI prompt content');
        throw error;
    }
    return fullResponse;
}
