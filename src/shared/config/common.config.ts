import dotenv from 'dotenv';

import { Config } from '.';

// Load .env file if running locally
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

export interface CommonConfig {
    ANTHROPIC_API_KEY: string | undefined;
    ANTHROPIC_MODEL: string;
    ANTHROPIC_MAX_TOKENS: number;
    PROMPT_FILE_NAME: string;
    METADATA_FILE_NAME: string;
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
    REMOTE_REPOSITORY: string;
    CLI_ENV: string;
}

export const commonConfig: CommonConfig = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: 'claude-3-5-sonnet-20240620',
    ANTHROPIC_MAX_TOKENS: 8000,
    PROMPT_FILE_NAME: 'prompt.md',
    METADATA_FILE_NAME: 'metadata.yml',
    LOG_LEVEL: (process.env.LOG_LEVEL as Config['LOG_LEVEL']) || 'info',
    REMOTE_REPOSITORY: process.env.REMOTE_REPOSITORY || '',
    CLI_ENV: process.env.CLI_ENV || 'cli'
};
