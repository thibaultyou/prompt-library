import * as path from 'path';
/**
 * Configuration interface for the AI prompt management system.
 */
interface Config {
    /** Directory paths */
    PROMPTS_DIR: string;
    TEMPLATES_DIR: string;
    /** File paths */
    ANALYZER_PROMPT_PATH: string;
    README_PATH: string;
    /** Anthropic API settings */
    ANTHROPIC_MODEL: string;
    ANTHROPIC_MAX_TOKENS: number;
    /** File names */
    PROMPT_FILE_NAME: string;
    METADATA_FILE_NAME: string;
    VIEW_FILE_NAME: string;
    /** Template names */
    VIEW_TEMPLATE_NAME: string;
    README_TEMPLATE_NAME: string;
    /** Metadata settings */
    DEFAULT_CATEGORY: string;
    /** GitHub Actions settings */
    FORCE_REGENERATE: string;
    /** Logging settings */
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
    /** YAML configuration */
    YAML_INDENT: number;
    YAML_LINE_WIDTH: number;
}
/**
 * Configuration object for the AI prompt management system.
 */
const config: Config = {
    PROMPTS_DIR: 'prompts',
    TEMPLATES_DIR: path.join('src', 'templates'),
    ANALYZER_PROMPT_PATH: path.join('src', 'system_prompts', 'prompt_analysis_agent', 'prompt.md'),
    README_PATH: 'README.md',
    ANTHROPIC_MODEL: 'claude-3-5-sonnet-20240620',
    ANTHROPIC_MAX_TOKENS: 2500,
    PROMPT_FILE_NAME: 'prompt.md',
    METADATA_FILE_NAME: 'metadata.yml',
    VIEW_FILE_NAME: 'README.md',
    VIEW_TEMPLATE_NAME: 'sub_readme.md',
    README_TEMPLATE_NAME: 'main_readme.md',
    DEFAULT_CATEGORY: 'uncategorized',
    FORCE_REGENERATE: process.env.FORCE_REGENERATE ?? 'false',
    LOG_LEVEL: 'info',
    YAML_INDENT: 2,
    YAML_LINE_WIDTH: 80
};

export default config;
