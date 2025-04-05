import { Anthropic } from '@anthropic-ai/sdk';
import { Injectable, Scope, Inject, forwardRef, OnModuleInit } from '@nestjs/common';

import {
    adaptAnthropicResponse,
    adaptAnthropicStreamEvent,
    AIClient,
    AIMessage,
    AIModelInfo,
    AIResponse,
    AIStreamEvent
} from '../../../shared/types';
import { ConfigService } from '../../config/services/config.service';
import { AppError } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class AnthropicClient implements AIClient, OnModuleInit {
    private client: Anthropic | null = null;

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService
    ) {}

    onModuleInit() {
        this.getClient();
    }

    private getClient(): Anthropic {
        if (!this.client) {
            const apiKeyResult = this.configService.getConfigValue('ANTHROPIC_API_KEY');

            if (!apiKeyResult.success || !apiKeyResult.data) {
                this.loggerService.error('ANTHROPIC_API_KEY is not set.');
                throw new AppError('CONFIG_ERROR', 'ANTHROPIC_API_KEY is not set.');
            }

            this.client = new Anthropic({ apiKey: apiKeyResult.data });
            this.loggerService.debug('Anthropic client initialized.');
        }
        return this.client;
    }

    async sendRequest(messages: AIMessage[]): Promise<AIResponse> {
        const client = this.getClient();
        const modelResult = this.configService.getConfigValue('ANTHROPIC_MODEL');
        const tokensResult = this.configService.getConfigValue('ANTHROPIC_MAX_TOKENS');

        if (!modelResult.success || !tokensResult.success || !modelResult.data || !tokensResult.data) {
            this.loggerService.error('Failed to retrieve Anthropic model/token config.');
            throw new AppError('CONFIG_ERROR', 'Failed to retrieve Anthropic model/token config.');
        }

        try {
            const response = await client.messages.create({
                model: modelResult.data,
                max_tokens: tokensResult.data,
                messages: messages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
            });
            return adaptAnthropicResponse(response);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error sending classic request to Anthropic API: ${message}`);
            throw new Error(`Anthropic API request failed: ${message}`);
        }
    }

    async *sendStreamingRequest(messages: AIMessage[]): AsyncGenerator<AIStreamEvent> {
        const client = this.getClient();
        const modelResult = this.configService.getConfigValue('ANTHROPIC_MODEL');
        const tokensResult = this.configService.getConfigValue('ANTHROPIC_MAX_TOKENS');

        if (!modelResult.success || !tokensResult.success || !modelResult.data || !tokensResult.data) {
            this.loggerService.error('Failed to retrieve Anthropic model/token config for streaming.');
            throw new AppError('CONFIG_ERROR', 'Failed to retrieve Anthropic model/token config for streaming.');
        }

        try {
            const stream = client.messages.stream({
                model: modelResult.data,
                max_tokens: tokensResult.data,
                messages: messages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
            });

            for await (const event of stream) {
                yield adaptAnthropicStreamEvent(event);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error sending streaming request to Anthropic API: ${message}`);
            throw new Error(`Anthropic API streaming request failed: ${message}`);
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.sendRequest([{ role: 'user', content: 'Hi' }]);
            return true;
        } catch (error) {
            this.loggerService.warn(
                `Anthropic API key validation failed: ${error instanceof Error ? error.message : String(error)}`
            );
            return false;
        }
    }

    async listAvailableModels(): Promise<AIModelInfo[]> {
        this.loggerService.debug('Returning static list of known Anthropic models.');

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
            this.loggerService.error(
                `Error listing Anthropic models (static list): ${error instanceof Error ? error.message : String(error)}`
            );
            return [];
        }
    }
}
