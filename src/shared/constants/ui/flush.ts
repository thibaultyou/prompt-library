/**
 * UI constants specific to the 'flush' command.
 * Defines text related to flushing application data.
 */
import { SUCCESS_MESSAGES, ERROR_MESSAGES, WARNING_MESSAGES, INFO_MESSAGES } from './messages'; // Import centralized messages

export const FLUSH_UI = {
    /**
     * Descriptions used in command help text.
     */
    DESCRIPTIONS: {
        /** Description for the 'flush' command. */
        COMMAND: '⚠️ Flush and reset all application data (prompts, fragments, history). Preserves configuration.'
    },

    /**
     * Success messages specific to the flush operation.
     */
    SUCCESS: {
        /** Message shown when data flush completes successfully. */
        FLUSH_COMPLETED: SUCCESS_MESSAGES.FLUSH_COMPLETED
    },

    /**
     * Error messages specific to the flush operation.
     */
    ERRORS: {
        /** Error message if confirmation fails. */
        CONFIRM_FLUSH_FAILED: ERROR_MESSAGES.CONFIRM_FLUSH_FAILED,
        /** Error message if the flush operation itself fails. */
        FLUSH_OPERATION_FAILED: ERROR_MESSAGES.FLUSH_OPERATION_FAILED
    },

    /**
     * Warning messages specific to the flush operation.
     */
    WARNINGS: {
        /** Message shown if the user cancels the flush operation. */
        FLUSH_CANCELLED: WARNING_MESSAGES.FLUSH_CANCELLED
    },

    /**
     * Informational messages and prompts for the flush operation.
     */
    INFO: {
        /** Confirmation prompt message shown before flushing data. */
        CONFIRM_FLUSH: INFO_MESSAGES.CONFIRM_FLUSH
    }
};
