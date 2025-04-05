/**
 * Utility types defining common option structures used across various commands,
 * particularly for interactive prompts and command execution control.
 */
import { BaseCommandOptions } from './base-options';

/**
 * Options for configuring text input prompts.
 */
export interface InputOptions {
    /**
     * Optional function to validate the user's input.
     * Should return `true` if valid, or a string containing an error message if invalid.
     */
    validate?: (input: string) => boolean | string;

    /**
     * Default value to pre-fill in the input prompt.
     */
    default?: string;

    /**
     * Flag indicating whether the input should behave non-interactively.
     * If true, it might use the default value or fail if no default is available.
     */
    nonInteractive?: boolean;

    /**
     * Flag indicating if the user can cancel the input (e.g., by typing 'cancel').
     */
    allowCancel?: boolean; // Added allowCancel option
}

/**
 * Options for configuring multiline text input prompts (typically using an external editor).
 */
export interface MultilineInputOptions {
    /**
     * Flag indicating whether the input should behave non-interactively.
     * If true, it might use the initial value directly or fail.
     */
    nonInteractive?: boolean;

    /**
     * Optional message displayed to the user before the editor opens, providing context or instructions.
     */
    instructionMessage?: string;

    /**
     * Optional file extension postfix for the temporary file opened in the editor (e.g., '.md').
     * Helps the editor apply correct syntax highlighting. Defaults to '.txt' or '.md'.
     */
    postfix?: string;
}

/**
 * Options for configuring confirmation (yes/no) prompts.
 */
export interface ConfirmActionOptions {
    /**
     * Flag indicating whether the confirmation should behave non-interactively.
     * If true, it will typically use the `defaultValue`.
     */
    nonInteractive?: boolean;

    /**
     * The default selection for the confirmation prompt (true for 'yes', false for 'no').
     * Also used as the assumed answer in non-interactive mode.
     */
    defaultValue?: boolean;
}

/**
 * Options for controlling how a command is run, particularly when invoked from another command or service.
 */
export interface CommandRunOptions {
    /**
     * Flag indicating whether the console should be cleared before executing the command.
     */
    clearConsole?: boolean;

    /**
     * Array of additional string arguments to pass to the command during execution.
     */
    args?: string[];
}

/**
 * Options specific to the 'sync' command.
 * Extends BaseCommandOptions for common flags.
 */
export interface SyncCommandOptions extends BaseCommandOptions {
    /**
     * Option to explicitly set the remote repository URL for the sync operation,
     * overriding the configured URL.
     */
    url?: string;

    /**
     * Flag to force the sync operation (e.g., pulling changes) without requiring user confirmation,
     * even if potential conflicts or significant changes are detected. Use with caution.
     */
    force?: boolean;

    /**
     * Flag indicating the user wants to push local committed changes to the remote repository.
     */
    push?: boolean;

    /**
     * Flag indicating the user wants to view a list of pending local changes,
     * often leading to an interactive menu for managing them (push/reset).
     */
    list?: boolean;

    /**
     * Flag indicating the user wants to reset (discard) local uncommitted changes,
     * reverting files to their state in the last commit (HEAD).
     */
    reset?: boolean;

    /**
     * Option to specify the target branch name when pushing changes.
     * If not provided, defaults might be used (e.g., 'main' or a generated name).
     */
    branch?: string;
}
