import chalk from 'chalk';
import { Spinner } from 'cli-spinner';

import { BaseCommand } from './base-command';
import { Config, getConfigValue, setConfig } from '../../shared/config';
import { ModelProvider } from '../../shared/config/common-config';
import { getAIClient, AIModelInfo } from '../../shared/utils/ai-client';
import { AnthropicClient } from '../../shared/utils/anthropic-client';
import { OpenAIClient } from '../../shared/utils/openai-client';

class ModelCommand extends BaseCommand {
    constructor() {
        super('model', 'Configure AI model settings');
        this.action(this.execute.bind(this));
    }

    async execute(): Promise<void> {
        if (process.env.CLI_ENV !== 'cli') {
            process.env.CLI_ENV = 'cli';
        }

        while (true) {
            try {
                const provider = getConfigValue('MODEL_PROVIDER');
                const modelKey = provider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL';
                const maxTokensKey = provider === 'anthropic' ? 'ANTHROPIC_MAX_TOKENS' : 'OPENAI_MAX_TOKENS';
                const currentModel = getConfigValue(modelKey);
                const currentMaxTokens = getConfigValue(maxTokensKey);
                console.log(chalk.cyan('Current Configuration:'));
                console.log(chalk.cyan(`Provider: ${provider}`));
                console.log(chalk.cyan(`Model: ${currentModel}`));
                console.log(chalk.cyan(`Max Tokens: ${currentMaxTokens}`));

                const action = await this.showMenu<'provider' | 'model' | 'max_tokens' | 'back'>('Select an action:', [
                    { name: 'Change AI provider (Anthropic/OpenAI)', value: 'provider' },
                    { name: `Change model (current: ${chalk.cyan(currentModel)})`, value: 'model' },
                    { name: `Change max tokens (current: ${chalk.cyan(currentMaxTokens)})`, value: 'max_tokens' }
                ]);
                switch (action) {
                    case 'provider':
                        await this.changeProvider();
                        break;
                    case 'model': {
                        const validProvider =
                            provider === 'anthropic' || provider === 'openai' ? provider : 'anthropic';
                        await this.selectModel(validProvider, modelKey);
                        break;
                    }
                    case 'max_tokens': {
                        const validProvider =
                            provider === 'anthropic' || provider === 'openai' ? provider : 'anthropic';
                        const maxTokensInput = await this.getInput(
                            `Enter max tokens for ${validProvider} (current: ${currentMaxTokens}):`
                        );
                        const maxTokens = parseInt(maxTokensInput, 10);

                        if (isNaN(maxTokens) || maxTokens <= 0) {
                            console.log(chalk.red('Invalid input. Please enter a positive number.'));
                        } else {
                            setConfig(maxTokensKey as keyof Config, maxTokens);
                            console.log(chalk.green(`Max tokens changed to ${maxTokens}`));
                        }

                        break;
                    }
                    case 'back':
                        return;
                }
            } catch (error) {
                this.handleError(error, 'model command');
                await this.pressKeyToContinue();
            }
        }
    }

    private async changeProvider(): Promise<void> {
        const currentProvider = getConfigValue('MODEL_PROVIDER');
        const provider = await this.showMenu<ModelProvider | 'back'>('Select AI provider:', [
            {
                name: `Anthropic Claude ${currentProvider === 'anthropic' ? chalk.green('(current)') : ''}`,
                value: 'anthropic'
            },
            {
                name: `OpenAI ${currentProvider === 'openai' ? chalk.green('(current)') : ''}`,
                value: 'openai'
            }
        ]);

        if (provider === 'back') {
            return;
        }

        if (provider !== currentProvider) {
            setConfig('MODEL_PROVIDER', provider);
            console.log(chalk.green(`AI provider changed to ${provider}`));
        }

        const keyConfigName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
        const apiKey = getConfigValue(keyConfigName);

        if (!apiKey) {
            console.log(chalk.yellow(`Warning: ${keyConfigName} is not set.`));
            const setNow = await this.showMenu<boolean | 'back'>('Would you like to set the API key now?', [
                { name: 'Yes', value: true },
                { name: 'No', value: false }
            ]);

            if (setNow === 'back') {
                return;
            }

            if (setNow === true) {
                const newKey = await this.getInput(`Enter your ${chalk.cyan(keyConfigName)}:`);

                if (newKey) {
                    setConfig(keyConfigName as keyof Config, newKey);
                    console.log(chalk.green(`${keyConfigName} has been set.`));
                }
            }
        }
    }

