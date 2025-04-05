/**
 * Types specific to the 'config' command, defining its actions and options.
 */
import { BaseCommandOptions } from './base-options';
import { ConfigAction } from '../ui/action-types';

/**
 * Type alias for config command actions, referencing the centralized action types.
 * Ensures consistency with UI action definitions.
 */
export type ConfigCommandAction = ConfigAction;

/**
 * Interface defining the command-line options accepted by the 'config' command.
 * Extends the BaseCommandOptions for common flags like --json, --nonInteractive.
 */
export interface ConfigCommandOptions extends BaseCommandOptions {
    /**
     * The configuration key to view or modify.
     * If only --key is provided, the command views the key's value.
     * If --key and --value are provided, the command sets the key's value.
     */
    key?: string;

    /**
     * The new value to assign to the specified configuration key.
     * Used in conjunction with the --key option.
     */
    value?: string;

    /**
     * Flag indicating that the configuration should be reset to its default values.
     * If true, ignores --key and --value options.
     */
    reset?: boolean;

    /**
     * Flag indicating that all application data (prompts, fragments, history)
     * should be flushed. This operation preserves the configuration itself.
     * If true, ignores other config-specific options.
     */
    flush?: boolean;
}
