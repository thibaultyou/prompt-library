/**
 * Defines base option interfaces shared across various CLI commands.
 * These provide a common structure for handling standard command-line flags.
 */

/**
 * Base command options applicable to potentially all commands.
 */
export interface BaseCommandOptions {
    /**
     * Flag indicating whether the command should run without interactive prompts.
     * Useful for scripting or CI environments. If true, required arguments must be provided.
     */
    nonInteractive?: boolean;

    /**
     * Flag indicating whether the command output should be formatted as JSON.
     * Useful for machine-readable output or integration with other tools.
     */
    json?: boolean;

    /**
     * Flag explicitly indicating if the command is being run in an interactive menu context.
     * Helps differentiate between direct CLI execution and menu-driven execution.
     */
    isInteractive?: boolean;

    /**
     * Flag indicating the user requested help information for the command.
     * Typically handled automatically by the command framework (e.g., Commander.js).
     */
    help?: boolean;
}

/**
 * Options commonly used by commands that create new resources (e.g., prompts, fragments).
 * Extends BaseCommandOptions.
 */
export interface CreateCommandOptions extends BaseCommandOptions {
    /**
     * Optional path to a file related to the resource being created (e.g., content file).
     */
    path?: string;
    /**
     * Optional name for the resource being created.
     */
    name?: string;
    /**
     * Optional category for the resource being created.
     */
    category?: string;
}

/**
 * Options commonly used by commands that read or view existing resources.
 * Extends BaseCommandOptions.
 */
export interface ReadCommandOptions extends BaseCommandOptions {
    /**
     * Optional name identifier for the resource to read/view.
     */
    name?: string;

    /**
     * Optional numeric or string ID for the resource to read/view.
     */
    id?: string | number;
}

/**
 * Options commonly used by commands that update existing resources.
 * Extends CreateCommandOptions (as updates might involve paths/names) and ReadCommandOptions (to identify the resource).
 */
export interface UpdateCommandOptions extends CreateCommandOptions, ReadCommandOptions {
    // Inherits path?, name?, category?, id? from extended interfaces.
}

/**
 * Options commonly used by commands that delete existing resources.
 * Extends BaseCommandOptions.
 */
export interface DeleteCommandOptions extends BaseCommandOptions {
    /**
     * Optional name identifier for the resource to delete.
     */
    name?: string;

    /**
     * Optional numeric or string ID for the resource to delete.
     */
    id?: string | number;

    /**
     * Flag to bypass confirmation prompts before deletion. Use with caution.
     */
    force?: boolean;
}

/**
 * Options commonly used by commands that list resources.
 * Extends BaseCommandOptions.
 */
export interface ListCommandOptions extends BaseCommandOptions {
    /**
     * Optional category name to filter the list of resources.
     */
    category?: string;

    /**
     * Flag indicating whether to list all resources, potentially bypassing default limits or filters.
     */
    all?: boolean;
}

/**
 * Options commonly used by commands that search for resources.
 * Extends BaseCommandOptions.
 */
export interface SearchCommandOptions extends BaseCommandOptions {
    /**
     * The search term or query string provided by the user.
     */
    query?: string; // Changed from 'keyword' for generality

    /**
     * Optional category name to limit the scope of the search.
     */
    category?: string;
}
