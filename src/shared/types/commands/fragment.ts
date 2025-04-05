/**
 * Types specific to the 'fragments' command group and its subcommands.
 */
import { UpdateCommandOptions as BaseUpdateOptions, DeleteCommandOptions as BaseDeleteOptions } from './base-options';
import { ApiResult } from '../api/result';
import { FragmentAction } from '../ui/action-types';

/**
 * Extends the standard ApiResult to include optional metadata, specifically
 * used here to track if a new category was created during fragment creation.
 */
export interface ExtendedApiResult<T> extends ApiResult<T> {
    /** Internal flag indicating if a new category was created during the operation. */
    _createdNewCategory?: boolean;
    /** Internal field storing the name of the newly created category, if applicable. */
    _categoryName?: string;
}

/**
 * Options specific to fragment update/edit commands.
 * Extends base update options and adds the 'category' identifier.
 */
export interface FragmentEditOptions extends BaseUpdateOptions {
    /** The category of the fragment being edited/updated. */
    category?: string;
    /** The content to update the fragment with (optional, can be from file or editor). */
    content?: string;
    /** Path to a file containing the new content (optional). */
    file?: string;
}

/**
 * Represents the structure of the Update command, including its execution method
 * and a specific method for the update logic (used internally or by services).
 * @deprecated This type might be overly specific; consider simplifying command interactions.
 */
export type UpdateCommandWithMethods = {
    /** Executes the main action of the update command. */
    execute: (options: FragmentEditOptions) => Promise<void>;
    /** Performs the core logic of updating a fragment. */
    updateFragment: (category: string, name: string, content: string) => Promise<boolean>;
};

/**
 * Options specific to fragment delete commands.
 * Extends base delete options and adds the 'category' identifier.
 */
export interface FragmentDeleteOptions extends BaseDeleteOptions {
    /** The category of the fragment being deleted. */
    category?: string;
}

/**
 * Represents the structure of the Delete command, including its execution method
 * and a specific method for the delete logic (used internally or by services).
 * @deprecated This type might be overly specific; consider simplifying command interactions.
 */
export type DeleteCommandWithMethods = {
    /** Executes the main action of the delete command. */
    execute: (options: FragmentDeleteOptions) => Promise<void>;
    /** Performs the core logic of deleting a fragment. */
    deleteFragment: (category: string, name: string) => Promise<boolean>;
};

/**
 * Type alias for fragment command actions, referencing the centralized action types.
 * Ensures consistency with UI action definitions.
 */
export type FragmentCommandAction = FragmentAction;
