/**
 * Constants related to caching behavior within the application.
 * Defines Time-To-Live (TTL) durations and standard cache key prefixes.
 */

/**
 * Standard Cache Time-To-Live (TTL) settings in seconds.
 * These values determine how long cached data remains valid before being considered stale.
 */
export const CACHE_TTL = {
    /** Default TTL for most cached items (10 minutes). */
    DEFAULT: 600,
    /** Short TTL for frequently changing data (1 minute). */
    SHORT: 60,
    /** Medium TTL for moderately stable data (5 minutes). */
    MEDIUM: 300,
    /** Long TTL for relatively static data (1 hour). */
    LONG: 3600,
    /** Very long TTL for data that rarely changes (24 hours). */
    VERY_LONG: 86400,
    /** Infinite TTL - data never expires unless manually cleared. Use with caution. */
    INFINITE: 0
};

/**
 * Standardized cache key prefixes for different types of data.
 * Using prefixes helps organize the cache and allows for targeted invalidation.
 * Example usage: `${CACHE_KEYS.PROMPT}_${promptId}`
 */
export const CACHE_KEYS = {
    /** Prefix for prompt-related data. */
    PROMPT: 'prompt',
    /** Prefix for fragment-related data. */
    FRAGMENT: 'fragment',
    /** Prefix for category-related data. */
    CATEGORY: 'category',
    /** Prefix for variable-related data. */
    VARIABLE: 'variable',
    /** Prefix for configuration data. */
    CONFIG: 'config',
    /** Prefix for AI model-related data. */
    MODEL: 'model',
    /** Prefix for repository-related data. */
    REPOSITORY: 'repository',
    /** Prefix for execution history data. */
    EXECUTION: 'execution',
    /** Prefix for favorite prompts data. */
    FAVORITE: 'favorite'
};
