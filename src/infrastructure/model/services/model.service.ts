import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';

import { getConfigValue as getConfigValueUtil, setConfig as setConfigUtil, Config } from '../../../shared/config';
import { MODEL_DEFAULTS, ModelProvider, PROVIDERS } from '../../../shared/constants';
import { AIModelInfo, ApiResult, Result } from '../../../shared/types';
import { AnthropicClient } from '../../ai/services/anthropic.client';
import { OpenAIClient } from '../../ai/services/openai.client';
import { ErrorService } from '../../error/services/error.service';
import { LoggerService } from '../../logger/services/logger.service';

@Injectable({ scope: Scope.DEFAULT })
export class ModelService {
    constructor(
        private readonly anthropicClient: AnthropicClient,
        private readonly openAIClient: OpenAIClient,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}
    private getClientForProvider(provider: ModelProvider): AnthropicClient | OpenAIClient {
        if (provider === PROVIDERS.OPENAI) {
            return this.openAIClient;
        }
        return this.anthropicClient;
    }

    getCurrentProvider(): ApiResult<ModelProvider> {
        try {
            const provider = getConfigValueUtil('MODEL_PROVIDER');
            const validProvider =
                provider === PROVIDERS.ANTHROPIC || provider === PROVIDERS.OPENAI ? provider : PROVIDERS.ANTHROPIC;
            return Result.success(validProvider);
        } catch (error) {
            this.errorService.handleError(error, 'getting current provider');
            return Result.failure(error instanceof Error ? error.message : 'Unknown error getting current provider', {
                data: PROVIDERS.ANTHROPIC
            });
        }
    }

