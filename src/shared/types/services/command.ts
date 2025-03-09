/**
 * Types related to command execution and interaction, defining interfaces
 * used by services to interact with command objects without tight coupling.
 */
import { ApiResult } from '../api/result';
import { MenuItem, MenuOptions } from '../ui/menu';

/**
 * Options for configuring confirmation prompts, allowing for non-interactive behavior.
 */
export interface ConfirmOptions {
    /** The default answer (true for yes, false for no) for the confirmation. */
    default?: boolean;
    /** If true, bypass the interactive prompt and use the default value. */
    nonInteractive?: boolean;
}

/**
 * Interface representing a command that has a primary execution method.
 * Useful for type checking when invoking commands programmatically.
 */
export interface ActionableCommand {
    /** The main execution method for the command. */
    executeAction(options: any): Promise<void>;
}

/**
 * Defines a generic interface for command objects, abstracting specific command implementations.
 * This interface is used by services (like menu services, setup services) to interact
 * with commands for UI operations (prompts, menus) and error handling, promoting loose coupling.
 * It aligns with DDD by separating concerns into logical domains (UI, Command Execution, Repository).
 */
export interface CommandInterface {
    // ===== UI Domain Methods (Delegates to uiFacade) =====

    /**
     * Displays an interactive selection menu to the user.
     * @template T - The type of the value associated with each menu choice.
     * @param {string} message - The prompt message displayed to the user.
     * @param {MenuItem<T>[]} choices - An array of items to display in the menu.
     * @param {MenuOptions<T>} [options] - Optional configuration for the menu display.
     * @returns {Promise<T>} A promise resolving to the value of the selected item.
     * @remarks Internally delegates to `uiFacade.selectMenu`.
     */
    selectMenu<T>(message: string, choices: MenuItem<T>[], options?: MenuOptions<T>): Promise<T>;

    /**
     * Pauses execution and waits for the user to press any key.
     * @param {string} [message] - Optional message to display while waiting.
     * @returns {Promise<void>} A promise that resolves when the user presses a key.
     * @remarks Internally delegates to `uiFacade.pressKeyToContinue`.
     */
    pressKeyToContinue(message?: string): Promise<void>;

    /**
     * Displays a confirmation (yes/no) prompt to the user.
     * @param {string} message - The confirmation question.
     * @param {ConfirmOptions} [options] - Optional configuration for the confirmation.
     * @returns {Promise<boolean>} A promise resolving to `true` if confirmed (yes), `false` otherwise.
     * @remarks Internally delegates to `uiFacade.confirm`.
     */
    confirmAction(message: string, options?: ConfirmOptions): Promise<boolean>;

    /**
     * Prompts the user for multiline text input, typically opening an external editor.
     * @param {string} message - The prompt message displayed to the user.
     * @param {string} [initialValue] - Optional initial content for the editor.
     * @param {object} [options] - Optional configuration for the editor prompt (e.g., instructionMessage).
     * @returns {Promise<string>} A promise resolving to the text entered by the user.
     * @remarks Internally delegates to `uiFacade.getMultilineInput`.
     */
    getMultilineInput(
        message: string,
        initialValue?: string,
        options?: { instructionMessage?: string }
    ): Promise<string>;

    /**
     * Prompts the user for a single line of text input.
     * @param {string} message - The prompt message displayed to the user.
     * @param {object} [options] - Optional configuration for the input prompt (e.g., default, allowCancel).
     * @returns {Promise<string | null>} A promise resolving to the text entered by the user, or null if cancelled.
     * @remarks Internally delegates to `uiFacade.getInput`.
     */
    getInput(
        message: string,
        options?: { default?: string; nonInteractive?: boolean; allowCancel?: boolean }
    ): Promise<string | null>;

    // ===== Command Execution Domain Methods (Delegates to errorFacade/commandFacade) =====

    /**
     * Handles errors that occur during command execution, logging them appropriately.
     * @param {unknown} error - The error object or value caught.
     * @param {string} context - A string describing the context where the error occurred (e.g., command name).
     * @remarks Internally delegates to `errorFacade.handleCommandError`.
     */
    handleError(error: unknown, context: string): void;

    /**
     * Processes an `ApiResult` synchronously, logging errors and returning data on success.
     * @template T - The type of the data within the ApiResult.
     * @param {ApiResult<T>} result - The ApiResult object to handle.
     * @param {string} [successMessage] - Optional message to log if the result is successful.
     * @returns {T | null} The data from the result if successful, otherwise `null`.
     * @remarks Internally delegates to `commandFacade.handleApiResultSync`.
     */
    handleApiResultSync<T>(result: ApiResult<T>, successMessage?: string): T | null;

    /**
     * Processes an `ApiResult` asynchronously, logging errors and returning data on success.
     * @template T - The type of the data within the ApiResult.
     * @param {ApiResult<T>} result - The ApiResult object to handle.
     * @param {string} message - A message often used for context or success display.
     * @returns {Promise<T | null>} A promise resolving to the data if successful, otherwise `null`.
     * @remarks Implementation should handle API results appropriately, often delegating to `handleApiResultSync`.
     */
    handleApiResult<T>(result: ApiResult<T>, message: string): Promise<T | null>;

    // ===== Repository & Environment Domain Methods (Delegates to relevant Facades) =====

    /**
     * Checks if the prompt library repository is properly set up.
     * @returns {Promise<boolean>} A promise resolving to `true` if set up, `false` otherwise.
     * @remarks Internally delegates to `repositoryFacade.isLibraryRepositorySetup`.
     */
    isLibraryRepositorySetup(): Promise<boolean>;

    /**
     * Checks if the command is running within a Continuous Integration (CI) environment.
     * @returns {boolean} `true` if running in CI, `false` otherwise.
     * @remarks Internally delegates to `commandFacade.isRunningInCIEnvironment`.
     */
    isRunningInCIEnvironment(): boolean;
}
