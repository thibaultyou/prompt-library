import { Message } from '@anthropic-ai/sdk/resources';
import chalk from 'chalk';

import { sendAnthropicRequestClassic, sendAnthropicRequestStream } from './anthropic_client.util';
import { handleError } from '../../cli/utils/error.util';

export function updatePromptWithVariables(content: string, variables: Record<string, string>): string {
    try {
        return Object.entries(variables).reduce((updatedContent, [key, value]) => {
            const regex = new RegExp(`{{${key.replace(/{{|}}/g, '')}}}`, 'g');
            return updatedContent.replace(regex, value);
        }, content);
    } catch (error) {
        handleError(error, 'processing prompt with variables');
        throw error;
    }
}

function extractContentFromMessage(message: Message): string {
    if (!message.content || message.content.length === 0) {
        return '';
    }
    return message.content
        .map((block) => {
            if (block.type === 'text') {
                return block.text;
            } else if (block.type === 'tool_use') {
                return `[Tool Use: ${block.name}]\nInput: ${JSON.stringify(block.input)}`;
            }
            return JSON.stringify(block);
        })
        .join('\n');
}

export async function processPromptContent(
    messages: { role: string; content: string }[],
    useStreaming: boolean = false,
    logging: boolean = true
): Promise<string> {
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
    let fullResponse = '';

    try {
        for await (const event of sendAnthropicRequestStream(messages)) {
            if (event.type === 'content_block_delta' && event.delta) {
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
