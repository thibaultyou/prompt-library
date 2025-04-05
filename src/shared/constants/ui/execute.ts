/**
 * UI constants specific to the 'execute' command.
 * Defines text, descriptions, options, and structure for the prompt execution interface.
 */
export const EXECUTE_UI = {
    /**
     * Descriptions used in command help text.
     */
    DESCRIPTIONS: {
        /** Description for the main 'execute' command. */
        COMMAND: 'Execute a prompt with provided variables or inspect its requirements.'
    },

    /**
     * Descriptions for command-line options specific to the 'execute' command.
     */
    OPTIONS: {
        /** Description for the --prompt/-p option. */
        PROMPT_ID: 'ID or name of the stored prompt to execute.',
        /** Description for the --prompt-file/-f option. */
        PROMPT_FILE: 'Path to a local prompt file (.md) to execute.',
        /** Description for the --metadata-file/-m option. */
        METADATA_FILE: 'Path to the corresponding metadata file (.yml) for a local prompt.',
        /** Description for the --inspect/-i option. */
        INSPECT: "Inspect the prompt's variables and structure without executing.",
        /** Description for the --file-input/-fi option. */
        FILE_INPUT:
            'Provide file content as input for a variable (format: variable_name=filepath). Can be used multiple times.',
        /** Description for the --verbose option (if added). */
        VERBOSE: 'Show detailed output during execution, including the final prompt sent to the AI.'
    },

    /**
     * Titles and icons for different sections within the 'execute' command's UI.
     */
    SECTION_HEADER: {
        /** Main title for the prompt execution section. */
        TITLE: 'Execute Prompt',
        /** Default icon for prompt execution. */
        ICON: '🚀',
        /** Title for the variable inspection view. */
        INSPECT: 'Prompt Variables & Structure',
        /** Icon for the inspection view. */
        INSPECT_ICON: '🔍',
        /** Title for the interactive prompt browsing section. */
        BROWSE: 'Browse & Execute Prompts',
        /** Icon for the prompt browsing section. */
        BROWSE_ICON: '📚'
    },

    /**
     * UI elements related to displaying and inputting prompt variables.
     */
    VARIABLES: {
        /** Header for the list of available variables. */
        HEADER: 'Prompt Variables:',
        /** Header for file inputs provided via CLI. */
        FILE_INPUTS: 'File Inputs:',
        /** Message shown when a prompt has no variables. */
        NO_VARIABLES: 'This prompt does not require any variables.',
        /** Header for variable descriptions section. */
        DESCRIPTIONS: 'Variable Descriptions:',
        /** Indicator for a required variable. */
        REQUIRED: '(required)',
        /** Indicator for an optional variable. */
        OPTIONAL: '(optional)',
        /** Label for variable type. */
        TYPE: 'Type:',
        /** Label for variable default value. */
        DEFAULT: 'Default:',
        /** Label for variable description/role. */
        DESCRIPTION: 'Description:'
    },

    /**
     * Status messages displayed during prompt processing and execution.
     */
    PROCESSING: {
        /** Message shown while preparing the prompt and variables. */
        PREPARING: 'Preparing prompt...',
        /** Message shown while loading prompt data. */
        LOADING: 'Loading prompt...',
        /** Message shown during AI processing. */
        PROCESSING: 'Processing prompt with AI...',
        /** General execution message. */
        EXECUTING: 'Executing prompt...',
        /** Message shown while loading variable details. */
        LOADING_VARIABLES: 'Loading prompt variables...',
        /** Message shown when reading content from a file input. */
        READING_FILE: 'Reading file input: {0}...',
        /** Header indicating the AI's response. */
        RESPONSE: 'AI Response:',
        /** Message indicating successful completion. */
        COMPLETE: 'Execution complete.'
    },

    /**
     * UI elements for the interactive prompt browser within the execute command.
     */
    BROWSE: {
        /** Main title for the prompt selection menu. */
        TITLE: 'Select a prompt to execute or inspect:',
        /** Title for the category selection menu. */
        CATEGORY_TITLE: 'Select a category:',
        /** Title for the prompt selection menu within a category. */
        PROMPT_TITLE: 'Select a prompt:',
        /** Header label for the category list. */
        CATEGORY_HEADER: 'Categories',
        /** Menu item label for browsing all prompts. */
        ALL_PROMPTS: 'All Prompts',
        /** Menu item label for browsing recently used prompts. */
        RECENT_PROMPTS: 'Recent Prompts',
        /** Menu item label for browsing favorite prompts. */
        FAVORITE_PROMPTS: 'Favorite Prompts'
    },

    /**
     * UI elements for displaying information about the prompt being executed or inspected.
     */
    PROMPT_INFO: {
        /** Notice displayed when using the --inspect flag. */
        INSPECTION_NOTICE: 'Showing variables without executing. Run without --inspect to execute.',
        /** Notice displayed before showing variables during execution. */
        EXECUTION_NOTICE: 'Executing prompt with the following variables:',
        /** Header for the prompt information section. */
        HEADER: 'Prompt Information:',
        /** Label for the prompt ID. */
        ID: 'ID:',
        /** Label for the prompt title. */
        TITLE: 'Title:',
        /** Label for the prompt category. */
        CATEGORY: 'Category:',
        /** Label for the prompt description. */
        DESCRIPTION: 'Description:',
        /** Label for the prompt tags. */
        TAGS: 'Tags:',
        /** Label for the prompt version (if available). */
        VERSION: 'Version:',
        /** Label for the prompt author (if available). */
        AUTHOR: 'Author:'
    },

    /**
     * Standard error messages specific to the 'execute' command.
     */
    ERRORS: {
        /** Error when a specified prompt ID or name is not found. */
        PROMPT_NOT_FOUND: 'Prompt not found: {0}',
        /** Error when a provided file path is invalid or inaccessible. */
        INVALID_FILE_PATH: 'Invalid or inaccessible file path: {0}',
        /** Error when metadata file content doesn't match the prompt file (e.g., hash mismatch). */
        METADATA_MISMATCH: 'Metadata file does not correspond to the provided prompt file.',
        /** Error when a required variable is not provided via CLI or file input. */
        VARIABLE_REQUIRED: 'Required variable not provided: {0}',
        /** Error when a file specified via -fi cannot be found or read. */
        FILE_NOT_FOUND: 'Input file not found or cannot be read: {0}',
        /** Error when running non-interactively without specifying a prompt. */
        PROMPT_ID_REQUIRED:
            'Please provide a prompt ID/name (--prompt) or file paths (--prompt-file, --metadata-file).',
        /** JSON error variant for missing prompt specification. */
        PROMPT_ID_REQUIRED_JSON: 'Prompt ID/name or file paths required in non-interactive/JSON mode.',
        /** General error message for failed prompt execution. */
        EXECUTION_FAILED: 'Failed to execute prompt.'
    },

    /**
     * Usage examples shown in the command's help text.
     */
    EXAMPLES: {
        /** Title for the examples section. */
        TITLE: 'Examples:',
        /** Example of inspecting a prompt. */
        INSPECT: '  $ prompt-library-cli execute -p "git_commit_agent" --inspect',
        /** Example of executing a prompt from local files. */
        FILE_PROMPT: '  $ prompt-library-cli execute -f ./my_prompt.md -m ./my_metadata.yml',
        /** Example of executing a prompt with variables and file input. */
        VARIABLES:
            '  $ prompt-library-cli execute -p "translator" --target_language "French" -fi source_text=./document.txt'
    },

    /**
     * Detailed help text added after the main command description.
     */
    HELP_TEXT: {
        /** Explanation of how to provide dynamic options (variables). */
        DYNAMIC_OPTIONS: `
Dynamic Options:
  Variables defined in the prompt's metadata can be provided directly as command-line
  options (e.g., --variable_name "value"). Use snake_case for variable names.
  Alternatively, use --file-input (or -fi) to provide file content for a variable:
  -fi variable_name=/path/to/your/file.txt`,

        /** List of common variables often found in prompts. */
        COMMON_VARIABLES: `
Common Variables (if defined in prompt):
  --safety_guidelines           Provide specific safety rules for the AI.
  --output_format              Specify the desired output format (e.g., JSON, Markdown).
  --extra_guidelines           Add supplementary instructions or context.`,

        /** Pointer to further documentation. */
        MORE_INFO: 'For more details and advanced usage, refer to the project documentation.',

        /**
         * Combined help text block used with `addHelpText('after', ...)`.
         */
        FULL: `
Dynamic Options:
  Variables defined in the prompt's metadata can be provided directly as command-line
  options (e.g., --variable_name "value"). Use snake_case for variable names.
  Alternatively, use --file-input (or -fi) to provide file content for a variable:
  -fi variable_name=/path/to/your/file.txt

Examples:
  $ prompt-library-cli execute -p 74 --source_language english --target_language french
  $ prompt-library-cli execute -f prompt.md -m metadata.yml -fi communication=input.txt

Common Variables (if defined in prompt):
  --safety_guidelines           Provide specific safety rules for the AI.
  --output_format              Specify the desired output format (e.g., JSON, Markdown).
  --extra_guidelines           Add supplementary instructions or context.

For more details and advanced usage, refer to the project documentation.`
    }
};
