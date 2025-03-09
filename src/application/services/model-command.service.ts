import { Injectable, Scope, Inject, forwardRef } from '@nestjs/common';
import chalk from 'chalk';

import { ErrorService } from '../../infrastructure/error/services/error.service';
import { LoggerService } from '../../infrastructure/logger/services/logger.service';
import { UiFacade } from '../../infrastructure/ui/facades/ui.facade';
import { PROVIDERS, MODEL_DEFAULTS, MODEL_UI, ModelProvider } from '../../shared/constants';
import { ApiResult, CommandInterface, Result, ModelCommandAction } from '../../shared/types';
import { BaseCommandRunner } from '../commands/base/base-command.runner';
import { ModelFacade } from '../facades/model.facade';

@Injectable({ scope: Scope.DEFAULT })
export class ModelCommandService {
    constructor(
        private readonly modelFacade: ModelFacade,
        private readonly uiFacade: UiFacade,
        @Inject(forwardRef(() => LoggerService)) private readonly loggerService: LoggerService,
        @Inject(forwardRef(() => ErrorService)) private readonly errorService: ErrorService
    ) {}

    public async setModelProvider(provider: string): Promise<ApiResult<void>> {
        try {
            if (provider !== PROVIDERS.ANTHROPIC && provider !== PROVIDERS.OPENAI) {
                return Result.failure(
                    `Invalid provider: ${provider}. Must be ${PROVIDERS.ANTHROPIC} or ${PROVIDERS.OPENAI}`
                );
            }

            const result = this.modelFacade.changeProvider(provider as ModelProvider);

            if (!result.success) return Result.failure(result.error || 'Failed to set provider via facade');

            this.loggerService.success(`Model provider set to ${provider} successfully`);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'setting model provider');
            return Result.failure(`Failed set provider: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    public async setModel(model: string): Promise<ApiResult<void>> {
        try {
            const providerResult = this.modelFacade.getCurrentProvider();

            if (!providerResult.success || !providerResult.data) {
                return Result.failure(providerResult.error || 'Failed to determine current provider');
            }

            const provider = providerResult.data;
            this.loggerService.debug(`Current provider is ${provider}. Attempting to set model to ${model}`);
            const availableModelsResult = await this.modelFacade.listAvailableModels(provider);

            if (!availableModelsResult.success || !availableModelsResult.data) {
                this.loggerService.warn(`Could not list models for ${provider} to validate. Proceeding with caution.`);
            } else {
                const isValidModel = availableModelsResult.data.some((m) => m.id === model);

                if (!isValidModel) {
                    const errorMsg = `Model "${model}" is not a valid model for the current provider "${provider}". Use '--provider ${provider === PROVIDERS.ANTHROPIC ? PROVIDERS.OPENAI : PROVIDERS.ANTHROPIC}' first or select a valid model.`;
                    this.loggerService.error(errorMsg);
                    return Result.failure(errorMsg);
                }

                this.loggerService.debug(`Model "${model}" is valid for provider "${provider}".`);
            }

            const result = this.modelFacade.setModel(provider, model);

            if (!result.success) return Result.failure(result.error || `Failed set ${provider} model`);

            this.loggerService.success(`${provider} model set to ${model} successfully`);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'setting model');
            return Result.failure(`Failed set model: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async setApiKey(apiKey: string): Promise<ApiResult<void>> {
        try {
            const providerResult = this.modelFacade.getCurrentProvider();

            if (!providerResult.success || !providerResult.data) {
                return Result.failure(providerResult.error || 'Failed to determine current provider');
            }

            const provider = providerResult.data;

            if (provider === PROVIDERS.ANTHROPIC && !apiKey.startsWith('sk-ant-'))
                this.loggerService.warn('Anthropic keys usually start with sk-ant-');

            if (provider === PROVIDERS.OPENAI && !apiKey.startsWith('sk-'))
                this.loggerService.warn('OpenAI keys usually start with sk-');

            const result = this.modelFacade.setApiKey(provider, apiKey);

            if (!result.success) return Result.failure(result.error || `Failed set ${provider} API key`);

            this.loggerService.success(`${provider} API key set successfully`);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'setting API key');
            return Result.failure(`Failed set API key: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async displayModelConfiguration(
        isJsonOutput: boolean = false,
        commandRunner?: BaseCommandRunner
    ): Promise<ApiResult<void>> {
        try {
            const configResult = this.modelFacade.getModelConfig();

            if (!configResult.success || !configResult.data) {
                const errorMsg = configResult.error || 'Failed get model config';

                if (isJsonOutput && commandRunner) {
                    commandRunner['writeJsonResponse']({ success: false, error: errorMsg });
                } else {
                    this.loggerService.error(errorMsg);
                }
                return Result.failure(errorMsg);
            }

            const config = configResult.data;

            if (isJsonOutput && commandRunner) {
                commandRunner['writeJsonResponse']({ success: true, data: config });
            } else {
                this.uiFacade.print(`${chalk.gray('Provider:')} ${chalk.cyan(config.provider)}`);

                try {
                    const modelsResult = await this.modelFacade.listAvailableModels(config.provider);
                    const models = modelsResult.success && modelsResult.data ? modelsResult.data : [];
                    const modelInfo = models.find((m) => m.id === config.model);
                    this.uiFacade.print(
                        `${chalk.gray(`${config.provider === PROVIDERS.ANTHROPIC ? 'Anthropic' : 'OpenAI'} Model:`)} ${chalk.cyan(config.model || (config.provider === PROVIDERS.ANTHROPIC ? MODEL_DEFAULTS.ANTHROPIC_MODEL : MODEL_DEFAULTS.OPENAI_MODEL))}`
                    );

                    if (modelInfo) {
                        if (modelInfo.name)
                            this.uiFacade.print(`${chalk.gray('Model Name:')} ${chalk.cyan(modelInfo.name)}`);

                        if (modelInfo.contextWindow)
                            this.uiFacade.print(
                                `${chalk.gray('Context Window:')} ${chalk.cyan(modelInfo.contextWindow.toLocaleString())} tokens`
                            );
                    }

                    this.uiFacade.print(`${chalk.gray('Max Output Tokens:')} ${chalk.cyan(config.maxTokens)}`);
                    this.uiFacade.print(
                        `${chalk.gray('API Key:')} ${config.hasApiKey ? chalk.green('Configured ✓') : chalk.red('Not configured ✗')}`
                    );
                } catch (error) {
                    this.loggerService.debug(`Error getting detailed model info: ${error}`);
                    this.uiFacade.print(
                        `${chalk.gray(`${config.provider === PROVIDERS.ANTHROPIC ? 'Anthropic' : 'OpenAI'} Model:`)} ${chalk.cyan(config.model || (config.provider === PROVIDERS.ANTHROPIC ? MODEL_DEFAULTS.ANTHROPIC_MODEL : MODEL_DEFAULTS.OPENAI_MODEL))}`
                    );
                    this.uiFacade.print(`${chalk.gray('Max Tokens:')} ${chalk.cyan(config.maxTokens)}`);
                    this.uiFacade.print(
                        `${chalk.gray('API Key:')} ${config.hasApiKey ? chalk.green('Configured ✓') : chalk.red('Not configured ✗')}`
                    );
                }
            }
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, 'displaying model configuration');
            const message = `Failed display model config: ${error instanceof Error ? error.message : String(error)}`;

            if (isJsonOutput && commandRunner) {
                commandRunner['writeJsonResponse']({ success: false, error: message });
            }
            return Result.failure(message);
        }
    }

    public async configureModelProvider(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const currentProviderResult = this.modelFacade.getCurrentProvider();

            if (!currentProviderResult.success || !currentProviderResult.data) {
                return Result.failure(currentProviderResult.error || 'Failed get current provider');
            }

            const currentProvider = currentProviderResult.data;
            const providers = [
                { id: PROVIDERS.ANTHROPIC, name: 'Anthropic', description: 'Claude models' },
                { id: PROVIDERS.OPENAI, name: 'OpenAI', description: 'GPT models' }
            ];
            const providerOptions = providers.map((p) => ({
                name: `${p.name} ${currentProvider === p.id ? chalk.green('(current)') : ''}`,
                value: p.id,
                description: p.description
            }));
            const selectedProvider = await command.selectMenu<string | 'back'>(
                'Select AI model provider:',
                providerOptions
            );

            if (selectedProvider === 'back') return Result.success(undefined);

            const setProviderResult = this.modelFacade.changeProvider(selectedProvider as ModelProvider);

            if (!setProviderResult.success) {
                return Result.failure(setProviderResult.error || 'Failed change provider');
            }

            this.loggerService.success(`Model provider set to ${selectedProvider}`);
            return await this.configureProviderSettings(command, selectedProvider as ModelProvider);
        } catch (error) {
            this.errorService.handleError(error, 'configuring model provider');
            return Result.failure(
                `Failed configure provider: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async configureProviderSettings(
        command: CommandInterface,
        provider: ModelProvider
    ): Promise<ApiResult<void>> {
        try {
            const currentModelResult = this.modelFacade.getCurrentModel(provider);
            const currentModel = currentModelResult.success ? currentModelResult.data : undefined;
            const modelsResult = await this.modelFacade.listAvailableModels(provider);

            if (!modelsResult.success) {
                return Result.failure(modelsResult.error || `Failed list ${provider} models`);
            }

            const availableModels = modelsResult.data || [];
            availableModels.sort(
                (a, b) =>
                    (b.contextWindow ?? 0) - (a.contextWindow ?? 0) || (a.name ?? a.id).localeCompare(b.name ?? b.id)
            );
            const modelOptions = availableModels.map((m) => ({
                name: `${m.name || m.id} ${m.contextWindow ? `(${m.contextWindow.toLocaleString()} tokens)` : ''} ${currentModel === m.id ? chalk.green('(current)') : ''}`,
                value: m.id,
                description: m.description || ''
            }));
            const selectedModelId = await command.selectMenu<string | 'back'>(
                `Select ${provider} model:`,
                modelOptions
            );

            if (selectedModelId === 'back') return Result.success(undefined);

            const setModelResult = this.modelFacade.setModel(provider, selectedModelId);

            if (!setModelResult.success) return Result.failure(setModelResult.error || 'Failed set model');

            this.loggerService.success(`${provider} model set to ${selectedModelId}`);
            const selectedModelInfo = availableModels.find((m) => m.id === selectedModelId);
            const contextWindow =
                selectedModelInfo?.contextWindow || (provider === PROVIDERS.ANTHROPIC ? 200000 : 128000);
            const recommendedMaxTokens = Math.min(Math.floor(contextWindow * 0.8), 8000);
            const currentMaxTokensResult = this.modelFacade.getMaxTokens(provider);
            const currentMaxTokens = (
                currentMaxTokensResult.success
                    ? (currentMaxTokensResult.data ?? MODEL_DEFAULTS.MAX_TOKENS)
                    : MODEL_DEFAULTS.MAX_TOKENS
            ).toString();
            const maxTokensInput = await command.getInput(
                `Max tokens for completion (recommended: ${recommendedMaxTokens}, model max: ${contextWindow}):`,
                { default: currentMaxTokens, allowCancel: true }
            );

            if (maxTokensInput !== null) {
                const maxTokens = parseInt(maxTokensInput, 10);

                if (!isNaN(maxTokens) && maxTokens > 0) {
                    const setMaxTokensResult = this.modelFacade.setMaxTokens(provider, maxTokens);

                    if (!setMaxTokensResult.success) {
                        this.loggerService.error(setMaxTokensResult.error || 'Failed set max tokens');
                    } else {
                        this.loggerService.success(`Max tokens for ${provider} set to ${maxTokens}`);
                    }
                } else {
                    this.loggerService.warn('Invalid number entered for max tokens. Keeping previous value.');
                }
            } else {
                this.loggerService.info('Max tokens configuration cancelled.');
            }

            const hasApiKeyResult = this.modelFacade.hasApiKey(provider);
            const hasApiKey = hasApiKeyResult.success && hasApiKeyResult.data;
            const changeKey = hasApiKey
                ? await command.confirmAction('API key is configured. Change it?', { default: false })
                : true;

            if (changeKey) {
                await this.configureApiKeyForProvider(command, provider);
            }

            this.loggerService.success(`${provider} model settings updated successfully`);
            return Result.success(undefined);
        } catch (error) {
            this.errorService.handleError(error, `configuring ${provider} settings`);
            return Result.failure(
                `Failed configure ${provider} settings: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async selectAndUpdateModel(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const providerResult = this.modelFacade.getCurrentProvider();

            if (!providerResult.success || !providerResult.data) {
                return Result.failure(providerResult.error || 'Failed get provider');
            }

            const provider = providerResult.data;
            return await this.configureProviderSettings(command, provider);
        } catch (error) {
            this.errorService.handleError(error, 'updating model settings');
            return Result.failure(
                `Failed update model settings: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async configureApiKey(command: CommandInterface): Promise<ApiResult<void>> {
        try {
            const providerResult = this.modelFacade.getCurrentProvider();

            if (!providerResult.success || !providerResult.data) {
                return Result.failure(providerResult.error || 'Failed get provider');
            }

            const provider = providerResult.data;
            return await this.configureApiKeyForProvider(command, provider);
        } catch (error) {
            this.errorService.handleError(error, 'configuring API key');
            return Result.failure(
                `Failed configure API key: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async configureApiKeyForProvider(
        command: CommandInterface,
        provider: ModelProvider
    ): Promise<ApiResult<void>> {
        const keyPrompt =
            provider === PROVIDERS.ANTHROPIC ? MODEL_UI.INPUT.ANTHROPIC_API_KEY : MODEL_UI.INPUT.OPENAI_API_KEY;
        const apiKey = await command.getInput(keyPrompt, { nonInteractive: false, allowCancel: true });

        if (apiKey !== null) {
            const keyPrefix = provider === PROVIDERS.ANTHROPIC ? 'sk-ant-' : 'sk-';

            if (!apiKey.startsWith(keyPrefix)) {
                this.loggerService.warn(`Key format seems incorrect (should start with ${keyPrefix}).`);
                const continueAnyway = await command.confirmAction(MODEL_UI.INPUT.CONFIRM_INVALID_KEY, {
                    default: false
                });

                if (!continueAnyway) return Result.failure('API key entry cancelled.');
            }

            const result = this.modelFacade.setApiKey(provider, apiKey);

            if (!result.success) return Result.failure(result.error || `Failed set ${provider} API key`);

            this.loggerService.success(`${provider} API key updated successfully`);
        } else {
            this.loggerService.info('API key configuration cancelled.');
        }
        return Result.success(undefined);
    }

    public async handleInteractiveMode(command: CommandInterface): Promise<void> {
        while (true) {
            this.uiFacade.clearConsole();
            this.uiFacade.printSectionHeader(MODEL_UI.SECTION_HEADER.TITLE, MODEL_UI.SECTION_HEADER.ICON);
            await this.displayModelConfiguration(false);
            const action = await command.selectMenu<ModelCommandAction>(MODEL_UI.MENU.PROMPT, [
                { name: MODEL_UI.MENU.OPTIONS.PROVIDER, value: MODEL_UI.ACTIONS.PROVIDER },
                { name: MODEL_UI.MENU.OPTIONS.MODEL, value: MODEL_UI.ACTIONS.MODEL },
                { name: MODEL_UI.MENU.OPTIONS.API_KEY, value: MODEL_UI.ACTIONS.KEY }
            ]);

            if (action === MODEL_UI.ACTIONS.BACK) return;

            await this.handleMenuAction(command, action);
        }
    }

    private async handleMenuAction(command: CommandInterface, action: ModelCommandAction): Promise<void> {
        let result: ApiResult<void> | undefined;
        switch (action) {
            case MODEL_UI.ACTIONS.PROVIDER:
                result = await this.configureModelProvider(command);
                break;
            case MODEL_UI.ACTIONS.MODEL:
                result = await this.selectAndUpdateModel(command);
                break;
            case MODEL_UI.ACTIONS.KEY:
                result = await this.configureApiKey(command);
                break;
        }

        if (result && !result.success) {
            this.loggerService.error(`Failed to perform model action '${action}': ${result.error}`);
        }

        if (action !== MODEL_UI.ACTIONS.BACK) {
            await command.pressKeyToContinue();
        }
    }
}
