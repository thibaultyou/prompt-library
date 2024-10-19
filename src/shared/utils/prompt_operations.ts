import Anthropic from '@anthropic-ai/sdk';
import { Message } from '@anthropic-ai/sdk/resources';

import { initializeAnthropicClient, sendAnthropicRequestClassic, sendAnthropicRequestStream } from './anthropic_client';
import logger from './logger';

export function replaceVariables(content: string, variables: Record<string, string>): string {
    let updatedContent = content;

    for (const [key, value] of Object.entries(variables)) {
        updatedContent = updatedContent.replace(new RegExp(`{{${key.replace(/{{|}}/g, '')}}}`, 'g'), value);
    }
    return updatedContent;
}

export function extractContentFromMessage(message: Message): string {
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

export async function processPromptWithVariables(
    promptContent: string,
    userInputs: Record<string, string> = {},
    resolveInputs?: (inputs: Record<string, string>) => Promise<Record<string, string>>
): Promise<string> {
    logger.info('Processing prompt content with variables');

    try {
        const updatedInputs = resolveInputs ? await resolveInputs(userInputs) : userInputs;
        return replaceVariables(promptContent, updatedInputs);
    } catch (error) {
        logger.error('Error in processPromptWithVariables:', error);
        throw error;
    }
}

export async function processPromptContent(
    messages: { role: string; content: string }[],
    inputs: Record<string, string> = {},
    useStreaming: boolean = false,
    resolveInputs: (inputs: Record<string, string>) => Promise<Record<string, string>> = async (i) => i,
    streamHandler?: (event: any) => void
): Promise<string> {
    logger.info('Processing prompt content');
    const client = initializeAnthropicClient();
    logger.info('Anthropic client initialized');

    try {
        const updatedMessages = await processMessagesWithVariables(messages, inputs, resolveInputs);

        if (useStreaming && streamHandler) {
            return await processStreamingResponse(client, updatedMessages, streamHandler);
        } else {
            const message = await sendAnthropicRequestClassic(client, updatedMessages);
            return extractContentFromMessage(message);
        }
    } catch (error) {
        logger.error('Error in processPromptContent:', error);
        throw error;
    }
}

async function processMessagesWithVariables(
    messages: { role: string; content: string }[],
    inputs: Record<string, string>,
    resolveInputs?: (inputs: Record<string, string>) => Promise<Record<string, string>>
): Promise<{ role: string; content: string }[]> {
    const updatedInputs = resolveInputs ? await resolveInputs(inputs) : inputs;
    return messages.map((msg) => ({
        ...msg,
        content: replaceVariables(msg.content, updatedInputs)
    }));
}

async function processStreamingResponse(
    client: Anthropic,
    messages: { role: string; content: string }[],
    streamHandler: (event: any) => void
): Promise<string> {
    let fullResponse = '';

    for await (const event of sendAnthropicRequestStream(client, messages)) {
        streamHandler(event);

        if (event.type === 'content_block_delta' && event.delta) {
            if ('text' in event.delta) {
                fullResponse += event.delta.text;
            } else if ('partial_json' in event.delta) {
                fullResponse += event.delta.partial_json;
            }
        }
    }
    return fullResponse;
}