    private async selectModel(provider: string, modelKey: string): Promise<void> {
        try {
            const keyConfigName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
            const apiKey = getConfigValue(keyConfigName);

            if (!apiKey || apiKey.trim() === '') {
                console.log(chalk.yellow(`Warning: ${keyConfigName} is not set. You need to set an API key first.`));
                const setNow = await this.showMenu<boolean | 'back'>('Would you like to set the API key now?', [
                    { name: 'Yes', value: true },
                    { name: 'No, use default models', value: false }
                ]);

                if (setNow === 'back') {
                    return;
                }

                if (setNow === true) {
                    const newKey = await this.getInput(`Enter your ${chalk.cyan(keyConfigName)}:`);

                    if (newKey && newKey.trim() !== '') {
                        setConfig(keyConfigName as keyof Config, newKey);
                        console.log(chalk.green(`${keyConfigName} has been set.`));
                    } else {
                        console.log(chalk.yellow('API key was not set. Using default models.'));
                        await this.showModelSelectionMenu(provider, modelKey, true);
                        return;
                    }
                } else {
                    await this.showModelSelectionMenu(provider, modelKey, true);
                    return;
                }
            }

            const spinner = new Spinner('Fetching available models... %s');
            spinner.setSpinnerString('|/-\\');
            spinner.start();

            const client = await getAIClient();
            const models = await client.listAvailableModels();
            spinner.stop(true);

            if (models.length === 0) {
                console.log(chalk.yellow(`No models found for ${provider}. Using default options.`));
                await this.showModelSelectionMenu(provider, modelKey, true);
                return;
            }

            await this.showModelSelectionMenu(provider, modelKey, false, models);
        } catch (error) {
            console.error(chalk.red('Error fetching models:'), error);
            await this.showModelSelectionMenu(provider, modelKey, true);
        }
    }

    private async selectModelFromStaticList(provider: string, modelKey: string): Promise<void> {
        await this.showModelSelectionMenu(provider, modelKey, true);
    }

    private async showModelSelectionMenu(
        provider: string,
        modelKey: string,
        _useStaticList: boolean = false,
        existingModels?: AIModelInfo[]
    ): Promise<void> {
        try {
            let models: AIModelInfo[];

            if (existingModels) {
                models = existingModels;
            } else {
                const client = provider === 'anthropic' ? new AnthropicClient() : new OpenAIClient();
                models = await client.listAvailableModels();
            }

            if (models.length === 0) {
                console.log(chalk.yellow(`No models found for ${provider}. Cannot proceed.`));
                return;
            }

            models.sort((a: AIModelInfo, b: AIModelInfo) => a.id.localeCompare(b.id));

            const modelOptions = models.map((model: AIModelInfo) => {
                let displayName = model.name || model.id;

                if (model.description) {
                    displayName += ` - ${model.description}`;
                }
                return {
                    name: displayName,
                    value: model.id
                };
            });
            modelOptions.push({ name: 'Enter custom model name', value: 'custom' });

            const selectedModel = await this.showMenu<string | 'back'>(`Select ${provider} model:`, modelOptions);

            if (selectedModel === 'back') {
                return;
            }

            if (selectedModel === 'custom') {
                const customModel = await this.getInput('Enter custom model name:');

                if (customModel) {
                    setConfig(modelKey as keyof Config, customModel);
                    console.log(chalk.green(`Model changed to ${customModel}`));
                }
            } else {
                setConfig(modelKey as keyof Config, selectedModel);
                console.log(chalk.green(`Model changed to ${selectedModel}`));

                const modelDetails = models.find((m: AIModelInfo) => m.id === selectedModel);

                if (modelDetails && modelDetails.contextWindow) {
                    console.log(chalk.cyan(`Context window size: ${modelDetails.contextWindow} tokens`));
                }
            }
        } catch (error) {
            console.error(chalk.red('Error displaying models:'), error);
        }
    }
}

export default new ModelCommand();
