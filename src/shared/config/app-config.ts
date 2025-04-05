import * as path from 'path';

/**
 * Application-specific configuration (used when running from source/dev mode)
 * Defines paths and settings relevant when the application is run directly
 * from its source code, typically during development.
 */
// TODO - Relocate
export interface AppConfig {
    /** Directory where prompt files (prompt.md, metadata.yml) are stored. */
    PROMPTS_DIR: string;
    /** Directory where reusable fragment files (.md) are stored. */
    FRAGMENTS_DIR: string;
    /** Directory containing Nunjucks templates for generating views/readmes. */
    TEMPLATES_DIR: string;
    /** Path to the system prompt used for AI-driven metadata analysis. */
    ANALYZER_PROMPT_PATH: string;
    /** Path to the main README file of the repository. */
    README_PATH: string;
    /** Standard filename for generated view/readme files within prompt directories. */
    VIEW_FILE_NAME: string;
    /** Nunjucks template name for generating individual prompt views/readmes. */
    VIEW_TEMPLATE_NAME: string;
    /** Nunjucks template name for generating the main repository README. */
    README_TEMPLATE_NAME: string;
    /** Default category assigned to prompts if none is specified. */
    DEFAULT_CATEGORY: string;
    /** Flag to force regeneration of metadata, even if content hash matches. */
    FORCE_REGENERATE: boolean;
    /** Indentation level used when generating YAML files. */
    YAML_INDENT: number;
    /** Maximum line width for generated YAML files. */
    YAML_LINE_WIDTH: number;
}

/**
 * Concrete implementation of AppConfig with default values.
 * These values are typically used during development runs.
 */
export const appConfig: AppConfig = {
    PROMPTS_DIR: 'prompts',
    FRAGMENTS_DIR: 'fragments',
    // Assumes templates are located within the application layer structure
    TEMPLATES_DIR: path.join('src', 'application', 'templates'),
    ANALYZER_PROMPT_PATH: path.join('src', 'system_prompts', 'prompt_analysis_agent', 'prompt.md'),
    README_PATH: 'README.md',
    VIEW_FILE_NAME: 'README.md', // Individual prompt READMEs
    VIEW_TEMPLATE_NAME: 'sub-readme.md.njk', // Template for individual prompt READMEs
    README_TEMPLATE_NAME: 'main-readme.md.njk', // Template for the main README
    DEFAULT_CATEGORY: 'uncategorized',
    FORCE_REGENERATE: process.env.FORCE_REGENERATE === 'true', // Check env var for forcing regeneration
    YAML_INDENT: 2,
    YAML_LINE_WIDTH: 100 // Increased for potentially better readability
};
