/**
 * Database-related constants, including table names and settings.
 */

/**
 * Standardized database table names used in SQL queries.
 * Using constants helps prevent typos and makes refactoring easier.
 */
export const DB_TABLES = {
    /** Main table storing prompt information. */
    PROMPTS: 'prompts',
    /** Table linking prompts to their subcategories. */
    SUBCATEGORIES: 'subcategories',
    /** Table storing variables defined within prompts. */
    VARIABLES: 'variables',
    /** Table linking prompts to the fragments they use. */
    FRAGMENTS: 'fragments',
    /** Table storing user-defined environment variables. */
    ENV_VARS: 'env_vars',
    /** Table tracking prompt execution history. */
    EXECUTIONS: 'prompt_executions',
    /** Table storing user's favorite prompts. */
    FAVORITES: 'favorite_prompts'
};

/**
 * General database configuration and query settings.
 */
export const DB_SETTINGS = {
    // --- Query Limits ---
    /** Default limit for fetching recent items (e.g., executions). */
    RECENT_LIMIT: 10,
    /** Default limit for search results. */
    SEARCH_LIMIT: 50,
    /** Maximum number of items to display in lists before summarizing. */
    LIST_LIMIT: 100,

    // --- Cache Settings ---
    /** Initial estimated size of the cache (number of items). */
    INITIAL_CACHE_SIZE: 200,
    /** Interval for automatic cache purging (in milliseconds, e.g., 1 hour). */
    CACHE_PURGE_INTERVAL: 3600000, // 1 hour

    // --- Connection Settings (Conceptual - SQLite specific settings are simpler) ---
    /** Timeout for establishing a database connection (in milliseconds). */
    CONNECTION_TIMEOUT: 5000, // 5 seconds
    /** Maximum number of concurrent connections (more relevant for server databases). */
    MAX_CONNECTIONS: 1 // SQLite typically uses a single connection per process
};
