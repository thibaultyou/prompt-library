/**
 * Centralized repository for standardized user-facing messages (Success, Error, Warning, Info).
 * Using constants ensures consistency in messaging and simplifies localization or updates.
 */

/**
 * Generic error constants used as fallbacks or for common error types.
 */
export const GENERIC_ERRORS = {
    /** Fallback error message when a specific error is unknown. */
    UNKNOWN_ERROR: 'An unknown error occurred.',
    /** Error indicating required data was missing for an operation. */
    MISSING_DATA: 'Required data is missing to complete the operation.',
    /** Error indicating an invalid operation was attempted. */
    INVALID_OPERATION: 'The requested operation is invalid in the current context.'
};

/**
 * Standard success messages for various operations across the application.
 * Use formatting placeholders like {0}, {1} where dynamic values are needed.
 */
export const SUCCESS_MESSAGES = {
    // --- Setup & Configuration ---
    /** Message shown when application setup completes successfully. */
    SETUP_COMPLETED: '✅ Setup completed successfully!',
    /** Message shown when configuration is updated. */
    CONFIG_UPDATED: 'Configuration updated successfully.',
    /** Message shown when API key is successfully set/updated. */
    API_KEY_SET: '{0} API key set successfully.', // {0} = Provider name
    /** Message shown when model provider is set. */
    PROVIDER_SET: 'Model provider set to {0} successfully.', // {0} = Provider name
    /** Message shown when the default model is set. */
    MODEL_SET: '{0} model set to {1} successfully.', // {0} = Provider name, {1} = Model name

    // --- Prompt Operations ---
    /** Message shown after creating a prompt. Uses {0} for title. */
    PROMPT_CREATED: 'Prompt "{0}" created successfully.',
    /** Message shown after updating a prompt. Uses {0} for title. */
    PROMPT_UPDATED: 'Prompt "{0}" updated successfully.',
    /** Message shown after deleting a prompt. Uses {0} for title. */
    PROMPT_DELETED: 'Prompt "{0}" deleted successfully.',
    /** Message shown after adding a prompt to favorites. */
    PROMPT_FAVORITED: 'Prompt added to favorites.',
    /** Message shown after removing a prompt from favorites. */
    PROMPT_UNFAVORITED: 'Prompt removed from favorites.',
    /** Message shown after refreshing prompt metadata. Uses {0} for title. */
    METADATA_REFRESHED: 'Successfully refreshed metadata for "{0}".',

    // --- Fragment Operations ---
    /** Message shown after creating a fragment. Uses {0} for category, {1} for name. */
    FRAGMENT_CREATED: 'Fragment {0}/{1} created successfully.',
    /** Message shown after updating a fragment. Uses {0} for category, {1} for name. */
    FRAGMENT_UPDATED: 'Fragment {0}/{1} updated successfully.',
    /** Message shown after deleting a fragment. Uses {0} for category, {1} for name. */
    FRAGMENT_DELETED: 'Fragment {0}/{1} deleted successfully.',
    /** Message shown after creating a fragment category. Uses {0} for category name. */
    CATEGORY_CREATED: 'Category "{0}" created successfully.',
    /** Message shown after deleting a fragment category. Uses {0} for category name. */
    CATEGORY_DELETED: 'Category "{0}" deleted successfully.',

    // --- Variable Operations ---
    /** Message shown after setting/updating a variable. Uses {0} for variable name. */
    VARIABLE_SET: 'Variable "{0}" set successfully.',
    /** Message shown after unsetting (clearing/deleting) a variable. Uses {0} for variable name. */
    VARIABLE_UNSET: 'Variable "{0}" unset successfully.',
    /** Message shown after creating a custom variable. Uses {0} for variable name. */
    VARIABLE_CREATED: 'Custom variable "{0}" created successfully.',
    /** Message shown after setting a variable to reference a fragment. Uses {0} for variable name, {1} for fragment path. */
    FRAGMENT_VARIABLE_SET: 'Variable "{0}" set to reference fragment "{1}".',
    /** Message shown after assigning a fragment reference. Uses {0} for fragment path. */
    FRAGMENT_REFERENCE_ASSIGNED: 'Fragment reference assigned: {0}.',
    /** Message shown after setting a variable to reference an environment variable. Uses {0} for variable name, {1} for env var name. */
    ENV_VARIABLE_SET: 'Variable "{0}" set to reference environment variable "{1}".',

    // --- Execution Operations ---
    /** Message shown when prompt execution completes successfully. */
    EXECUTION_COMPLETE: 'Prompt execution completed.',
    /** Message shown when prompt variables are loaded. */
    VARIABLES_LOADED: 'Prompt variables loaded successfully.',
    /** Message shown when an input file is read successfully. */
    FILE_READ: 'Input file read successfully.',

    // --- Sync & Repository Operations ---
    /** Message shown when repository sync completes successfully. */
    SYNC_COMPLETED: 'Sync completed successfully! Repository is up to date.',
    /** Message shown after successfully resetting local changes. Uses {0} for count. */
    RESET_SUCCESS: 'Successfully reset {0} change(s).',
    /** Message shown after successfully pushing changes to the remote repository. */
    PUSH_SUCCESS: 'Changes committed and pushed successfully.',
    /** Message shown after successfully cloning a repository. Uses {0} for path. */
    REPO_CLONED: 'Repository cloned successfully to {0}.',
    /** Message shown after setting up repository from local path. Uses {0} for path. */
    REPO_LOCAL_SETUP: 'Repository set up successfully at {0}.',
    /** Message shown after initializing a new repository. */
    REPO_INITIALIZED: 'New repository initialized successfully.',
    /** Message shown after adding a remote. */
    REMOTE_ADDED: 'Remote repository added successfully.',
    /** Message shown after checking out a branch. Uses {0} for branch name. */
    BRANCH_CHECKOUT: 'Switched to branch "{0}".',
    /** Message shown after creating a branch. Uses {0} for branch name. */
    BRANCH_CREATED: 'Created and switched to new branch "{0}".',

    // --- Flush Operation ---
    /** Message shown after successfully flushing all application data. */
    FLUSH_COMPLETED: 'All application data flushed successfully. The CLI will now exit.'
};

