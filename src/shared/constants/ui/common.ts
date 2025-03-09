/**
 * Common UI elements, formatters, and messages shared across multiple commands
 * and UI components within the application.
 */
import chalk from 'chalk';

import { UI_ICONS } from './formatting';
import { ERROR_MESSAGES, INFO_MESSAGES, WARNING_MESSAGES } from './messages'; // Import centralized messages

/**
 * Common UI formatting functions and message constants.
 */
export const COMMON_UI = {
    /** Standardized icons for different message levels. */
    ICONS: UI_ICONS,

    /** Functions to format messages with standard icons and colors. */
    FORMATTERS: {
        /** Formats an error message with icon and red color. */
        formatError: (message: string): string => `${chalk.red(UI_ICONS.ERROR)} ${chalk.red(message)}`,
        /** Formats a success message with icon and green color. */
        formatSuccess: (message: string): string => `${chalk.green(UI_ICONS.SUCCESS)} ${chalk.green(message)}`,
        /** Formats a warning message with icon and yellow color. */
        formatWarning: (message: string): string => `${chalk.yellow(UI_ICONS.WARNING)} ${chalk.yellow(message)}`,
        /** Formats an info message with icon and cyan color. */
        formatInfo: (message: string): string => `${chalk.cyan(UI_ICONS.INFO)} ${chalk.cyan(message)}`
    },

    /**
     * Centralized access to common messages.
     * This structure mirrors the organization in `messages.ts`.
     * @deprecated Use messages directly from `./messages` where possible. Kept for compatibility.
     */
    MESSAGES: {
        INFO: {
            PRESS_KEY_TO_CONTINUE: INFO_MESSAGES.PRESS_KEY_TO_CONTINUE,
            EXITING: INFO_MESSAGES.EXITING,
            TROUBLESHOOTING_HINTS: INFO_MESSAGES.TROUBLESHOOTING_HINTS,
            VARIABLE_CREATED_HINT: INFO_MESSAGES.VARIABLE_CREATED_HINT
        },
        ERROR: {
            GLOBAL_ERROR: ERROR_MESSAGES.GLOBAL_ERROR,
            EXECUTING_COMMAND: ERROR_MESSAGES.EXECUTING_COMMAND,
            RUNNING_COMMAND: ERROR_MESSAGES.RUNNING_COMMAND,
            PROMPT_EXECUTION_FAILED: ERROR_MESSAGES.PROMPT_EXECUTION_FAILED,
            API_REQUEST_FAILED: ERROR_MESSAGES.API_REQUEST_FAILED
        },
        WARNING: {
            OPERATION_CANCELLED: WARNING_MESSAGES.OPERATION_CANCELLED,
            USER_CANCELLATION: WARNING_MESSAGES.USER_CANCELLATION
        }
    }
};
