/**
 * UI constants specific to the 'model' command.
 * Defines text, descriptions, options, and structure for the AI model configuration interface.
 */
import { STYLE_TYPES, UI_ICONS } from './formatting';

export const MODEL_UI = {
    /**
     * Descriptions used in command help text.
     */
    DESCRIPTIONS: {
        /** Description for the main 'model' command. */
        COMMAND: 'Configure AI model provider, specific model, and API key settings.'
    },

    /**
     * Descriptions for command-line options specific to the 'model' command.
     */
    OPTIONS: {
        /** Description for the --provider option. */
        PROVIDER: 'Set the default AI provider (anthropic | openai).',
        /** Description for the --model option. */
        MODEL: 'Set the specific AI model identifier to use (e.g., claude-3-5-sonnet-20240620, gpt-4o).',
        /** Description for the --apiKey option. */
        API_KEY: 'Set the API key for the currently selected provider.',
        /** Description for the --nonInteractive option. */
        NON_INTERACTIVE: 'Run command without interactive prompts (requires necessary options).',
        /** Description for the --json option. */
        JSON: 'Output current model configuration in JSON format.'
    },

    /**
     * Titles and icons for different sections within the 'model' command's UI.
     */
    SECTION_HEADER: {
        /** Main title for the AI model settings section. */
        TITLE: 'AI Model Configuration',
        /** Default icon for model settings sections. */
        ICON: UI_ICONS.MODEL
    },

    /**
     * Text and structure for interactive menus within the 'model' command.
     */
    MENU: {
        /** Default prompt message for the main model action menu. */
        PROMPT: 'Select a setting to configure:',
        /** Labels for the different actions available in the model menu. */
        OPTIONS: {
            /** Menu item to change the AI provider. */
            PROVIDER: 'Change AI Provider (Anthropic/OpenAI)',
            /** Menu item to select the specific model for the current provider. */
            MODEL: 'Select Model',
            /** Menu item to configure the API key for the current provider. */
            API_KEY: 'Configure API Key',
            /** Menu item to set the maximum output tokens (future feature). */
            MAX_TOKENS: 'Set Max Output Tokens',
            /** Menu item to adjust the model temperature (future feature). */
            TEMPERATURE: 'Adjust Temperature'
        }
    },

    /**
     * Section headers specific to AI providers.
     */
    PROVIDER_HEADERS: {
        /** Header for Anthropic model selection. */
        ANTHROPIC: {
            TITLE: 'Anthropic Claude Models',
            ICON: UI_ICONS.MODEL
        },
        /** Header for OpenAI model selection. */
        OPENAI: {
            TITLE: 'OpenAI GPT Models',
            ICON: UI_ICONS.MODEL
        }
    },

    /**
     * Standard action identifiers used internally for 'model' command operations.
     */
    ACTIONS: {
        /** Action identifier for changing the provider. */
        PROVIDER: 'provider' as const,
        /** Action identifier for selecting the model. */
        MODEL: 'model' as const,
        /** Action identifier for configuring the API key. */
        KEY: 'key' as const,
        /** Action identifier for setting max tokens. */
        TOKENS: 'tokens' as const,
        /** Action identifier for adjusting temperature. */
        TEMPERATURE: 'temperature' as const,
        /** Standard action identifier for going back. */
        BACK: 'back' as const
    },

    /**
     * Standard labels used in the model configuration UI.
     */
    LABELS: {
        /** Label for displaying the API Key status or input prompt. */
        API_KEY: 'API Key:',
        /** Label for displaying the current AI Provider. */
        PROVIDER: 'Provider:',
        /** Label for displaying the current AI Model. */
        MODEL: 'Model:',
        /** Label for displaying the Max Tokens setting. */
        MAX_TOKENS: 'Max Tokens:',
        /** Label for displaying the Temperature setting. */
        TEMPERATURE: 'Temperature:',
        /** Label indicating the current selection. */
        CURRENT: '(current)',
        /** Label indicating API key is configured. */
        CONFIGURED: 'Configured ✓',
        /** Label indicating API key is not configured. */
        NOT_CONFIGURED: 'Not configured ✗'
    },

    /**
     * Help messages providing guidance on command usage, especially for errors.
     */
    HELP: {
        /** Error message when running non-interactively without required options. */
        MISSING_OPTIONS: 'In non-interactive mode, please specify an action using --provider, --model, or --apiKey.',
        /** JSON error variant for missing options. */
        MISSING_OPTIONS_JSON: {
            error: 'Required options missing for non-interactive mode (--provider, --model, or --apiKey).'
        }
    },

    /**
     * Input prompts for model configuration.
     */
    INPUT: {
        /** Prompt asking for the Anthropic API key. */
        ANTHROPIC_API_KEY: 'Enter your Anthropic API key (starts with sk-ant-):',
        /** Prompt asking for the OpenAI API key. */
        OPENAI_API_KEY: 'Enter your OpenAI API key (starts with sk-):',
        /** Prompt asking for max tokens. Uses {0} for recommended, {1} for max. */
        MAX_TOKENS: 'Max tokens for completion (recommended: {0}, max: {1}):',
        /** Confirmation prompt for potentially invalid API key format. */
        CONFIRM_INVALID_KEY: 'Key format seems incorrect. Continue anyway?'
    },

    /**
     * Style mappings for model UI elements.
     */
    STYLES: {
        /** Style for the currently selected provider/model. */
        CURRENT: STYLE_TYPES.SUCCESS,
        /** Style for indicating API key is configured. */
        CONFIGURED: STYLE_TYPES.SUCCESS,
        /** Style for indicating API key is not configured. */
        NOT_CONFIGURED: STYLE_TYPES.DANGER
    }
};
