import dotenv from 'dotenv';

import { ModelProvider } from '../constants';

// Load environment variables from .env file if not in production
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

/**
 * Common configuration shared between App and CLI modes.
 * These settings are fundamental to the application's operation regardless
 * of how it's run (development vs. installed package).
 */
// TODO - Relocate
export interface CommonConfig {
    /** The currently selected AI model provider ('anthropic' or 'openai'). */
    MODEL_PROVIDER: ModelProvider;
    /** The specific Anthropic model identifier (e.g., 'claude-3-5-sonnet-20240620'). */
    ANTHROPIC_MODEL: string;
    /** Maximum number of tokens the Anthropic model should generate in a response. */
    ANTHROPIC_MAX_TOKENS: number;
    /** The specific OpenAI model identifier (e.g., 'gpt-4o'). */
    OPENAI_MODEL: string;
    /** Maximum number of tokens the OpenAI model should generate in a response. */
    OPENAI_MAX_TOKENS: number;
    /** Standard filename used for the main content of a prompt (e.g., 'prompt.md'). */
    PROMPT_FILE_NAME: string;
    /** Standard filename used for the metadata of a prompt (e.g., 'metadata.yml'). */
    METADATA_FILE_NAME: string;

    /** API key for the Anthropic service. Loaded from env or config file. Sensitive. */
    ANTHROPIC_API_KEY: string | undefined;
    /** API key for the OpenAI service. Loaded from env or config file. Sensitive. */
    OPENAI_API_KEY: string | undefined;
    /** Logging level ('debug', 'info', 'warn', 'error'). Controls log verbosity. */
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
    /** URL of the remote Git repository used for storing and syncing prompts. */
    REMOTE_REPOSITORY: string;
    /** Indicates the current execution environment ('cli', 'dev', 'test'). */
    CLI_ENV: string;

    /** Default branch name used for Git operations (e.g., 'main'). */
    DEFAULT_BRANCH: string;
    /** URL of the primary upstream repository for fetching updates. */
    UPSTREAM_REPOSITORY: string;
    /** List of downstream repository URLs (currently unused, for future expansion). */
    DOWNSTREAM_REPOSITORIES: string[];
    /** Flag indicating whether Git integration features (sync, push, etc.) are enabled. */
    USE_GIT: boolean;
}

/**
 * Default values for common configuration settings.
 * Environment variables (process.env) take precedence over these defaults.
 * The `getConfigValue` function handles the priority logic.
 */
export const commonConfig: CommonConfig = {
    MODEL_PROVIDER: (process.env.MODEL_PROVIDER as ModelProvider) || 'anthropic',
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620', // Updated default
    ANTHROPIC_MAX_TOKENS: process.env.ANTHROPIC_MAX_TOKENS ? parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10) : 8000,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
    OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 8000,
    PROMPT_FILE_NAME: process.env.PROMPT_FILE_NAME || 'prompt.md',
    METADATA_FILE_NAME: process.env.METADATA_FILE_NAME || 'metadata.yml',

    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LOG_LEVEL: (process.env.LOG_LEVEL as CommonConfig['LOG_LEVEL']) || 'info',
    REMOTE_REPOSITORY: process.env.REMOTE_REPOSITORY || '',
    CLI_ENV: process.env.CLI_ENV || 'cli', // Default to 'cli' mode

    DEFAULT_BRANCH: process.env.DEFAULT_BRANCH || 'main',
    UPSTREAM_REPOSITORY: process.env.UPSTREAM_REPOSITORY || '',
    DOWNSTREAM_REPOSITORIES: process.env.DOWNSTREAM_REPOSITORIES ? process.env.DOWNSTREAM_REPOSITORIES.split(',') : [],
    USE_GIT: process.env.USE_GIT !== 'false' // Default to true unless explicitly set to 'false'
};
