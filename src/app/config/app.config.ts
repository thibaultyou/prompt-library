import * as path from 'path';

export interface AppConfig {
    PROMPTS_DIR: string;
    FRAGMENTS_DIR: string;
    TEMPLATES_DIR: string;
    ANALYZER_PROMPT_PATH: string;
    README_PATH: string;
    VIEW_FILE_NAME: string;
    VIEW_TEMPLATE_NAME: string;
    README_TEMPLATE_NAME: string;
    DEFAULT_CATEGORY: string;
    FORCE_REGENERATE: string;
    YAML_INDENT: number;
    YAML_LINE_WIDTH: number;
}

export const appConfig: AppConfig = {
    PROMPTS_DIR: 'prompts',
    FRAGMENTS_DIR: 'fragments',
    TEMPLATES_DIR: path.join('src', 'app', 'templates'),
    ANALYZER_PROMPT_PATH: path.join('src', 'system_prompts', 'prompt_analysis_agent', 'prompt.md'),
    README_PATH: 'README.md',
    VIEW_FILE_NAME: 'README.md',
    VIEW_TEMPLATE_NAME: 'sub_readme.md',
    README_TEMPLATE_NAME: 'main_readme.md',
    DEFAULT_CATEGORY: 'uncategorized',
    FORCE_REGENERATE: process.env.FORCE_REGENERATE ?? 'false',
    YAML_INDENT: 2,
    YAML_LINE_WIDTH: 80
};
