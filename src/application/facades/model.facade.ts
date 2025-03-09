import { Injectable, Scope } from '@nestjs/common';

import { ModelService } from '../../infrastructure/model/services/model.service';
import { ModelProvider } from '../../shared/constants';
import { AIModelInfo, ApiResult } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class ModelFacade {
    constructor(private readonly modelService: ModelService) {}

    getCurrentProvider(): ApiResult<ModelProvider> {
        return this.modelService.getCurrentProvider();
    }
    changeProvider(provider: ModelProvider): ApiResult<void> {
        return this.modelService.setProvider(provider);
    }
    getCurrentModel(provider: ModelProvider): ApiResult<string> {
        return this.modelService.getCurrentModel(provider);
    }
    setModel(provider: ModelProvider, model: string): ApiResult<void> {
        return this.modelService.setModel(provider, model);
    }
    getMaxTokens(provider: ModelProvider): ApiResult<number> {
        return this.modelService.getMaxTokens(provider);
    }
    setMaxTokens(provider: ModelProvider, maxTokens: number): ApiResult<void> {
        return this.modelService.setMaxTokens(provider, maxTokens);
    }
    hasApiKey(provider: ModelProvider): ApiResult<boolean> {
        return this.modelService.hasApiKey(provider);
    }
    setApiKey(provider: ModelProvider, apiKey: string): ApiResult<void> {
        return this.modelService.setApiKey(provider, apiKey);
    }
    getApiKey(provider: ModelProvider): ApiResult<string> {
        return this.modelService.getApiKey(provider);
    }
    async listAvailableModels(provider: ModelProvider): Promise<ApiResult<AIModelInfo[]>> {
        return this.modelService.listAvailableModels(provider);
    }
    getModelConfig(): ApiResult<{ provider: ModelProvider; model: string; maxTokens: number; hasApiKey: boolean }> {
        return this.modelService.getModelConfig();
    }
}
