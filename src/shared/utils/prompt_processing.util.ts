import { Message } from '@anthropic-ai/sdk/resources';

import { sendAnthropicRequestClassic, sendAnthropicRequestStream } from './anthropic_client.util';
import { handleError } from '../../cli/utils/error.util';

export function replaceVariables(content: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce((updatedContent, [key, value]) => {
        const regex = new RegExp(`{{${key.replace(/{{|}}/g, '')}}}`, 'g');
        return updatedContent.replace(regex, value);
    }, content);
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
    try {
        const updatedInputs = resolveInputs ? await resolveInputs(userInputs) : userInputs;
        return replaceVariables(promptContent, updatedInputs);
    } catch (error) {
        handleError(error, 'processing prompt with variables');
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
    try {
        const updatedMessages = await processMessagesWithVariables(messages, inputs, resolveInputs);

        if (useStreaming && streamHandler) {
            return await processStreamingResponse(updatedMessages, streamHandler);
        } else {
            const message = await sendAnthropicRequestClassic(updatedMessages);
            return extractContentFromMessage(message);
        }
    } catch (error) {
        handleError(error, 'processing prompt content');
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
    messages: { role: string; content: string }[],
    streamHandler: (event: any) => void
): Promise<string> {
    let fullResponse = '';

    for await (const event of sendAnthropicRequestStream(messages)) {
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
