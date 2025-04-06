/**
 * Types specific to the 'env' command and its subcommands (list, create, read, update, delete).
 * Defines actions and options for managing environment variables.
 */
import { BaseCommandOptions } from './base-options';
import { EnvAction } from '../ui/action-types';

/**
 * Base command options specifically for environment variable commands.
 * Currently identical to BaseCommandOptions but provides a specific type alias.
 */
export type BaseEnvCommandOptions = BaseCommandOptions;

/**
 * Options for the main 'env' command, primarily for backward compatibility
 * with legacy flags before subcommands were introduced.
 */
export interface EnvCommandOptions extends BaseEnvCommandOptions {
    /** Legacy flag equivalent to 'env list'. */
    list?: boolean;

    /** Legacy flag equivalent to 'env update --key-value <KEY=VALUE>'. */
    set?: string;

    /** Legacy flag equivalent to 'env create --key-value <KEY=VALUE>'. */
    create?: string;

    /** Legacy flag equivalent to 'env delete --name <KEY>'. */
    unset?: string;

    /** Legacy flag equivalent to 'env read --name <KEY>'. */
    info?: string;

    /** Legacy flag equivalent to 'env read --name <KEY> --value'. */
    view?: string;

    /** Legacy flag equivalent to 'env read --name <KEY> --sources'. */
    sources?: string;

    /** Legacy flag used with --sources to show prompt titles. */
    showTitles?: boolean;
}

/**
 * Type alias for environment variable management actions, referencing centralized types.
 */
export type EnvManagementAction = EnvAction;

/**
 * Type defining possible actions during interactive variable creation.
 */
export type EnvCreationAction = 'value' | 'fragment' | 'back';

/**
 * Options specific to the 'env list' subcommand.
 */
export interface EnvListCommandOptions extends BaseEnvCommandOptions {
    // Currently, only inherits base options. Add specific list options here if needed.
    list?: boolean; // This flag is implicit when using the 'list' subcommand.
}

/**
 * Options specific to the 'env create' subcommand.
 */
export interface EnvCreateCommandOptions extends BaseEnvCommandOptions {
    /**
     * Option to create a variable with a direct value using the format 'KEY=VALUE'.
     */
    keyValue?: string;

    /**
     * Option to create a variable referencing a fragment using the format 'KEY=category/name'.
     */
    fragment?: string;
}

/**
 * Options specific to the 'env read' subcommand.
 */
export interface EnvReadCommandOptions extends BaseEnvCommandOptions {
    /**
     * The name of the variable to read information about.
     */
    name?: string;

    /**
     * Flag or variable name to indicate showing prompt sources.
     * If boolean `true`, used with `name`. If string, `sources` *is* the variable name.
     */
    sources?: string | boolean;

    /**
     * Flag or variable name to indicate viewing the variable's value.
     * If boolean `true`, used with `name`. If string, `view` *is* the variable name.
     * @deprecated Use --value flag instead.
     */
    view?: string | boolean;

    /**
     * Flag to show prompt titles instead of IDs when using --sources.
     */
    showTitles?: boolean;

    /**
     * Flag to indicate viewing only the variable's resolved value. Used with --name.
     */
    value?: boolean;
}

/**
 * Options specific to the 'env update' subcommand.
 */
export interface EnvUpdateCommandOptions extends BaseEnvCommandOptions {
    /**
     * Option to update a variable with a direct value using the format 'KEY=VALUE'.
     */
    keyValue?: string;

    /**
     * Option to update a variable to reference a fragment using the format 'KEY=category/name'.
     */
    fragment?: string;

    /**
     * Option to clear the value of an inferred variable or delete a custom variable by name.
     */
    clear?: string;
}

/**
 * Options specific to the 'env delete' subcommand.
 */
export interface EnvDeleteCommandOptions extends BaseEnvCommandOptions {
    /**
     * The name of the custom environment variable to delete.
     */
    name?: string;

    /**
     * Flag to bypass the confirmation prompt before deleting.
     */
    force?: boolean;
}
