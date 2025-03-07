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
        // Ensure CLI_ENV is set to 'cli' for proper config handling
        if (process.env.CLI_ENV !== 'cli') {
            process.env.CLI_ENV = 'cli';
        }

        while (true) {
            try {
                // Show current model info
                const provider = getConfigValue('MODEL_PROVIDER');
                const modelKey = provider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL';
                const maxTokensKey = provider === 'anthropic' ? 'ANTHROPIC_MAX_TOKENS' : 'OPENAI_MAX_TOKENS';
                const currentModel = getConfigValue(modelKey);
                const currentMaxTokens = getConfigValue(maxTokensKey);
                // Check if values are coming from environment variables
                const modelFromEnv = process.env[modelKey] !== undefined;
                const maxTokensFromEnv = process.env[maxTokensKey] !== undefined;
                const providerFromEnv = process.env.MODEL_PROVIDER !== undefined;
                // Determine if these env values are actually being used
                // Critical settings are always sourced from env if present
                console.log(chalk.cyan('Current Configuration:'));
                console.log(chalk.cyan(`Provider: ${provider}${providerFromEnv ? ' (from .env file)' : ''}`));
                console.log(chalk.cyan(`Model: ${currentModel}${modelFromEnv ? ' (from .env file)' : ''}`));
                console.log(
                    chalk.cyan(`Max Tokens: ${currentMaxTokens}${maxTokensFromEnv ? ' (from .env file)' : ''}`)
                );

                if (modelFromEnv || maxTokensFromEnv || providerFromEnv) {
                    console.log(chalk.yellow('Note: Some settings appear in your .env file.'));
                    console.log(
                        chalk.yellow('However, only critical settings (API keys) will be overridden by .env values.')
                    );
                    console.log(chalk.yellow('Your UI configuration choices for models and tokens will be preserved.'));
                }

                const action = await this.showMenu<'provider' | 'model' | 'back'>('Select an action:', [
                    { name: 'Change AI provider (Anthropic/OpenAI)', value: 'provider' },
                    { name: 'Configure model settings', value: 'model' }
                ]);
                switch (action) {
                    case 'provider':
                        await this.changeProvider();
                        break;
                    case 'model':
                        await this.configureModel();
                        break;
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
        const providerFromEnv = process.env.MODEL_PROVIDER !== undefined;
        const provider = await this.showMenu<ModelProvider | 'back'>('Select AI provider:', [
            {
                name: `Anthropic Claude ${currentProvider === 'anthropic' ? chalk.green('(current)') : ''}${
                    providerFromEnv && process.env.MODEL_PROVIDER === 'anthropic' ? chalk.yellow(' [set in .env]') : ''
                }`,
                value: 'anthropic'
            },
            {
                name: `OpenAI ${currentProvider === 'openai' ? chalk.green('(current)') : ''}${
                    providerFromEnv && process.env.MODEL_PROVIDER === 'openai' ? chalk.yellow(' [set in .env]') : ''
                }`,
                value: 'openai'
            }
        ]);

        if (provider === 'back') {
            return;
        }

        if (providerFromEnv) {
            console.log(
                chalk.yellow(`Note: The provider appears in your .env file as "${process.env.MODEL_PROVIDER}".`)
            );
            console.log(chalk.yellow('However, your choice here will be saved and used in the application.'));
        }

        if (provider !== currentProvider) {
            setConfig('MODEL_PROVIDER', provider);
            console.log(chalk.green(`AI provider changed to ${provider}`));

            // No warning needed since we've updated the config handling
        }

        const keyConfigName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
        const apiKey = getConfigValue(keyConfigName);
        const apiKeyFromEnv = process.env[keyConfigName] !== undefined;

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
                if (apiKeyFromEnv) {
                    console.log(chalk.yellow(`Note: The API key is already set in your .env file.`));
                    console.log(chalk.yellow(`Setting it here will only affect the current session.`));
                }

                const newKey = await this.getInput(`Enter your ${chalk.cyan(keyConfigName)}:`);

                if (newKey) {
                    setConfig(keyConfigName as keyof Config, newKey);
                    console.log(chalk.green(`${keyConfigName} has been set.`));

                    if (apiKeyFromEnv) {
                        console.log(chalk.yellow(`Note: The .env value will be used on next startup.`));
                    }
                }
            }
        }
    }

    private async configureModel(): Promise<void> {
        const provider = getConfigValue('MODEL_PROVIDER');
        const validProvider = provider === 'anthropic' || provider === 'openai' ? provider : 'anthropic';
        const modelKey = validProvider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL';
        const maxTokensKey = validProvider === 'anthropic' ? 'ANTHROPIC_MAX_TOKENS' : 'OPENAI_MAX_TOKENS';
        const currentModel = getConfigValue(modelKey);
        const currentMaxTokens = getConfigValue(maxTokensKey);
        // Check if values are coming from environment variables
        const modelFromEnv = process.env[modelKey] !== undefined;
        const maxTokensFromEnv = process.env[maxTokensKey] !== undefined;
        // Create menu options with warnings for env variables
        const menuOptions: Array<{ name: string; value: 'model' | 'max_tokens' }> = [];
        menuOptions.push({
            name: `Change model (current: ${chalk.cyan(currentModel)})${modelFromEnv ? chalk.yellow(' [set in .env]') : ''}`,
            value: 'model'
        });

        menuOptions.push({
            name: `Change max tokens (current: ${chalk.cyan(currentMaxTokens)})${maxTokensFromEnv ? chalk.yellow(' [set in .env]') : ''}`,
            value: 'max_tokens'
        });

        const config = await this.showMenu<'model' | 'max_tokens' | 'back'>(
            'What would you like to configure?',
            menuOptions
        );

        if (config === 'back') return;

        if (config === 'model') {
            if (modelFromEnv) {
                console.log(chalk.yellow(`Note: The model appears in your .env file as "${process.env[modelKey]}".`));
                console.log(chalk.yellow('However, your choice here will be saved and used in the application.'));
            }

            await this.selectModel(validProvider, modelKey);
        } else if (config === 'max_tokens') {
            if (maxTokensFromEnv) {
                console.log(
                    chalk.yellow(`Note: Max tokens appears in your .env file as "${process.env[maxTokensKey]}".`)
                );
                console.log(chalk.yellow('However, your choice here will be saved and used in the application.'));
            }

            const maxTokensInput = await this.getInput(
                `Enter max tokens for ${validProvider} (current: ${currentMaxTokens}):`
            );
            const maxTokens = parseInt(maxTokensInput, 10);

            if (isNaN(maxTokens) || maxTokens <= 0) {
                console.log(chalk.red('Invalid input. Please enter a positive number.'));
            } else {
                setConfig(maxTokensKey as keyof Config, maxTokens);
                console.log(chalk.green(`Max tokens changed to ${maxTokens}`));

                // No warning needed since we've updated the config handling
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

    /**
     * Shows a model selection menu and handles the selection
     * @param provider The AI provider ('anthropic' or 'openai')
     * @param modelKey The config key to store the selected model
     * @param useStaticList Whether to use a static list (when API key not set)
     * @param existingModels Optional pre-fetched models list
     */
    private async showModelSelectionMenu(
        provider: string,
        modelKey: string,
        _useStaticList: boolean = false,
        existingModels?: AIModelInfo[]
    ): Promise<void> {
        try {
            let models: AIModelInfo[];

            if (existingModels) {
                // Use pre-fetched models if provided
                models = existingModels;
            } else {
                // Create the appropriate client for the provider
                const client = provider === 'anthropic' ? new AnthropicClient() : new OpenAIClient();
                // Get models list
                models = await client.listAvailableModels();
            }

            if (models.length === 0) {
                console.log(chalk.yellow(`No models found for ${provider}. Cannot proceed.`));
                return;
            }

            // Sort models alphabetically
            models.sort((a: AIModelInfo, b: AIModelInfo) => a.id.localeCompare(b.id));

            // Map models to menu options
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
            // Add custom model option
            modelOptions.push({ name: 'Enter custom model name', value: 'custom' });

            const selectedModel = await this.showMenu<string | 'back'>(`Select ${provider} model:`, modelOptions);

            // Handle going back without making changes
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

                // Show model details if available
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
