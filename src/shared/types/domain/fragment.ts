/**
 * Types related to the domain concept of Prompt Fragments, which are reusable
 * pieces of text that can be included in prompts.
 */

/**
 * Represents a prompt fragment, typically identified by its category and name.
 * This is the core entity for fragments.
 */
export interface PromptFragment {
    /** The unique name of the fragment within its category (e.g., 'formatting_rules'). */
    name: string;

    /** The category the fragment belongs to (e.g., 'common', 'prompt_engineering'). */
    category: string;

    /** The actual content of the fragment (optional, may be loaded separately). */
    content?: string;

    /** The name of the prompt variable this fragment is associated with (optional). */
    variable?: string;

    /** A unique identifier, often constructed as 'category/name'. */
    id?: string;

    /** The relative path to the fragment file (optional). */
    path?: string;
}

/**
 * Extends `PromptFragment` to guarantee the presence of the `path` property.
 * Useful when dealing directly with fragment files.
 */
export interface PromptFragmentWithPath extends PromptFragment {
    /** The guaranteed relative or absolute path to the fragment file. */
    path: string;
}

/**
 * Represents the result of resolving a fragment reference associated with a variable.
 * Contains information about the variable and the resolved fragment content.
 */
export interface FragmentReferenceResult {
    /** Information about the variable that references the fragment. */
    variable: {
        /** The ID of the variable record (database ID or other unique identifier). */
        id: string | number;
        /** The name of the variable (e.g., '{{EXTRA_GUIDELINES}}'). */
        name: string;
    };

    /** The resolved content of the referenced fragment (null if resolution failed). */
    fragmentContent?: string | null;

    /** The path used to reference the fragment (e.g., 'common/formatting_rules'). */
    fragmentPath?: string;
}
