/**
 * Defines the structure for application-specific errors, extending the built-in Error class.
 */

/**
 * Interface defining the properties of a custom application error.
 * Ensures that all application-specific errors have a unique code for identification
 * and categorization, in addition to the standard error message.
 */
export interface AppErrorType extends Error {
    /**
     * A unique code identifying the type or category of the error (e.g., 'DB_ERROR', 'CONFIG_ERROR').
     * This can be used for more specific error handling, logging, or localization.
     */
    code: string;
}
