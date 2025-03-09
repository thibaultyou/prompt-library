import dotenv from 'dotenv';

import { Config } from '.';

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

export type ModelProvider = 'anthropic' | 'openai';

export interface CommonConfig {
    MODEL_PROVIDER: ModelProvider;
    ANTHROPIC_MODEL: string;
    ANTHROPIC_MAX_TOKENS: number;
    OPENAI_MODEL: string;
    OPENAI_MAX_TOKENS: number;
    PROMPT_FILE_NAME: string;
    METADATA_FILE_NAME: string;

    ANTHROPIC_API_KEY: string | undefined;
    OPENAI_API_KEY: string | undefined;
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
    REMOTE_REPOSITORY: string;
    CLI_ENV: string;
}

export const commonConfig: CommonConfig = {
    MODEL_PROVIDER: (process.env.MODEL_PROVIDER as ModelProvider) || 'anthropic',
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    ANTHROPIC_MAX_TOKENS: process.env.ANTHROPIC_MAX_TOKENS ? parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10) : 8000,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
    OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 8000,
    PROMPT_FILE_NAME: process.env.PROMPT_FILE_NAME || 'prompt.md',
    METADATA_FILE_NAME: process.env.METADATA_FILE_NAME || 'metadata.yml',

    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LOG_LEVEL: (process.env.LOG_LEVEL as Config['LOG_LEVEL']) || 'info',
    REMOTE_REPOSITORY: process.env.REMOTE_REPOSITORY || '',
    CLI_ENV: process.env.CLI_ENV || 'cli'
};
