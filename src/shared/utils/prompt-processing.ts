import { Message } from '@anthropic-ai/sdk/resources';
import chalk from 'chalk';

import { sendAnthropicRequestClassic, sendAnthropicRequestStream } from './anthropic-client';
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

            const regex = new RegExp(`{{${key.replace(/[{}]/g, '')}}}`, 'g');
            return updatedContent.replace(regex, value);
        }, content);
    } catch (error) {
        handleError(error, 'processing prompt with variables');
        throw error;
    }
}

function extractContentFromMessage(message: Message): string {
    if (!message || !message.content || !Array.isArray(message.content) || message.content.length === 0) {
        return '';
    }
    return message.content
        .map((block) => {
            if (!block || typeof block !== 'object') {
                return '';
            }

            if (block.type === 'text') {
                return block.text || '';
            } else if (block.type === 'tool_use') {
                return `[Tool Use: ${block.name}]\nInput: ${JSON.stringify(block.input)}`;
            }
            return JSON.stringify(block);
        })
        .filter(Boolean)
        .join('\n');
}

export async function processPromptContent(
    messages: { role: string; content: string }[],
    useStreaming: boolean = false,
    logging: boolean = true
): Promise<string> {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages must be a non-empty array');
    }

    try {
        if (logging) {
            console.log(chalk.blue(chalk.bold('\nYou:')));
            console.log(messages[messages.length - 1]?.content);
            console.log(chalk.green(chalk.bold('\nAI:')));
        }

        if (useStreaming) {
            return await processStreamingResponse(messages);
        } else {
            const message = await sendAnthropicRequestClassic(messages);
            return extractContentFromMessage(message);
        }
    } catch (error) {
        handleError(error, 'processing prompt content');
        throw error;
    }
}

async function processStreamingResponse(messages: { role: string; content: string }[]): Promise<string> {
    if (!Array.isArray(messages)) {
        throw new Error('Messages must be an array');
    }

    let fullResponse = '';

    try {
        for await (const event of sendAnthropicRequestStream(messages)) {
            if (event?.type === 'content_block_delta' && event.delta) {
                if ('text' in event.delta) {
                    fullResponse += event.delta.text;
                    process.stdout.write(event.delta.text);
                } else if ('partial_json' in event.delta) {
                    fullResponse += event.delta.partial_json;
                    process.stdout.write(event.delta.partial_json);
                }
            }
        }
    } catch (error) {
        handleError(error, 'processing CLI prompt content');
        throw error;
    }
    return fullResponse;
}
