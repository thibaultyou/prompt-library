import * as path from 'path';

interface Config {
    // Directories
    PROMPTS_DIR: string;
    TEMPLATES_DIR: string;

    // File paths
    ANALYZER_PROMPT_PATH: string;
    README_PATH: string;

    // Anthropic API
    ANTHROPIC_MODEL: string;
    ANTHROPIC_MAX_TOKENS: number;

    // File names
    PROMPT_FILE_NAME: string;
    METADATA_FILE_NAME: string;
    VIEW_FILE_NAME: string;

    // Template names
    VIEW_TEMPLATE_NAME: string;
    README_TEMPLATE_NAME: string;

    // Metadata
    DEFAULT_CATEGORY: string;

    // GitHub Actions
    FORCE_REGENERATE_ENV_VAR: string;

    // Logging
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

    // YAML configuration
    YAML_INDENT: number;
    YAML_LINE_WIDTH: number;
}

const config: Config = {
    // Directories
    PROMPTS_DIR: 'prompts',
    TEMPLATES_DIR: path.join('.github', 'templates'),

    // File paths
    ANALYZER_PROMPT_PATH: path.join('.github', 'prompts', 'ai_prompt_analyzer_and_output_generator', 'prompt.md'),
    README_PATH: 'README.md',

    // Anthropic API
    ANTHROPIC_MODEL: 'claude-3-5-sonnet-20240620',
    ANTHROPIC_MAX_TOKENS: 2500,

    // File names
    PROMPT_FILE_NAME: 'prompt.md',
    METADATA_FILE_NAME: 'metadata.yml',
    VIEW_FILE_NAME: 'view.md',

    // Template names
    VIEW_TEMPLATE_NAME: 'view_template.md',
    README_TEMPLATE_NAME: 'readme_template.md',

    // Metadata
    DEFAULT_CATEGORY: 'uncategorized',

    // GitHub Actions
    FORCE_REGENERATE_ENV_VAR: 'FORCE_REGENERATE',

    // Logging
    LOG_LEVEL: 'info',

    // YAML configuration
    YAML_INDENT: 2,
    YAML_LINE_WIDTH: 80,
};

export default config;
