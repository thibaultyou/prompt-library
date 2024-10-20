import { Anthropic } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources';

import { config, getConfigValue } from '../config';
import logger from './logger';
import { commonConfig } from '../config/common.config';

export function initializeAnthropicClient(): Anthropic {
    const apiKey = getConfigValue('ANTHROPIC_API_KEY');

    if (!apiKey) {
        logger.error('ANTHROPIC_API_KEY is not set in the environment.');
        throw new Error('ANTHROPIC_API_KEY is not set in the environment.');
    }

    logger.info('Initializing Anthropic client');
    return new Anthropic({ apiKey });
}

export async function sendAnthropicRequestClassic(
    client: Anthropic,
    messages: { role: string; content: string }[]
): Promise<Message> {
    try {
        logger.info('Sending classic request to Anthropic API');
        const message = await client.messages.create({
            model: commonConfig.ANTHROPIC_MODEL,
            max_tokens: commonConfig.ANTHROPIC_MAX_TOKENS,
            messages: messages.map((msg) => ({
                role: msg.role === 'human' ? 'user' : 'assistant',
                content: msg.content
            }))
        });
        logger.info('Received classic response from Anthropic API');
        return message;
    } catch (error) {
        logger.error('Error sending classic request to Anthropic API:', error);
        throw error;
    }
}

export async function* sendAnthropicRequestStream(
    client: Anthropic,
    messages: { role: string; content: string }[]
): AsyncGenerator<MessageStreamEvent> {
    try {
        logger.info('Sending streaming request to Anthropic API');
        const stream = client.messages.stream({
            model: config.ANTHROPIC_MODEL,
            max_tokens: config.ANTHROPIC_MAX_TOKENS,
            messages: messages.map((msg) => ({
                role: msg.role === 'human' ? 'user' : 'assistant',
                content: msg.content
            }))
        });

        for await (const event of stream) {
            yield event;
        }

        logger.info('Finished streaming response from Anthropic API');
    } catch (error) {
        logger.error('Error sending streaming request to Anthropic API:', error);
        throw error;
    }
}

/**
 * Validates the Anthropic API key by attempting to initialize a client.
 * @returns {Promise<boolean>} True if the API key is valid, false otherwise.
 */
export async function validateAnthropicApiKey(): Promise<boolean> {
    try {
        const client = initializeAnthropicClient();
        // Attempt a simple request to validate the API key
        await sendAnthropicRequestClassic(client, [{ role: 'user', content: 'Test request' }]);
        logger.info('Anthropic API key is valid');
        return true;
    } catch (error) {
        logger.error('Failed to validate Anthropic API key:', error);
        return false;
    }
}
