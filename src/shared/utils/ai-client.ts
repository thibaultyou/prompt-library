import { Message as AnthropicMessage, MessageStreamEvent } from '@anthropic-ai/sdk/resources';

import { AppError } from '../../cli/utils/errors';
import { getConfigValue } from '../config';

export interface AIMessage {
    role: string;
    content: string;
}

export interface AIResponse {
    content: string;
}

export interface AIStreamEvent {
    type: string;
    content?: string;
}

export interface AIModelInfo {
    id: string;
    name?: string; // Optional display name
    description?: string; // Optional description
    contextWindow?: number; // Optional context window size
}

export interface AIClient {
    sendRequest(messages: AIMessage[]): Promise<AIResponse>;
    sendStreamingRequest(messages: AIMessage[]): AsyncGenerator<AIStreamEvent>;
    validateApiKey(): Promise<boolean>;
    listAvailableModels(): Promise<AIModelInfo[]>;
}

export async function getAIClient(): Promise<AIClient> {
    const provider = getConfigValue('MODEL_PROVIDER');

    if (provider === 'anthropic') {
        // Use dynamic import to avoid circular dependencies
        const { AnthropicClient } = await import('./anthropic-client');
        return new AnthropicClient();
    } else if (provider === 'openai') {
        const { OpenAIClient } = await import('./openai-client');
        return new OpenAIClient();
    }

    throw new AppError('CONFIG_ERROR', `Unsupported AI provider: ${provider}`);
}

export function adaptAnthropicStreamEvent(event: MessageStreamEvent): AIStreamEvent {
    if (event.type === 'content_block_delta' && event.delta && 'text' in event.delta) {
        return {
            type: 'content',
            content: event.delta.text
        };
    }
    return { type: event.type };
}

export function adaptAnthropicResponse(response: AnthropicMessage): AIResponse {
    if (response.content && response.content[0] && 'text' in response.content[0]) {
        return {
            content: response.content[0].text
        };
    }
    return { content: '' };
}
