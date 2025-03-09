/**
 * Types specific to the 'sync' command, defining data structures related to
 * change tracking, reset operations, and synchronization results.
 */
import { BaseCommandOptions } from './base-options';
import { SyncCommandOptions as BaseSyncOptions } from './options';

/**
 * Enum defining the types of items that can be changed (prompts or fragments).
 * Ensures type safety when referring to change types.
 */
export enum ChangeType {
    PROMPT = 'prompt',
    FRAGMENT = 'fragment'
}

/**
 * Represents a single change item identified during sync or reset operations.
 */
export interface SyncChangeItem {
    /** The type of the item that changed (prompt or fragment). */
    type: ChangeType | 'prompt' | 'fragment'; // Allow string literals for flexibility

    /**
     * The relative path of the changed item within its content directory.
     * For prompts: directory name (e.g., 'my_prompt_agent').
     * For fragments: category/name (e.g., 'common/formatting').
     */
    path: string;

    /**
     * The type of change detected (e.g., 'added', 'modified', 'deleted').
     * This often corresponds to Git status indicators.
     */
    changeType: string;
}

/**
 * Represents the result of a reset operation, summarizing successes and failures.
 */
export interface SyncResetResult {
    /** The number of changes that were successfully reset. */
    successCount: number;
    /** The number of changes that failed to reset. */
    failCount: number;
}

/**
 * Represents the response structure when checking for changes (local or remote).
 * Includes diff information if changes are detected.
 */
export interface SyncChangesResponse {
    /** Indicates whether the change check operation itself was successful. */
    success: boolean;
    /** Error message if the operation failed (e.g., couldn't connect to remote). */
    error?: string;
    /** A string containing the Git diff output, if changes were found. */
    diff?: string;
    /** Optional data object for backward compatibility or additional info. */
    data?: {
        diff?: string;
    };
    /** List of prompt changes detected (primarily used for reset). */
    promptChanges?: { type: string; path: string; originalType: string }[];
    /** List of fragment changes detected (primarily used for reset). */
    fragmentChanges?: { type: string; path: string; originalType: string }[];
    /** Path to a temporary directory used during the operation (if applicable). */
    tempDir?: string;
}

/**
 * Represents the response structure when preparing to push changes.
 */
export interface SyncPushResponse {
    /** Indicates whether the preparation (checking for changes) was successful. */
    success: boolean;
    /** Error message if preparation failed (e.g., no changes found). */
    error?: string;
    /** A formatted string summarizing the changes ready to be pushed. */
    changesSummary?: string;
    /** The name of the branch the changes will be pushed to. */
    branchName?: string;
}

/**
 * Extended options for the 'sync' command, including the base command options
 * like `isInteractive`. This is used when the sync command needs context about
 * whether it's being run directly or from an interactive menu.
 */
export interface SyncCommandOptionsEx extends BaseSyncOptions, BaseCommandOptions {}
