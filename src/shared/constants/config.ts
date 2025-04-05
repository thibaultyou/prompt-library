/**
 * Constants related to CLI configuration, including environment variable keys,
 * default configuration values, and identifiers for sensitive keys.
 */

/**
 * Standard keys used for environment variables that configure the application.
 * Using constants helps avoid typos and ensures consistency.
 */
export const ENV_KEYS = {
    // --- AI Model Configuration ---
    /** Environment variable for the Anthropic API key. */
    ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
    /** Environment variable for the OpenAI API key. */
    OPENAI_API_KEY: 'OPENAI_API_KEY',
    /** Environment variable to select the primary AI provider ('anthropic' or 'openai'). */
    MODEL_PROVIDER: 'MODEL_PROVIDER',
    /** Environment variable for the specific Anthropic model identifier. */
    ANTHROPIC_MODEL: 'ANTHROPIC_MODEL',
    /** Environment variable for the specific OpenAI model identifier. */
    OPENAI_MODEL: 'OPENAI_MODEL',
    /** Environment variable for Anthropic max tokens setting. */
    ANTHROPIC_MAX_TOKENS: 'ANTHROPIC_MAX_TOKENS',
    /** Environment variable for OpenAI max tokens setting. */
    OPENAI_MAX_TOKENS: 'OPENAI_MAX_TOKENS',

    // --- Repository Configuration ---
    /** Environment variable for the remote Git repository URL. */
    REMOTE_REPOSITORY: 'REMOTE_REPOSITORY',
    /** Environment variable for the Git user name (used for commits). */
    GIT_USERNAME: 'GIT_USERNAME',
    /** Environment variable for the Git user email (used for commits). */
    GIT_EMAIL: 'GIT_EMAIL',
    /** Environment variable for the default Git branch. */
    DEFAULT_BRANCH: 'DEFAULT_BRANCH',
    /** Environment variable to disable Git integration ('true' or 'false'). */
    USE_GIT: 'USE_GIT',

    // --- Application Behavior ---
    /** Environment variable to set the logging level ('debug', 'info', 'warn', 'error'). */
    LOG_LEVEL: 'LOG_LEVEL',
    /** Environment variable indicating the execution context ('cli', 'dev', 'test'). */
    CLI_ENV: 'CLI_ENV',
    /** Environment variable to force metadata regeneration ('true' or 'false'). */
    FORCE_REGENERATE: 'FORCE_REGENERATE',
    /** Environment variable to enable/disable file logging ('true' or 'false'). */
    LOG_TO_FILE: 'LOG_TO_FILE'
};

/**
 * Default configuration values used if not overridden by environment variables
 * or the configuration file (`.config/config.json`).
 */
export const DEFAULT_CONFIG = {
    // Environment settings
    CLI_ENV: 'cli',
    LOG_LEVEL: 'info',

    // AI Model settings
    MODEL_PROVIDER: 'anthropic',
    ANTHROPIC_MODEL: 'claude-3-5-sonnet-20240620', // Default to the latest known good model
    ANTHROPIC_MAX_TOKENS: 8000,
    OPENAI_MODEL: 'gpt-4o', // Default to the latest known good model
    OPENAI_MAX_TOKENS: 8000,

    // File naming conventions
    PROMPT_FILE_NAME: 'prompt.md',
    METADATA_FILE_NAME: 'metadata.yml',

    // Repository settings
    DEFAULT_BRANCH: 'main',
    USE_GIT: true, // Git integration enabled by default
    REMOTE_REPOSITORY: '', // No default remote repository
    UPSTREAM_REPOSITORY: '',
    DOWNSTREAM_REPOSITORIES: [] as string[]
};

/**
 * List of substrings used to identify sensitive configuration keys.
 * Values associated with these keys should be masked or handled securely
 * in logs and UI displays. Case-insensitive matching is typically used.
 */
export const SENSITIVE_CONFIG_KEYS = [
    'API_KEY', // General API Key
    'SECRET', // General Secret
    'TOKEN', // Auth tokens, API tokens
    'PASSWORD', // Passwords
    'CREDENTIAL', // Credentials
    'PASSPHRASE', // Passphrases
    'ACCESS_KEY', // Access Keys (e.g., AWS)
    'GITHUB_TOKEN', // Specific GitHub token
    'GITLAB_TOKEN' // Specific GitLab token
];