/**
 * Standard error messages for various failure scenarios.
 * Use formatting placeholders like {0}, {1} where dynamic values are needed.
 */
export const ERROR_MESSAGES = {
    // --- System & Initialization Errors ---
    /** Error during application initialization. Uses {0} for details. */
    INITIALIZATION: 'Initialization failed: {0}',
    /** General database error. Uses {0} for details. */
    DATABASE: 'Database error: {0}',
    /** Generic error prefix. Uses {0} for context/details. */
    GLOBAL_ERROR: 'An error occurred: {0}',
    /** Suggestion to provide feedback for persistent errors. */
    FEEDBACK_SUGGESTION: 'If this error persists, please consider reporting it.',

    // --- API & Network Errors ---
    /** Error when an API key is missing but required. */
    API_KEY_MISSING: 'API key is required but not configured. Please set it using the `model` command.',
    /** Generic error for failed data fetching. */
    FAILED_TO_FETCH: 'Failed to fetch data.',
    /** Error during an API request. Uses {0} for details. */
    API_REQUEST_FAILED: 'API request failed: {0}',
    /** Error when a network operation fails. Uses {0} for details. */
    NETWORK_ERROR: 'Network error: {0}',

    // --- Input & Validation Errors ---
    /** Generic error for invalid user input. */
    INVALID_INPUT: 'Invalid input provided.',
    /** Error when a specified prompt is not found. Uses {0} for ID/name. */
    PROMPT_NOT_FOUND: 'Prompt "{0}" not found.',
    /** Error when a specified fragment is not found. Uses {0} for path. */
    FRAGMENT_NOT_FOUND: 'Fragment "{0}" not found.',
    /** Error when prompt ID/name is required but not provided. */
    PROMPT_ID_REQUIRED: 'Prompt ID or name is required. Use --prompt or -p.',
    /** Error when a required file path is invalid or inaccessible. Uses {0} for path. */
    INVALID_FILE_PATH: 'Invalid or inaccessible file path: {0}',
    /** Error when a file cannot be found. Uses {0} for path. */
    FILE_NOT_FOUND: 'File not found: {0}',

    // --- Setup Errors ---
    /** Error message shown when the setup process fails. */
    SETUP_FAILED: '❌ Setup failed. Please check the logs or try again.',

    // --- Formatting Errors ---
    /** Error for invalid key=value format for --set option. */
    INVALID_FORMAT_SET: 'Invalid format. Use --set KEY=VALUE',
    /** Error for invalid key=category/name format for --fragment option. */
    INVALID_FORMAT_FRAGMENT: 'Invalid format. Use --fragment KEY=category/name',
    /** Error for invalid key=value format for --create option (legacy). */
    INVALID_FORMAT_CREATE: 'Invalid format. Use --create KEY=VALUE',

    // --- Variable Errors ---
    /** Error when setting a variable fails. Uses {0} for name, {1} for error details. */
    VARIABLE_SET_FAILED: 'Failed to set variable "{0}": {1}',
    /** Error when unsetting a variable fails. Uses {0} for error details. */
    VARIABLE_UNSET_FAILED: 'Failed to unset variable: {0}',
    /** Error when creating a variable fails. Uses {0} for name, {1} for error details. */
    VARIABLE_CREATE_FAILED: 'Failed to create variable "{0}": {1}',
    /** Error when setting a fragment variable fails. Uses {0} for error details. */
    FRAGMENT_VARIABLE_SET_FAILED: 'Failed to set fragment variable: {0}',
    /** Error when a variable is not found or has no value. Uses {0} for name, {1} for context/reason. */
    VARIABLE_NOT_FOUND: 'Variable "{0}" not found or not set: {1}',
    /** Error when listing variables fails. Uses {0} for error details. */
    LIST_VARIABLES_FAILED: 'Failed to list variables: {0}',
    /** Error when getting variable info fails. Uses {0} for error details. */
    VARIABLE_INFO_FAILED: 'Failed to get variable info: {0}',
    /** Error when getting variable sources fails. Uses {0} for error details. */
    VARIABLE_SOURCES_FAILED: 'Failed to get variable sources: {0}',
    /** Error when getting prompts using a variable fails. Uses {0} for error details. */
    VARIABLE_PROMPTS_FAILED: 'Failed to get prompts using variable: {0}',
    /** Error when required variables are missing for prompt execution. */
    REQUIRED_VARIABLES_NOT_SET: 'Cannot execute: one or more required variables are not set.',

    // --- Execution Errors ---
    /** Error when loading fragment content during execution fails. */
    FRAGMENT_CONTENT_FAILED: 'Error loading fragment content.',
    /** Generic error for failed prompt execution. Uses {0} for details. */
    PROMPT_EXECUTION_FAILED: 'Failed to execute prompt: {0}',
    /** Error during an ongoing conversation. Uses {0} for details. */
    CONVERSATION_ERROR: 'Error during conversation: {0}',

    // --- Sync & Repository Errors ---
    /** Generic error for failed sync operation. */
    SYNC_FAILED: 'Sync operation failed.',
    /** Error when repository URL is missing for sync. */
    SYNC_NO_URL: 'Repository URL is required for sync operation.',
    /** Generic sync error. Uses {0} for details. */
    SYNC_ERROR: 'Sync error: {0}',
    /** Generic push error. Uses {0} for details. */
    PUSH_ERROR: 'Push error: {0}',
    /** Error when push operation fails. Uses {0} for details. */
    PUSH_FAILED: 'Push operation failed: {0}',
    /** Error when required data for sync is missing. */
    MISSING_SYNC_DATA: 'Missing required data for sync operation.', // Renamed from MISSING_DATA
    /** Error when repository setup is required but not done. */
    REPO_NOT_SETUP: 'Repository not set up. Please run `setup` command first.',
    /** Error when fetching from remote fails. Uses {0} for details. */
    FETCH_FAILED: 'Failed to fetch from remote repository: {0}',
    /** Error when pulling from remote fails. Uses {0} for details. */
    PULL_FAILED: 'Failed to pull changes from remote repository: {0}',
    /** Error when resetting local changes fails. Uses {0} for details. */
    RESET_FAILED: 'Failed to reset local changes: {0}',
    /** Error when committing changes fails. Uses {0} for details. */
    COMMIT_FAILED: 'Failed to commit changes: {0}',
    /** Error when changes data is missing for commit. */
    MISSING_DATA: 'Missing data for commit operation.',

    // --- Command Errors ---
    /** Error when a specified command is not found. Uses {0} for command name. */
    COMMAND_NOT_FOUND: 'Command "{0}" not found.',
    /** Generic error during command execution. Uses {0} for command name/context. */
    EXECUTING_COMMAND: 'Error executing command: {0}',
    /** Generic error while running a command. Uses {0} for command name/context. */
    RUNNING_COMMAND: 'Error running {0} command.',

    // --- Editor Errors ---
    /** Error when the external editor fails to open. Uses {0} for details. */
    EDITOR_OPEN_FAILED: 'Failed to open editor: {0}',

    // --- Flush Errors ---
    /** Error during the flush confirmation prompt. */
    CONFIRM_FLUSH_FAILED: 'Error during flush confirmation.',
    /** Error during the data flush operation itself. */
    FLUSH_OPERATION_FAILED: 'Error performing data flush operation.'
};

