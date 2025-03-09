import OpenAI from 'openai';

import { AppError, handleError } from '../../cli/utils/errors';
import { getConfigValue } from '../config';
import { AIClient, AIMessage, AIModelInfo, AIResponse, AIStreamEvent } from './ai-client';

export class OpenAIClient implements AIClient {
    private client: OpenAI | null = null;

    private getClient(): OpenAI {
        if (!this.client) {
            const apiKey = getConfigValue('OPENAI_API_KEY');

            if (!apiKey) {
                throw new AppError(
                    'CONFIG_ERROR',
                    'OPENAI_API_KEY is not set. Please set your OpenAI API key using the model command.'
                );
            }

            if (apiKey.trim() === '') {
                throw new AppError(
                    'CONFIG_ERROR',
                    'OPENAI_API_KEY is empty. Please set a valid OpenAI API key using the model command.'
                );
            }

            this.client = new OpenAI({ apiKey });
        }
        return this.client;
    }

    async sendRequest(messages: AIMessage[]): Promise<AIResponse> {
        const client = this.getClient();

        try {
            const response = await client.chat.completions.create({
                model: getConfigValue('OPENAI_MODEL'),
                max_tokens: getConfigValue('OPENAI_MAX_TOKENS'),
                messages: messages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
                    content: msg.content
                }))
            });
            return {
                content: response.choices[0]?.message?.content || ''
            };
        } catch (error) {
            handleError(error, 'sending request to OpenAI API');
            throw error;
        }
    }

    async *sendStreamingRequest(messages: AIMessage[]): AsyncGenerator<AIStreamEvent> {
        const client = this.getClient();

        try {
            const stream = await client.chat.completions.create({
                model: getConfigValue('OPENAI_MODEL'),
                max_tokens: getConfigValue('OPENAI_MAX_TOKENS'),
                messages: messages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
                    content: msg.content
                })),
                stream: true
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;

                if (content) {
                    yield {
                        type: 'content',
                        content
                    };
                }
            }
        } catch (error) {
            handleError(error, 'sending streaming request to OpenAI API');
            throw error;
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.sendRequest([{ role: 'user', content: 'Test request' }]);
            return true;
        } catch (error) {
            handleError(error, 'validating OpenAI API key');
            return false;
        }
    }

    async listAvailableModels(): Promise<AIModelInfo[]> {
        const apiKey = getConfigValue('OPENAI_API_KEY');

        if (!apiKey || apiKey.trim() === '') {
            console.log('OpenAI API key not set. Using static model list.');
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
                }));
            return models;
        } catch (error) {
            handleError(error, 'listing OpenAI models');
            return this.getStaticModelList();
        }
    }

    private formatModelName(modelId: string): string {
        return modelId
            .replace('gpt-', 'GPT ')
            .replace(/-/g, ' ')
            .replace(/(\d+)\.(\d+)/, '$1.$2')
            .replace(/\d{8}/, '')
            .trim();
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
