/**
 * Types specific to the 'execute' command, defining its options and related structures.
 */
import { BaseCommandOptions } from './base-options';

/**
 * Interface defining the command-line options accepted by the 'execute' command.
 * Extends BaseCommandOptions for common flags. Allows for dynamic options representing variables.
 */
export interface ExecuteCommandOptions extends BaseCommandOptions {
    /**
     * Identifier (ID or name) of a stored prompt in the library to execute.
     */
    prompt?: string;

    /**
     * Path to a local prompt content file (.md) to execute. Requires --metadata-file.
     */
    promptFile?: string;

    /**
     * Path to the corresponding metadata file (.yml) when executing a local prompt file.
     * Required if --prompt-file is used.
     */
    metadataFile?: string;

    /**
     * Flag to inspect the prompt's variables and structure without actually executing it with the AI model.
     */
    inspect?: boolean;

    /**
     * Object mapping variable names to file paths. The content of each file will be used
     * as the value for the corresponding variable during execution.
     * Populated by multiple uses of the --file-input/-fi option (e.g., `-fi var1=path1 -fi var2=path2`).
     */
    fileInput?: FileInputOptions; // Changed from Record<string, string> to specific type

    /**
     * Allows any other command-line options (typically starting with --) to be treated
     * as dynamic variables passed to the prompt. The keys are variable names (snake_case),
     * and values are the corresponding variable values.
     */
    [key: string]: unknown; // Index signature for dynamic options
}

/**
 * Structure representing file inputs provided via the --file-input/-fi option.
 * Maps variable names (keys) to the file paths (values) containing their content.
 */
export interface FileInputOptions {
    /** Key: Variable name (string). Value: File path (string). */
    [variable: string]: string;
}

/**
 * Structure representing dynamic variable values provided directly as command-line options
 * (e.g., --my_variable "some value").
 * Maps variable names (keys, typically snake_case) to their string values.
 */
export interface DynamicVariableOptions {
    /** Key: Variable name (string). Value: Variable value (string). */
    [variable: string]: string;
}
