/**
 * Types related to the concept of Categories within the domain,
 * primarily used for organizing prompts.
 */

/**
 * Represents a prompt item within a specific category context.
 * Often used in listings and menus where prompts are grouped by category.
 */
export interface CategoryItem {
    /** The unique identifier of the prompt (typically corresponds to the database ID). */
    id: string;

    /** The user-friendly title of the prompt. */
    title: string;

    /** The primary category the prompt belongs to. */
    primary_category: string;

    /**
     * Alias for `primary_category`. Included for potential backward compatibility
     * or alternative naming conventions.
     * @deprecated Use `primary_category` for consistency.
     */
    category?: string;

    /** A brief description of the prompt's purpose. */
    description: string;

    /**
     * The relative path (directory name) where the prompt's files are stored
     * within the main prompts directory.
     */
    path: string;

    /** An array of secondary category names or tags associated with the prompt. */
    subcategories: string[];
}
