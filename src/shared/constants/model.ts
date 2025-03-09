/**
 * Constants related to AI models, providers, and default settings.
 */

/**
 * Standard identifiers for supported AI model providers.
 * Using 'as const' ensures the values are treated as literal types.
 */
export const PROVIDERS = {
    /** Identifier for Anthropic models (Claude). */
    ANTHROPIC: 'anthropic',
    /** Identifier for OpenAI models (GPT). */
    OPENAI: 'openai'
} as const; // Use 'as const' for stricter typing

/**
 * Type definition for supported AI model providers.
 * Derived directly from the values of the PROVIDERS constant.
 * Ensures only 'anthropic' or 'openai' can be used.
 */
export type ModelProvider = (typeof PROVIDERS)[keyof typeof PROVIDERS];

/**
 * Known Anthropic model identifiers.
 * Keeping this list helps provide suggestions and defaults.
 * Note: This list might become outdated; fetching dynamically is preferred when possible.
 */
export const ANTHROPIC_MODELS = {
    CLAUDE_3_7_SONNET: 'claude-3-7-sonnet-20250219', // Hypothetical future model
    CLAUDE_3_5_SONNET_LATEST: 'claude-3-5-sonnet-20241022', // Hypothetical future model
    CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20240620', // Current recommended
    CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022', // Hypothetical future model
    CLAUDE_3_OPUS: 'claude-3-opus-20240229',
    CLAUDE_3_SONNET: 'claude-3-sonnet-20240229', // Note: Older Sonnet version
    CLAUDE_3_HAIKU: 'claude-3-haiku-20240307'
};

/**
 * Known OpenAI model identifiers.
 * Keeping this list helps provide suggestions and defaults.
 * Note: This list might become outdated; fetching dynamically is preferred when possible.
 */
export const OPENAI_MODELS = {
    GPT_4o: 'gpt-4o', // Current recommended
    GPT_4o_MINI: 'gpt-4o-mini',
    GPT_4_TURBO_LATEST: 'gpt-4-turbo-2024-04-09', // Alias for latest GPT-4 Turbo
    GPT_4_TURBO: 'gpt-4-turbo',
    GPT_4_VISION: 'gpt-4-vision-preview', // Vision model often has 'preview'
    GPT_4: 'gpt-4',
    GPT_3_5_TURBO_LATEST: 'gpt-3.5-turbo-0125', // Latest GPT-3.5 Turbo
    GPT_3_5_TURBO: 'gpt-3.5-turbo' // Generic alias, often points to latest
};

/**
 * Default settings for AI models used when specific configuration is missing.
 */
export const MODEL_DEFAULTS = {
    /** Default maximum number of tokens to generate in a response. */
    MAX_TOKENS: 8000,
    /** Default Anthropic model identifier. */
    ANTHROPIC_MODEL: ANTHROPIC_MODELS.CLAUDE_3_5_SONNET, // Use current recommended
    /** Default OpenAI model identifier. */
    OPENAI_MODEL: OPENAI_MODELS.GPT_4o, // Use current recommended
    /** Default temperature setting for model generation (controls randomness). */
    TEMPERATURE: 0.7 // A common default value
};
