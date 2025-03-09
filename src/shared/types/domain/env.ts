/**
 * Types related to the domain concept of Environment Variables,
 * including their storage structure and different informational views.
 */

/**
 * Represents the core structure of an environment variable as stored in the database.
 */
export interface EnvVariable {
    /** The unique database identifier for the variable. */
    id: number;

    /**
     * The name of the environment variable. Stored in a consistent format (e.g., uppercase snake_case).
     */
    name: string;

    /** The current value assigned to the variable. Can be a direct value, fragment ref, or env ref. */
    value: string;

    /** The scope of the variable ('global' or 'prompt'). */
    scope: 'global' | 'prompt';

    /** The associated prompt ID if the scope is 'prompt'. Null for global variables. */
    prompt_id?: number | null;

    /** Optional description of the variable's purpose. */
    description?: string;

    /** Flag indicating if the value is sensitive and should be masked. */
    is_secret?: boolean;
}

/**
 * Represents basic information about a unique variable, aggregating its usage across prompts.
 * Used for listing all known variables (both inferred from prompts and custom-defined).
 */
export interface EnvVariableInfo {
    /** The name of the variable (consistent format, e.g., snake_case). */
    name: string;

    /** A description of the variable's role or purpose, often derived from prompt metadata. */
    role: string;

    /** An array of prompt IDs where this variable is used (inferred). Empty for custom variables. */
    promptIds: string[];

    /** Flag indicating if the variable is inferred from at least one prompt. */
    isInferred?: boolean;

    /** Flag indicating if the variable currently has a value set in the env_vars table. */
    isSet?: boolean;
}

/**
 * Represents detailed information about a variable's current value and type.
 * Used when viewing the specific value of a variable.
 */
export interface VariableValueInfo {
    /** The name of the variable (consistent format). */
    name: string;

    /** The current raw value assigned to the variable, if set. */
    value?: string;

    /** Indicates if the `value` field holds a reference to a fragment (e.g., "Fragment: category/name"). */
    isFragmentReference: boolean;

    /** The fragment path (e.g., "category/name") if `isFragmentReference` is true. */
    reference?: string;

    /** The resolved content of the fragment, if applicable and successfully loaded. */
    fragmentContent?: string;

    /** Indicates if the variable's name or value suggests it's sensitive (e.g., API key). */
    isSensitive: boolean;

    /** The type of the resolved value ('fragment' or 'direct'). */
    valueType?: 'fragment' | 'direct';
}

/**
 * Represents information about the sources (prompts) where a variable is used.
 * Used when viewing the usage context of a variable.
 */
export interface VariableSourceInfo {
    /** The name of the variable (consistent format). */
    name: string;

    /** The description or role of the variable. */
    description?: string;

    /** An array of prompt IDs where this variable is used. */
    promptIds: string[];

    /** Optional array containing details (ID and title) of the prompts using this variable. */
    prompts?: Array<{ id: string; title: string }>;
}

/**
 * Represents comprehensive details about a specific environment variable, combining
 * usage context, current value, and type information. Used for detailed views.
 */
export interface VariableDetailInfo {
    /** The name of the variable (consistent format). */
    name: string;

    /** The description or role of the variable. */
    description?: string;

    /** Indicates if the variable has a value currently set. */
    isSet: boolean;

    /** The current raw value, if set. Masked if sensitive. */
    value?: string;

    /** Indicates if the current value is a fragment reference. */
    isFragment?: boolean;

    /** The resolved content of the fragment, if applicable. */
    fragmentContent?: string;

    /** Indicates if the variable is inferred from prompt usage. */
    inferred: boolean;

    /** An array of prompt IDs where this variable is used. */
    promptIds?: string[];

    /** Optional array containing details (ID and title) of the prompts using this variable. */
    prompts?: Array<{ id: string; title: string }>;
}