    setProvider(provider: ModelProvider): ApiResult<void> {
        try {
            setConfigUtil('MODEL_PROVIDER', provider);
            this.loggerService.info(`Model provider set to ${provider}`);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'setting provider');
            return Result.failure(error instanceof Error ? error.message : 'Failed to set provider');
        }
    }

    getCurrentModel(provider: ModelProvider): ApiResult<string> {
        try {
            const modelKey = provider === PROVIDERS.ANTHROPIC ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL';
            const model =
                getConfigValueUtil(modelKey) ||
                (provider === PROVIDERS.ANTHROPIC ? MODEL_DEFAULTS.ANTHROPIC_MODEL : MODEL_DEFAULTS.OPENAI_MODEL);
            return Result.success(model);
        } catch (error) {
            this.errorService.handleError(error, `getting current model for ${provider}`);
            const defaultModel =
                provider === PROVIDERS.ANTHROPIC ? MODEL_DEFAULTS.ANTHROPIC_MODEL : MODEL_DEFAULTS.OPENAI_MODEL;
            return Result.failure(
                error instanceof Error ? error.message : `Failed to get current model for ${provider}`,
                { data: defaultModel }
            );
        }
    }

    setModel(provider: ModelProvider, model: string): ApiResult<void> {
        try {
            const modelKey = provider === PROVIDERS.ANTHROPIC ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL';
            setConfigUtil(modelKey as keyof Config, model);
            this.loggerService.info(`${provider} model set to ${model}`);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, `setting model for ${provider}`);
            return Result.failure(error instanceof Error ? error.message : `Failed to set model for ${provider}`);
        }
    }

    getMaxTokens(provider: ModelProvider): ApiResult<number> {
        try {
            const maxTokensKey = provider === PROVIDERS.ANTHROPIC ? 'ANTHROPIC_MAX_TOKENS' : 'OPENAI_MAX_TOKENS';
            const value = getConfigValueUtil(maxTokensKey);
            const maxTokens =
                typeof value === 'number'
                    ? value
                    : typeof value === 'string'
                      ? parseInt(value, 10)
                      : MODEL_DEFAULTS.MAX_TOKENS;
            return Result.success(isNaN(maxTokens) ? MODEL_DEFAULTS.MAX_TOKENS : maxTokens);
        } catch (error) {
            this.errorService.handleError(error, `getting max tokens for ${provider}`);
            return Result.failure(error instanceof Error ? error.message : `Failed to get max tokens for ${provider}`, {
                data: MODEL_DEFAULTS.MAX_TOKENS
            });
        }
    }

    setMaxTokens(provider: ModelProvider, maxTokens: number): ApiResult<void> {
        try {
            const maxTokensKey = provider === PROVIDERS.ANTHROPIC ? 'ANTHROPIC_MAX_TOKENS' : 'OPENAI_MAX_TOKENS';
            setConfigUtil(maxTokensKey as keyof Config, maxTokens);
            this.loggerService.info(`Max tokens for ${provider} set to ${maxTokens}`);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, `setting max tokens for ${provider}`);
            return Result.failure(error instanceof Error ? error.message : `Failed to set max tokens for ${provider}`);
        }
    }

    getApiKey(provider: ModelProvider): ApiResult<string> {
        try {
            const keyConfigName = provider === PROVIDERS.ANTHROPIC ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
            const key = getConfigValueUtil(keyConfigName) || '';
            return Result.success(key);
        } catch (error) {
            this.errorService.handleError(error, `getting API key for ${provider}`);
            return Result.failure(error instanceof Error ? error.message : `Failed to get API key for ${provider}`, {
                data: ''
            });
        }
    }

    setApiKey(provider: ModelProvider, apiKey: string): ApiResult<void> {
        try {
            const keyConfigName = provider === PROVIDERS.ANTHROPIC ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
            setConfigUtil(keyConfigName as keyof Config, apiKey);
            this.loggerService.info(`API key for ${provider} updated.`);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, `setting API key for ${provider}`);
            return Result.failure(error instanceof Error ? error.message : `Failed to set API key for ${provider}`);
        }
    }

    hasApiKey(provider: ModelProvider): ApiResult<boolean> {
        try {
            const apiKeyResult = this.getApiKey(provider);
            const hasKey = apiKeyResult.success && !!apiKeyResult.data && apiKeyResult.data.trim() !== '';
            return Result.success(hasKey);
        } catch (error) {
            return Result.failure(error instanceof Error ? error.message : `Failed to check API key for ${provider}`, {
                data: false
            });
        }
    }
    async listAvailableModels(providerInput?: ModelProvider): Promise<ApiResult<AIModelInfo[]>> {
        try {
            const provider = providerInput ?? this.getCurrentProvider().data ?? PROVIDERS.ANTHROPIC;
            const client = this.getClientForProvider(provider);
            const models = await client.listAvailableModels();
            this.loggerService.debug(`Listed ${models.length} models for provider ${provider}.`);
            return Result.success(models);
        } catch (error) {
            this.errorService.handleError(error, 'listing available models');
            return Result.failure(error instanceof Error ? error.message : 'Failed to list available models', {
                data: []
            });
        }
    }

    getModelConfig(): ApiResult<{ provider: ModelProvider; model: string; maxTokens: number; hasApiKey: boolean }> {
        try {
            const providerResult = this.getCurrentProvider();

            if (!providerResult.success || !providerResult.data) {
                return Result.failure(providerResult.error || 'Failed to get provider');
            }

            const provider = providerResult.data;
            const modelResult = this.getCurrentModel(provider);

            if (!modelResult.success || !modelResult.data) {
                return Result.failure(modelResult.error || 'Failed to get model');
            }

            const maxTokensResult = this.getMaxTokens(provider);

            if (!maxTokensResult.success || maxTokensResult.data === undefined) {
                return Result.failure(maxTokensResult.error || 'Failed to get max tokens');
            }

            const hasApiKeyResult = this.hasApiKey(provider);

            if (!hasApiKeyResult.success || hasApiKeyResult.data === undefined) {
                return Result.failure(hasApiKeyResult.error || 'Failed to check API key');
            }
            return Result.success({
                provider: provider,
                model: modelResult.data,
                maxTokens: maxTokensResult.data,
                hasApiKey: hasApiKeyResult.data
            });
        } catch (error) {
            this.errorService.handleError(error, 'getting model configuration');
            return Result.failure(error instanceof Error ? error.message : 'Failed to get model configuration');
        }
    }
}