/**
 * Standard warning messages for non-critical issues or user actions.
 */
export const WARNING_MESSAGES = {
    // --- Search & Listing Warnings ---
    /** Warning when no prompts match the search criteria. */
    NO_PROMPTS_FOUND: 'No prompts found matching the criteria.',
    /** Warning when a search yields no results. */
    SEARCH_NO_RESULTS: 'No results found matching your search query.',

    // --- Variable Warnings ---
    /** Warning when required variables are missing for an operation. */
    REQUIRED_VARIABLES_NOT_SET: 'Required variables are not set.',
    /** Message indicating a variable is custom (not inferred from prompts). */
    CUSTOM_VARIABLE: 'This is a custom variable (not used in any prompts).',

    // --- Fragment Warnings ---
    /** Warning when no fragments exist in the library. */
    NO_FRAGMENTS_FOUND: 'No fragments found. You can create fragments using the `fragments create` command.',
    /** Warning when fragment content preview fails. */
    FRAGMENT_CONTENT_PREVIEW_FAILED: 'Could not preview fragment content.',

    // --- Sync & Repository Warnings ---
    /** Message indicating no changes were detected between local and remote. */
    NO_CHANGES: 'No changes detected. Your local repository is up to date.',
    /** Message indicating no local changes are pending to be pushed or reset. */
    NO_PENDING_CHANGES: 'No pending local changes found.',
    /** Message indicating no local changes need to be reset. */
    NO_CHANGES_TO_RESET: 'No local changes to reset.',
    /** Message shown when the reset operation is cancelled by the user. */
    RESET_CANCELLED: 'Reset operation cancelled.',
    /** Message shown when no changes are selected for a selective reset. */
    NO_CHANGES_SELECTED: 'No changes selected for reset. Operation cancelled.',
    /** Message shown when the push operation is cancelled by the user. */
    PUSH_CANCELLED: 'Push operation cancelled.',
    /** Warning when Git integration is disabled but a Git operation was attempted. */
    GIT_DISABLED: 'Git integration is disabled in configuration. Skipping Git operation.',
    /** Warning when a Git repository is not found where expected. */
    GIT_REPO_NOT_FOUND: 'Git repository not found in the expected location.',

    // --- Editor Warnings ---
    /** Warning shown when the external editor fails and original content is returned. */
    EDITOR_FAILED: 'Editor failed to open or was closed without saving. Using previous content.',

    // --- User Interaction Warnings ---
    /** Generic message indicating an operation was cancelled by the user. */
    OPERATION_CANCELLED: 'Operation cancelled.',
    /** Message shown when the user cancels command execution (e.g., Ctrl+C). */
    USER_CANCELLATION: 'Command execution cancelled by user. Exiting...',

    // --- Flush Warnings ---
    /** Message shown if the user cancels the data flush operation. */
    FLUSH_CANCELLED: 'Flush operation cancelled.'
};

