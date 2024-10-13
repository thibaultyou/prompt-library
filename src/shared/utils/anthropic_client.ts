import { Anthropic } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources';

import logger from './logger';
import { config } from '../config';
import { commonConfig } from '../config/common.config';

/**
 * Initializes and returns an Anthropic client.
 * @throws {Error} If the ANTHROPIC_API_KEY is not set in the environment.
 * @returns {Anthropic} An initialized Anthropic client.
 */
export function initializeAnthropicClient(): Anthropic {
    const apiKey = commonConfig.ANTHROPIC_API_KEY;

    if (!apiKey) {
        logger.error('ANTHROPIC_API_KEY is not set in the environment.');
        throw new Error('ANTHROPIC_API_KEY is not set in the environment.');
    }

    logger.info('Initializing Anthropic client');
    return new Anthropic({ apiKey });
}

/**
 * Sends a request to the Anthropic API in classic mode.
 * @param {Anthropic} client - The initialized Anthropic client.
 * @param {string} prompt - The prompt to send to the API.
 * @returns {Promise<Message>} The response from the Anthropic API.
 * @throws {Error} If there's an error sending the request to the API.
 */
export async function sendAnthropicRequestClassic(client: Anthropic, prompt: string): Promise<Message> {
    try {
        logger.info('Sending classic request to Anthropic API');
        const message = await client.messages.create({
            model: commonConfig.ANTHROPIC_MODEL,
            max_tokens: commonConfig.ANTHROPIC_MAX_TOKENS,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });
        logger.info('Received classic response from Anthropic API');
        return message;
    } catch (error) {
        logger.error('Error sending classic request to Anthropic API:', error);
        throw error;
    }
}

/**
 * Sends a request to the Anthropic API in streaming mode.
 * @param {Anthropic} client - The initialized Anthropic client.
 * @param {string} prompt - The prompt to send to the API.
 * @returns {AsyncGenerator<MessageStreamEvent>} An async generator of message stream events.
 * @throws {Error} If there's an error sending the request to the API.
 */
export async function* sendAnthropicRequestStream(
    client: Anthropic,
    prompt: string
): AsyncGenerator<MessageStreamEvent> {
    try {
        logger.info('Sending streaming request to Anthropic API');
        const stream = await client.messages.stream({
            model: config.ANTHROPIC_MODEL,
            max_tokens: config.ANTHROPIC_MAX_TOKENS,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
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
        await sendAnthropicRequestClassic(client, 'Test request');
        logger.info('Anthropic API key is valid');
        return true;
    } catch (error) {
        logger.error('Failed to validate Anthropic API key:', error);
        return false;
    }
}
