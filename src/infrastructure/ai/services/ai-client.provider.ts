import { FactoryProvider } from '@nestjs/common';

import { AnthropicClient } from './anthropic.client';
import { OpenAIClient } from './openai.client';
import { PROVIDERS } from '../../../shared/constants';
import { AIClient, AI_CLIENT_TOKEN } from '../../../shared/types/infrastructure';
import { ConfigService } from '../../config/services/config.service';
import { AppError } from '../../error/services/error.service';

export const AIClientProvider: FactoryProvider<AIClient> = {
    provide: AI_CLIENT_TOKEN,
    useFactory: (
        configService: ConfigService,
        anthropicClient: AnthropicClient,
        openAIClient: OpenAIClient
    ): AIClient => {
        const providerResult = configService.getConfigValue('MODEL_PROVIDER');

        if (!providerResult.success || !providerResult.data) {
            console.warn('Failed to get MODEL_PROVIDER from config, defaulting to Anthropic.');
            const apiKeyResult = configService.getConfigValue('ANTHROPIC_API_KEY');

            if (!apiKeyResult.success || !apiKeyResult.data) {
                throw new AppError(
                    'CONFIG_ERROR',
                    `Anthropic API key is missing. Cannot initialize default AI client.`
                );
            }
            return anthropicClient;
        }

        const provider = providerResult.data;
        switch (provider) {
            case PROVIDERS.ANTHROPIC: {
                const anthropicKeyResult = configService.getConfigValue('ANTHROPIC_API_KEY');

                if (!anthropicKeyResult.success || !anthropicKeyResult.data) {
                    throw new AppError(
                        'CONFIG_ERROR',
                        `Anthropic API key is missing. Please configure it using the 'model' command.`
                    );
                }
                return anthropicClient;
            }
            case PROVIDERS.OPENAI: {
                const openAIKeyResult = configService.getConfigValue('OPENAI_API_KEY');

                if (!openAIKeyResult.success || !openAIKeyResult.data) {
                    throw new AppError(
                        'CONFIG_ERROR',
                        `OpenAI API key is missing. Please configure it using the 'model' command.`
                    );
                }
                return openAIClient;
            }
            default:
                throw new AppError('CONFIG_ERROR', `Unsupported AI provider configured: ${provider}`);
        }
    },
    inject: [ConfigService, AnthropicClient, OpenAIClient]
};
