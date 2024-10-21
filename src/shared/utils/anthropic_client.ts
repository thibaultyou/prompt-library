import { Anthropic } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources';
import { AppError, handleError } from '../../cli/utils/error.util';
import { getConfigValue } from '../config';
import { commonConfig } from '../config/common.config';

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
    const client = getAnthropicClient();

    try {
        return await client.messages.create({
            model: commonConfig.ANTHROPIC_MODEL,
            max_tokens: commonConfig.ANTHROPIC_MAX_TOKENS,
            messages: messages.map((msg) => ({
                role: msg.role === 'human' ? 'user' : 'assistant',
                content: msg.content
            }))
        });
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
            model: commonConfig.ANTHROPIC_MODEL,
            max_tokens: commonConfig.ANTHROPIC_MAX_TOKENS,
            messages: messages.map((msg) => ({
                role: msg.role === 'human' ? 'user' : 'assistant',
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
    try {
        await sendAnthropicRequestClassic([{ role: 'user', content: 'Test request' }]);
        return true;
    } catch (error) {
        handleError(error, 'validating Anthropic API key');
        return false;
    }
}