/**
 * Standard informational messages displayed to the user.
 */
export const INFO_MESSAGES = {
    // --- Navigation & Interaction ---
    /** Message shown when exiting the CLI menu mode. */
    EXITING: 'Exiting CLI...',
    /** Standard prompt asking the user to press a key to continue. */
    PRESS_KEY_TO_CONTINUE: 'Press any key to continue...',

    // --- Repository & Setup ---
    /** Message indicating the prompt library repository was not found. */
    REPO_NOT_FOUND: 'Prompt library repository not found.',
    /** Prompt suggesting the user run the setup command. */
    SETUP_PROMPT: 'It looks like the prompt library is not set up yet. Run the setup command:',
    /** Example command for running setup. */
    SETUP_COMMAND: 'prompt-library-cli setup',
    /** Instruction to run setup before using repository features. */
    REPOSITORY_SETUP_INSTRUCTION: 'Run `setup` command first to configure your prompt repository.',
    /** Instruction after pushing changes, suggesting creating a Pull Request. */
    CREATE_PR_INSTRUCTION:
        'If using a fork/branch workflow, please create a pull request on GitHub to merge your changes.',

    // --- Variable Operations ---
    /** Message indicating a variable is being set. Uses {0} for name. */
    SETTING_VARIABLE: 'Setting variable "{0}"...',
    /** Message indicating a variable is being set to a fragment. Uses {0} for name, {1} for fragment path. */
    SETTING_FRAGMENT_VARIABLE: 'Setting variable "{0}" to reference fragment "{1}"...',
    /** Message indicating a variable is being unset. Uses {0} for name. */
    UNSETTING_VARIABLE: 'Unsetting variable "{0}"...',
    /** Message indicating a variable is being created. Uses {0} for name. */
    CREATING_VARIABLE: 'Creating variable "{0}"...',
    /** Message indicating variable info is being retrieved. Uses {0} for name. */
    VARIABLE_INFO: 'Getting info for variable "{0}"...',
    /** Message indicating a variable is being created with a fragment reference. */
    CREATING_WITH_FRAGMENT: 'Creating variable with fragment reference...',
    /** Hint shown after successfully creating a variable. */
    VARIABLE_CREATED_HINT: 'The variable has been created and can now be used or viewed.',

    // --- Fragment Operations ---
    /** Header for fragment content preview. */
    FRAGMENT_CONTENT_PREVIEW: 'Fragment content preview:',
    /** Info message after fetching fragments. */
    FETCHED_FRAGMENTS: 'Fetched fragments successfully.',
    /** Info message after fetching environment variables. */
    FETCHED_ENV_VARIABLES: 'Fetched environment variables successfully.',

    // --- Execution Operations ---
    /** Message indicating prompt preparation is starting. */
    PREPARING_PROMPT: 'Preparing prompt...',
    /** Message indicating prompt data is being loaded. */
    LOADING_PROMPT: 'Loading prompt...',
    /** Message indicating the prompt is being processed by the AI. */
    PROCESSING_PROMPT: 'Processing prompt with AI...',
    /** General message indicating prompt execution is starting. */
    EXECUTING_PROMPT: 'Executing prompt...',
    /** Message indicating prompt variables are being loaded. */
    LOADING_VARIABLES: 'Loading prompt variables...',
    /** Message indicating content is being read from a file. Uses {0} for filename. */
    READING_FILE_INPUT: 'Reading file input: {0}...',
    /** Message shown when inspecting variables instead of executing. */
    INSPECTING_VARIABLES: 'Inspecting prompt variables (execution skipped).',
    /** Message indicating the start of interactive prompt browsing. */
    BROWSING_PROMPTS: 'Browsing available prompts...',

    // --- Sync & Repository Operations ---
    /** Confirmation prompt before proceeding with a sync operation that involves pulling changes. */
    PROCEED_CONFIRMATION: 'Remote changes detected. Proceed with pulling and applying changes?',
    /** Prompt asking the user to enter the remote repository URL. */
    ENTER_REPO_URL: 'Enter the remote repository URL:',
    /** Prompt asking if the user wants to view detailed changes before pushing. */
    VIEW_DETAILED_CHANGES: 'View detailed changes before pushing?',
    /** Prompt asking the user to enter a commit message. */
    ENTER_COMMIT_MESSAGE: 'Enter commit message (or leave blank for default):',
    /** Confirmation prompt before pushing changes. */
    CONFIRM_PUSH: 'Push these changes to the remote repository?',
    /** Message indicating the repository is already up to date. */
    REPO_UP_TO_DATE: 'Repository is already up to date.',

    // --- Troubleshooting ---
    /** Header for troubleshooting suggestions. */
    TROUBLESHOOTING_HINTS: 'Troubleshooting suggestions:',

    // --- Flush Operation ---
    /** Confirmation prompt before flushing all application data. */
    CONFIRM_FLUSH: '⚠️ Are you sure you want to flush all data (prompts, fragments, history)? This cannot be undone.'
};
