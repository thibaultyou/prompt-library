import { Anthropic } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources';

import { AppError, handleError } from '../../cli/utils/errors';
import { getConfigValue } from '../config';
import {
    AIClient,
    AIMessage,
    AIModelInfo,
    AIResponse,
    AIStreamEvent,
    adaptAnthropicResponse,
    adaptAnthropicStreamEvent
} from './ai-client';

export class AnthropicClient implements AIClient {
    private client: Anthropic | null = null;

    private getClient(): Anthropic {
        if (!this.client) {
            const apiKey = getConfigValue('ANTHROPIC_API_KEY');

            if (!apiKey) {
                throw new AppError('CONFIG_ERROR', 'ANTHROPIC_API_KEY is not set in the environment.');
            }

            this.client = new Anthropic({ apiKey });
        }
        return this.client;
    }

    async sendRequest(messages: AIMessage[]): Promise<AIResponse> {
        const client = this.getClient();

        try {
            const response = await client.messages.create({
                model:
                    process.env.NODE_ENV === 'test' ? 'claude-3-5-sonnet-20241022' : getConfigValue('ANTHROPIC_MODEL'),
                max_tokens: process.env.NODE_ENV === 'test' ? 8000 : getConfigValue('ANTHROPIC_MAX_TOKENS'),
                messages: messages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
            });
            return adaptAnthropicResponse(response);
        } catch (error) {
            handleError(error, 'sending classic request to Anthropic API');
            throw error;
        }
    }

    async *sendStreamingRequest(messages: AIMessage[]): AsyncGenerator<AIStreamEvent> {
        const client = this.getClient();

        try {
            const stream = client.messages.stream({
                model:
                    process.env.NODE_ENV === 'test' ? 'claude-3-5-sonnet-20241022' : getConfigValue('ANTHROPIC_MODEL'),
                max_tokens: process.env.NODE_ENV === 'test' ? 8000 : getConfigValue('ANTHROPIC_MAX_TOKENS'),
                messages: messages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
            });

            for await (const event of stream) {
                yield adaptAnthropicStreamEvent(event);
            }
        } catch (error) {
            handleError(error, 'sending streaming request to Anthropic API');
            throw error;
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.sendRequest([{ role: 'user', content: 'Test request' }]);
            return true;
        } catch (error) {
            handleError(error, 'validating Anthropic API key');
            return false;
        }
    }

    async listAvailableModels(): Promise<AIModelInfo[]> {
        try {
            const models: AIModelInfo[] = [
                {
                    id: 'claude-3-7-sonnet-20250219',
                    name: 'Claude 3.7 Sonnet',
                    description: 'Our most intelligent model with toggleable extended thinking',
                    contextWindow: 200000
                },
                {
                    id: 'claude-3-5-sonnet-20241022',
                    name: 'Claude 3.5 Sonnet (Latest)',
                    description: 'Our previous most intelligent model',
                    contextWindow: 200000
                },
                {
                    id: 'claude-3-5-sonnet-20240620',
                    name: 'Claude 3.5 Sonnet (Previous)',
                    description: 'Previous version of 3.5 Sonnet',
                    contextWindow: 200000
                },
                {
                    id: 'claude-3-5-haiku-20241022',
                    name: 'Claude 3.5 Haiku',
                    description: 'Our fastest model',
                    contextWindow: 200000
                },
                {
                    id: 'claude-3-opus-20240229',
                    name: 'Claude 3 Opus',
                    description: 'Powerful model for complex tasks',
                    contextWindow: 200000
                },
                {
                    id: 'claude-3-haiku-20240307',
                    name: 'Claude 3 Haiku',
                    description: 'Fastest and most compact model for near-instant responsiveness',
                    contextWindow: 200000
                }
            ];
            return models;
        } catch (error) {
            handleError(error, 'listing Anthropic models');
            return [];
        }
    }
}

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
    if (!anthropicClient) {
        const apiKey = getConfigValue('ANTHROPIC_API_KEY');

        if (!apiKey) {
            throw new AppError('CONFIG_ERROR', 'ANTHROPIC_API_KEY is not set in the environment.');
        }

        anthropicClient = new Anthropic({ apiKey });
    }
    return anthropicClient;
}

export async function sendAnthropicRequestClassic(messages: { role: string; content: string }[]): Promise<Message> {
    const client = new AnthropicClient();

    try {
        const response = await client.sendRequest(messages);
        return {
            id: 'msg',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: response.content }],
            model: process.env.NODE_ENV === 'test' ? 'claude-3-5-sonnet-20241022' : getConfigValue('ANTHROPIC_MODEL'),
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
        } as Message;
    } catch (error) {
        handleError(error, 'sending classic request to Anthropic API');
        throw error;
    }
}

export async function* sendAnthropicRequestStream(
    messages: { role: string; content: string }[]
): AsyncGenerator<MessageStreamEvent> {
    const client = getAnthropicClient();

    try {
        const stream = client.messages.stream({
            model: process.env.NODE_ENV === 'test' ? 'claude-3-5-sonnet-20241022' : getConfigValue('ANTHROPIC_MODEL'),
            max_tokens: process.env.NODE_ENV === 'test' ? 8000 : getConfigValue('ANTHROPIC_MAX_TOKENS'),
            messages: messages.map((msg) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            }))
        });

        for await (const event of stream) {
            yield event;
        }
    } catch (error) {
        handleError(error, 'sending streaming request to Anthropic API');
        throw error;
    }
}

export async function validateAnthropicApiKey(): Promise<boolean> {
    const client = new AnthropicClient();
    return client.validateApiKey();
}
