import { Message as AnthropicMessage, MessageStreamEvent as AnthropicStreamEvent } from '@anthropic-ai/sdk/resources';
import { ChatCompletionChunk, ChatCompletion } from 'openai/resources/chat/completions';

// --- Core Interfaces & Types ---

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIResponse {
    content: string;
    model?: string;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
}

export interface AIStreamEvent {
    type: string;
    content?: string;
    error?: string;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
}

export interface AIModelInfo {
    id: string;
    name?: string;
    description?: string;
    contextWindow?: number;
}

export interface AIClient {
    sendRequest(messages: AIMessage[]): Promise<AIResponse>;
    sendStreamingRequest(messages: AIMessage[]): AsyncGenerator<AIStreamEvent>;
    validateApiKey(): Promise<boolean>;
    listAvailableModels(): Promise<AIModelInfo[]>;
}

// --- Injection Token ---

export const AI_CLIENT_TOKEN = Symbol('AIClient');

// --- Adapters (Keep here as they are tightly coupled to these types) ---

export function adaptAnthropicStreamEvent(event: AnthropicStreamEvent): AIStreamEvent {
    switch (event.type) {
        case 'message_start':
            return { type: 'start', usage: event.message.usage };
        case 'content_block_delta':
            if (event.delta?.type === 'text_delta') {
                return { type: 'content', content: event.delta.text };
            }

            break;
        case 'message_delta':
            break;
        case 'message_stop':
            return { type: 'end' };
    }
    const errorEvent = event as any;

    if (errorEvent.type === 'error' && errorEvent.error && errorEvent.error.message) {
        return { type: 'error', error: errorEvent.error.message };
    }
    return { type: event.type };
}

export function adaptAnthropicResponse(response: AnthropicMessage): AIResponse {
    const textContent =
        response.content
            ?.filter((block): block is { type: 'text'; text: string } => block.type === 'text')
            ?.map((block) => block.text)
            ?.join('') || '';
    return {
        content: textContent,
        model: response.model,
        usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens
        }
    };
}

export function adaptOpenAIStreamEvent(chunk: ChatCompletionChunk): AIStreamEvent | null {
    const delta = chunk.choices[0]?.delta;
    const finishReason = chunk.choices[0]?.finish_reason;

    if (finishReason === 'stop') {
        return { type: 'end' };
    }

    if (delta?.content) {
        return { type: 'content', content: delta.content };
    }
    return null;
}

export function adaptOpenAIResponse(response: ChatCompletion): AIResponse {
    return {
        content: response.choices[0]?.message?.content || '',
        model: response.model,
        usage: {
            input_tokens: response.usage?.prompt_tokens,
            output_tokens: response.usage?.completion_tokens
        }
    };
}
