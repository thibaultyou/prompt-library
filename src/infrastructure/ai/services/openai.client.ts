import { Injectable, Scope, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';

import {
    AIClient,
    AIMessage,
    AIResponse,
    AIStreamEvent,
    AIModelInfo,
    adaptOpenAIResponse,
    adaptOpenAIStreamEvent
} from '../../../shared/types/infrastructure';
import { ConfigService } from '../../config/services/config.service';
import { AppError } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class OpenAIClient implements AIClient, OnModuleInit {
    private client: OpenAI | null = null;

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService
    ) {}

    onModuleInit(): void {
        this.getClient();
    }

    private getClient(): OpenAI {
        if (!this.client) {
            const apiKeyResult = this.configService.getConfigValue('OPENAI_API_KEY');

            if (!apiKeyResult.success || !apiKeyResult.data) {
                this.loggerService.error('OPENAI_API_KEY is not set.');
                throw new AppError('CONFIG_ERROR', 'OPENAI_API_KEY is not set.');
            }

            if (apiKeyResult.data.trim() === '') {
                this.loggerService.error('OPENAI_API_KEY is empty.');
                throw new AppError('CONFIG_ERROR', 'OPENAI_API_KEY is empty.');
            }

            this.client = new OpenAI({ apiKey: apiKeyResult.data });
            this.loggerService.debug('OpenAI client initialized.');
        }
        return this.client;
    }

    async sendRequest(messages: AIMessage[]): Promise<AIResponse> {
        const client = this.getClient();
        const modelResult = this.configService.getConfigValue('OPENAI_MODEL');
        const tokensResult = this.configService.getConfigValue('OPENAI_MAX_TOKENS');

        if (!modelResult.success || !tokensResult.success || !modelResult.data || !tokensResult.data) {
            this.loggerService.error('Failed to retrieve OpenAI model/token config.');
            throw new AppError('CONFIG_ERROR', 'Failed to retrieve OpenAI model/token config.');
        }

        try {
            const response = await client.chat.completions.create({
                model: modelResult.data,
                max_tokens: tokensResult.data,
                messages: messages.map((msg) => ({
                    role: msg.role,
                    content: msg.content
                }))
            });
            return adaptOpenAIResponse(response);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error sending request to OpenAI API: ${message}`);
            throw new Error(`OpenAI API request failed: ${message}`);
        }
    }

    async *sendStreamingRequest(messages: AIMessage[]): AsyncGenerator<AIStreamEvent> {
        const client = this.getClient();
        const modelResult = this.configService.getConfigValue('OPENAI_MODEL');
        const tokensResult = this.configService.getConfigValue('OPENAI_MAX_TOKENS');

        if (!modelResult.success || !tokensResult.success || !modelResult.data || !tokensResult.data) {
            this.loggerService.error('Failed to retrieve OpenAI model/token config for streaming.');
            throw new AppError('CONFIG_ERROR', 'Failed to retrieve OpenAI model/token config for streaming.');
        }

        try {
            const stream = await client.chat.completions.create({
                model: modelResult.data,
                max_tokens: tokensResult.data,
                messages: messages.map((msg) => ({
                    role: msg.role,
                    content: msg.content
                })),
                stream: true
            });

            for await (const chunk of stream) {
                const adaptedEvent = adaptOpenAIStreamEvent(chunk);

                if (adaptedEvent) {
                    yield adaptedEvent;
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loggerService.error(`Error sending streaming request to OpenAI API: ${message}`);
            throw new Error(`OpenAI API streaming request failed: ${message}`);
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.sendRequest([{ role: 'user', content: 'Hi' }]);
            return true;
        } catch (error) {
            this.loggerService.warn(
                `OpenAI API key validation failed: ${error instanceof Error ? error.message : String(error)}`
            );
            return false;
        }
    }

    async listAvailableModels(): Promise<AIModelInfo[]> {
        const apiKeyResult = this.configService.getConfigValue('OPENAI_API_KEY');

        if (!apiKeyResult.success || !apiKeyResult.data || apiKeyResult.data.trim() === '') {
            this.loggerService.warn('OpenAI API key not set. Using static model list.');
            return this.getStaticModelList();
        }

        try {
            const client = this.getClient();
            const response = await client.models.list();
            const models = response.data
                .filter((model) => model.id.includes('gpt'))
                .map((model) => ({
                    id: model.id,
                    name: this.formatModelName(model.id),
                    description: '',
                    contextWindow: this.getContextWindowSize(model.id)
                }))
                .sort((a, b) => (b.contextWindow ?? 0) - (a.contextWindow ?? 0) || a.id.localeCompare(b.id));
            this.loggerService.debug(`Fetched ${models.length} models from OpenAI API.`);
            return models;
        } catch (error) {
            this.loggerService.error(
                `Error listing OpenAI models via API: ${error instanceof Error ? error.message : String(error)}`
            );
            this.loggerService.warn('Failed to fetch models from OpenAI API, falling back to static list.');
            return this.getStaticModelList();
        }
    }

    private formatModelName(modelId: string): string {
        return modelId
            .replace(/^gpt-/, 'GPT-')
            .replace(/-turbo$/, ' Turbo')
            .replace(/-preview$/, ' Preview')
            .replace(/-vision$/, ' Vision')
            .replace(/-(\d{4})-(\d{2})-(\d{2})$/, ' ($1-$2-$3)')
            .replace(/-(\d{4})$/, ' ($1)')
            .replace(/-o$/, '-o (Omni)');
    }

    private getContextWindowSize(modelId: string): number {
        if (modelId.includes('gpt-4.5')) {
            return 128000;
        } else if (modelId.includes('gpt-4o')) {
            return 128000;
        } else if (modelId.includes('gpt-4-turbo')) {
            return 128000;
        } else if (modelId.includes('gpt-4-vision')) {
            return 128000;
        } else if (modelId.includes('gpt-4')) {
            return 8192;
        } else if (modelId.includes('gpt-3.5-turbo-16k')) {
            return 16384;
        } else if (modelId.includes('gpt-3.5-turbo-0125')) {
            return 16385;
        } else if (modelId.includes('gpt-3.5')) {
            return 4096;
        }
        return 4096;
    }

    private getStaticModelList(): AIModelInfo[] {
        return [
            {
                id: 'gpt-4.5',
                name: 'GPT-4.5',
                description: 'Latest research preview with improved instruction following and reduced hallucinations.',
                contextWindow: 128000
            },
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                description: 'Multimodal model for text and vision tasks.',
                contextWindow: 128000
            },
            {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                description: 'Fast, lightweight version of GPT-4o for everyday tasks.',
                contextWindow: 128000
            },
            {
                id: 'gpt-4-turbo-2024-04-09',
                name: 'GPT-4 Turbo (Latest)',
                description: 'Latest powerful model with improved instruction following and lower cost.',
                contextWindow: 128000
            },
            {
                id: 'gpt-4-turbo',
                name: 'GPT-4 Turbo',
                description: 'Efficient model with robust performance for most tasks.',
                contextWindow: 128000
            },
            {
                id: 'gpt-4-vision',
                name: 'GPT-4 Vision',
                description: 'GPT-4 enhanced with vision capabilities for multimodal inputs.',
                contextWindow: 128000
            },
            {
                id: 'gpt-4',
                name: 'GPT-4',
                description: 'Advanced model with excellent reasoning capabilities.',
                contextWindow: 8192
            },
            {
                id: 'gpt-3.5-turbo-0125',
                name: 'GPT-3.5 Turbo (Latest)',
                description: 'Most recent GPT-3.5 Turbo model with extended context.',
                contextWindow: 16385
            },
            {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                description: 'Cost-effective model for everyday tasks.',
                contextWindow: 4096
            }
        ];
    }
}
