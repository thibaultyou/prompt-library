/**
 * UI constants specific to the 'prompts' command and its subcommands.
 * Defines text, descriptions, options, and structure for the prompt management interface.
 */
import { SEPARATOR as BASE_SEPARATOR, UI_ICONS } from './formatting';
import { INFO_MESSAGES, SUCCESS_MESSAGES, ERROR_MESSAGES, WARNING_MESSAGES } from './messages';

export const PROMPT_UI = {
    /**
     * Descriptions used in command help text for 'prompts' and its subcommands.
     */
    DESCRIPTIONS: {
        /** Description for the 'prompts list' subcommand. */
        LIST_COMMAND: 'List and browse available prompts.',
        /** Description for the 'prompts create' subcommand. */
        CREATE_COMMAND: 'Create a new prompt interactively or from options.',
        /** Description for the 'prompts delete' subcommand. */
        DELETE_COMMAND: 'Delete an existing prompt by ID or directory name.',
        /** Description for the 'prompts read' subcommand. */
        READ_COMMAND: 'View the details and content of a specific prompt.',
        /** Description for the 'prompts update' subcommand. */
        UPDATE_COMMAND: "Update an existing prompt's content or metadata.",
        /** Description for the 'prompts search' subcommand. */
        SEARCH_COMMAND: 'Search prompts by keyword in metadata or content.',
        /** Description for the 'prompts favorites' subcommand. */
        FAVORITES_COMMAND: 'View and manage your favorite prompts.',
        /** Description for the 'prompts recent' subcommand. */
        RECENT_COMMAND: 'Show recently executed prompts.',
        /** Description for the 'prompts refresh-metadata' subcommand. */
        REFRESH_METADATA_COMMAND: 'Refresh metadata using AI analysis for one or all prompts.'
    },

    /**
     * Descriptions for command-line options used by 'prompts' commands.
     */
    OPTIONS: {
        // --- Common Options ---
        /** Option to output results in JSON format. */
        JSON_FORMAT: 'Output in JSON format (for CI/scripts).',

        // --- Create Command Options ---
        /** Option to specify the directory name for a new prompt. */
        DIRECTORY: 'Directory name for the new prompt (use snake_case).',
        /** Option to specify the title for a new prompt. */
        TITLE: 'Title for the new prompt.',
        /** Option to specify the primary category for a new prompt. */
        CATEGORY: 'Primary category for the prompt.',
        /** Option to specify the one-line description for a new prompt. */
        DESCRIPTION: 'One-line description for the prompt.',
        /** Option to provide prompt content from a file during creation. */
        FILE: 'Path to a markdown file to use as prompt content.',
        /** Option to provide prompt content directly as a string during creation/update. */
        CONTENT: 'Direct prompt content (as a string).',
        /** Option to skip AI analysis during prompt creation/update. */
        NO_ANALYZE: 'Skip AI analysis for metadata generation/update.',

        // --- Delete Command Options ---
        /** Option to specify the prompt to delete by ID or directory name. */
        PROMPT_ID: 'ID or directory name of the prompt.', // Used by delete, read, update
        /** Option to skip the confirmation prompt during deletion. */
        FORCE: 'Skip confirmation prompt before deleting.',

        // --- Read Command Options ---
        /** Option to specify the prompt ID to view (alias for --prompt). */
        ID: 'ID of the prompt to view.',
        /** Option to print the full prompt content without pagination. */
        ALL: 'Print all content without pagination.',

        // --- List Command Options ---
        /** Option to sort the prompt list by ID instead of category/title. */
        ID_SORT: 'List prompts sorted by ID.',
        /** Option to list all prompts (default behavior for 'list'). */
        ALL_PROMPTS: 'List all prompts (default).',
        /** Option to browse prompts interactively by category. */
        CATEGORY_BROWSE: 'Browse prompts interactively by category.',
        /** Option to list only the available categories. */
        CATEGORIES: 'List all available prompt categories.',

        // --- Recent Command Options ---
        /** Option to limit the number of recent prompts shown. */
        LIMIT: 'Number of recent prompts to show (default: 10).',

        // --- Search Command Options ---
        /** Option to provide the search keyword. */
        KEYWORD: 'Keyword to search for in prompt metadata and content.',
        /** Option to restrict search to prompt content only. */
        CONTENT_ONLY: 'Search only within the prompt content, excluding metadata.',

        // --- Refresh Metadata Options ---
        /** Option to specify the prompt to refresh by ID or directory name. */
        PROMPT_REFRESH: 'ID or directory name of the prompt to refresh.',
        /** Option to refresh metadata for all prompts. */
        ALL_REFRESH: 'Refresh metadata for all prompts.'
    },

    /**
     * Titles and icons for different sections within the 'prompts' command's UI.
     */
    SECTION_HEADER: {
        /** Main title for the prompt management section. */
        TITLE: 'Prompts Library',
        /** Default icon for prompt sections. */
        ICON: UI_ICONS.REPOSITORY, // Using standard icon
        /** Title for the prompt creation section. */
        CREATE: 'Create New Prompt',
        /** Icon for the prompt creation section. */
        CREATE_ICON: '🌱',
        /** Title for the prompt deletion section. */
        DELETE: 'Delete Prompt',
        /** Icon for the prompt deletion section. */
        DELETE_ICON: '🔥',
        /** Title for the prompt update section. */
        UPDATE: 'Update Prompt',
        /** Icon for the prompt update section. */
        UPDATE_ICON: '♻️',
        /** Title for the prompt details view. */
        READ: 'Prompt Details',
        /** Icon for the prompt details view. */
        READ_ICON: '📄',
        /** Title for the search results view. */
        SEARCH: 'Search Prompts',
        /** Icon for the search results view. */
        SEARCH_ICON: UI_ICONS.SEARCH, // Using standard icon
        /** Title for the favorites view. */
        FAVORITES: 'Favorite Prompts',
        /** Icon for the favorites view. */
        FAVORITES_ICON: '⭐',
        /** Title for the recent prompts view. */
        RECENT: 'Recent Prompts',
        /** Icon for the recent prompts view. */
        RECENT_ICON: '⏱️',
        /** Title for the metadata refresh section. */
        REFRESH_METADATA: 'Refresh Prompt Metadata',
        /** Icon for the metadata refresh section. */
        REFRESH_ICON: '🔄',
        /** Title for the category listing/browsing view. */
        PROMPT_CATEGORIES: 'Prompt Categories',
        /** Icon for the category view. */
        CATEGORIES_ICON: UI_ICONS.REPOSITORY, // Using standard icon
        /** Title for the variable listing/management view. */
        VARIABLES: 'Prompt Variables',
        /** Icon for the variable view. */
        VARIABLES_ICON: '🔧',
        /** Title for the variable editing section. */
        EDIT_VARIABLES: 'Manage Prompt Variables',
        /** Icon for the variable editing section. */
        EDIT_ICON: '🔧',
        /** Title for the prompt details view (alternative). */
        DETAILS: 'Prompt Details'
    },

    /**
     * Text prompts used in interactive menus for prompts.
     */
    MENU: {
        /** Prompt for selecting a prompt from a list. */
        PROMPT_SELECT: 'Select a prompt:',
        /** Prompt for selecting a category from a list. */
        CATEGORY_SELECT: 'Select a category:',
        /** Prompt for selecting the primary category during creation. */
        CATEGORY_PROMPT: 'Select a primary category for the prompt:',
        /** Prompt for choosing an action for a selected prompt. */
        ACTION_PROMPT: 'Choose an action for this prompt:',
        /** Prompt asking what to do next in a conversation. */
        NEXT_ACTION: 'What would you like to do next?',
        /** Prompt for selecting a search result. */
        SEARCH_RESULT_PROMPT: 'Select a search result:',
        /** Prompt for selecting a favorite prompt. */
        FAVORITE_PROMPT: 'Select a favorite prompt:',
        /** Prompt for selecting a prompt to remove from favorites. */
        FAVORITE_REMOVE_PROMPT: 'Select prompt to remove from favorites:'
    },

    /**
     * Standard labels used in the prompt UI.
     */
    LABELS: {
        // --- Menu Actions ---
        /** Menu item to continue an ongoing conversation. */
        CONTINUE: 'Continue conversation',
        /** Menu item to execute the selected prompt. */
        EXECUTE: 'Execute prompt',
        /** Menu item to edit the selected prompt. */
        EDIT: 'Edit prompt',
        /** Menu item to view/manage the variables of the selected prompt. */
        VIEW_VARIABLES: 'Manage variables',
        /** Menu item to remove the selected prompt from favorites. */
        REMOVE_FAVORITE: 'Remove from favorites',
        /** Menu item to start a new search. */
        NEW_SEARCH: 'New search',
        /** Menu item to try searching again after no results. */
        TRY_SEARCH: 'Try another search',
        /** Menu item to execute the selected recent prompt again. */
        EXECUTE_AGAIN: 'Execute again',
        /** Menu item to view the full content of the prompt. */
        VIEW_CONTENT: 'View prompt content',
        /** Menu item to add the current prompt to favorites. */
        ADD_FAVORITE: 'Add to favorites',
        /** Menu item to view conversation history (if available). */
        VIEW_HISTORY: 'View conversation history',
        /** Menu item to clear all currently set variable values for the prompt. */
        CLEAR_VALUES: 'Clear all variable values',

        // --- Prompt Properties ---
        /** Label for the prompt's category. */
        CATEGORY: 'Category:',
        /** Label for the prompt's description. */
        DESCRIPTION: 'Description:',
        /** Label for the prompt's directory name. */
        DIRECTORY: 'Directory:',
        /** Label for the list of variables. */
        VARIABLES: 'Variables:',
        /** Indicator for a required variable. */
        REQUIRED: '(required)',
        /** Label for the prompt's content section. */
        CONTENT: 'Content:',
        /** Label indicating the currently set value for a variable. */
        CURRENT_VALUE: 'Current value:',
        /** Label for a variable's role/description. */
        ROLE: 'Role:',
        /** Label indicating if a variable is required. */
        REQUIRED_LABEL: 'Required:',
        /** Label for prompt tags. */
        TAGS: 'Tags:',
        /** Label for prompt ID. */
        ID: 'ID:'
    },

    /**
     * Standard action identifiers used internally for 'prompts' command operations.
     */
    ACTIONS: {
        /** Action identifier for continuing a conversation. */
        CONTINUE: 'continue' as const,
        /** Standard action identifier for going back. */
        BACK: 'back' as const,
        /** Action identifier for executing a prompt. */
        EXECUTE: 'execute' as const,
        /** Action identifier for editing a prompt. */
        EDIT: 'update' as const,
        /** Action identifier for managing variables. */
        VARIABLES: 'variables' as const,
        /** Action identifier for removing from favorites. */
        REMOVE: 'remove' as const,
        /** Action identifier for starting a new search. */
        NEW_SEARCH: 'new_search' as const,
        /** Action identifier for viewing prompt content. */
        VIEW_CONTENT: 'view_content' as const,
        /** Action identifier for adding to favorites. */
        FAVORITE: 'favorite' as const,
        /** Action identifier for removing from favorites (alternative). */
        UNFAVORITE: 'unfavorite' as const,
        /** Action identifier for viewing conversation history. */
        HISTORY: 'history' as const,
        /** Action identifier for clearing all variable values. */
        UNSET_ALL: 'unset_all' as const,
        /** Action identifier for listing all prompts. */
        ALL: 'all' as const,
        /** Action identifier for browsing by category. */
        CATEGORY: 'category' as const,
        /** Action identifier for listing by ID. */
        ID: 'id' as const,
        /** Action identifier for searching prompts. */
        SEARCH: 'search' as const,
        /** Action identifier for viewing recent prompts. */
        RECENT: 'recent' as const,
        /** Action identifier for viewing favorite prompts. */
        FAVORITES: 'favorites' as const,
        /** Action identifier for creating a prompt. */
        CREATE: 'create' as const,
        /** Action identifier for deleting a prompt. */
        DELETE: 'delete' as const,
        /** Action identifier for reading/viewing a prompt. */
        READ: 'read' as const,
        /** Action identifier for refreshing metadata. */
        REFRESH: 'refresh' as const,
        /** Action identifier for updating a prompt. */
        UPDATE: 'update' as const
    },

    /**
     * Table headers and formatting constants for prompt lists.
     */
    TABLE: {
        /** Header for the category column. */
        CATEGORY_HEADER: 'Category',
        /** Header for the prompt count column. */
        COUNT_HEADER: 'Count',
        /** Header for the example prompts column. */
        EXAMPLE_HEADER: 'Example Prompts',
        /** Standard headers for prompt tables. */
        HEADERS: {
            ID: 'ID',
            TITLE: 'Title',
            CATEGORY: 'Category',
            DESCRIPTION: 'Description',
            DIRECTORY: 'Directory' // Added Directory header
        }
    },

    /**
     * Text prompts used for gathering user input related to prompts.
     */
    INPUT: {
        /** Prompt for entering the prompt title. */
        TITLE: 'Enter prompt title:',
        /** Prompt for entering the directory name. */
        DIRECTORY: 'Enter directory name (use snake_case):',
        /** Prompt for entering the one-line description. */
        DESCRIPTION: 'Enter one-line description:',
        /** Prompt asking the user to edit prompt content (usually opens editor). */
        EDIT_CONTENT: 'Edit prompt content:',
        /** Prompt for entering a search keyword. */
        SEARCH_KEYWORD: 'Enter search keyword:',
        /** Prompt prefix for user input during conversation. */
        USER_INPUT: 'You: ',
        /** Prompt for entering a value for a specific variable. Uses {0} for variable name. */
        VARIABLE_VALUE: 'Enter value for {0}:'
    },

    /**
     * Separator style configuration inherited from base formatting constants.
     */
    SEPARATOR: BASE_SEPARATOR,

    /**
     * Default content or values used during prompt creation.
     */
    TEMPLATE: {
        /** Default title suggested when creating a new prompt. */
        DEFAULT_TITLE: 'My Awesome Agent'
    },

    /**
     * Helpful hints and informational messages for the user related to prompts.
     */
    HINTS: {
        /** Hint suggesting how to view prompt details using the ID. */
        USE_PROMPT_ID: 'Tip: Use prompt ID to view details: `prompts read <id>`',
        /** Hint explaining pagination controls. */
        PAGINATION_HINT: '(Scroll using arrow keys, press Enter to select actions)',
        /** Hint shown when no favorites exist, suggesting how to add them. */
        NO_FAVORITES_HINT: 'Add prompts to your favorites from the prompt details view.',
        /** Hint shown in non-interactive mode when no favorites exist. */
        NO_FAVORITES_CLI_HINT: 'Add prompts to favorites using the interactive mode:',
        /** Example command for adding favorites. */
        FAVORITES_CLI_COMMAND: 'prompt-library-cli prompts list' // Changed to list as entry point
    },

    /**
     * Message templates used in various scenarios within the 'prompts' command UI.
     */
    MESSAGES: {
        /** Standard confirmation that an action cannot be undone. */
        DELETE_WARNING: WARNING_MESSAGES.OPERATION_CANCELLED.replace('Operation', 'This action cannot be undone.'), // Reused message
        /** Message shown while AI analysis is running. */
        ANALYZING_PROMPT: 'Analyzing prompt to generate metadata...',
        /** Success message after creating a prompt. Uses {0} for title. */
        PROMPT_CREATED: SUCCESS_MESSAGES.PROMPT_CREATED,
        /** Success message after updating a prompt. Uses {0} for title. */
        PROMPT_UPDATED: SUCCESS_MESSAGES.PROMPT_UPDATED,
        /** Success message after deleting a prompt. Uses {0} for title. */
        PROMPT_DELETED: SUCCESS_MESSAGES.PROMPT_DELETED,
        /** Info message showing the location of prompt files. Uses {0} for path. */
        PROMPT_LOCATION: 'Prompt files located at: {0}',
        /** Info message when prompt content hasn't changed during update. */
        NO_CHANGES: 'No changes detected in prompt content.',
        /** Info message showing the number of search results. Uses {0} for count, {1} for keyword. */
        FOUND_RESULTS: 'Found {0} results for "{1}":',
        /** Warning message when search yields no results. Uses {0} for keyword. */
        NO_RESULTS: WARNING_MESSAGES.SEARCH_NO_RESULTS.replace('your search query', '"{0}"'), // Reused message
        /** Info message summarizing category and prompt counts. Uses {0} for category count, {1} for prompt count. */
        FOUND_CATEGORIES: 'Found {0} categories with {1} total prompts.',
        /** Info message summarizing prompt count within a category. Uses {0} for count, {1} for category name. */
        FOUND_PROMPTS_CATEGORY: 'Found {0} prompts in category "{1}".',
        /** Info message summarizing the number of favorite prompts. Uses {0} for count. */
        FOUND_FAVORITES: 'Found {0} favorite prompts.',
        /** Warning message when no favorite prompts exist. */
        NO_FAVORITES: WARNING_MESSAGES.NO_PROMPTS_FOUND.replace('prompts', 'favorite prompts'), // Reused message
        /** Info message after updating favorites list. Uses {0} for remaining count. */
        FAVORITES_UPDATED: 'Favorites list updated. {0} favorites remaining.',
        /** Info message when no favorites are left after removal. */
        NO_FAVORITES_REMAINING: 'No favorite prompts remaining.',
        /** Info message summarizing the number of recent prompts. Uses {0} for count. */
        FOUND_RECENT: 'Found {0} recently executed prompts.',
        /** Warning message when no recent prompt executions exist. */
        NO_RECENT: WARNING_MESSAGES.NO_PROMPTS_FOUND.replace('prompts', 'recent prompt executions'), // Reused message
        /** Success message after refreshing metadata. Uses {0} for prompt title. */
        REFRESH_SUCCESS: SUCCESS_MESSAGES.METADATA_REFRESHED,
        /** Info message indicating completion of metadata refresh for all prompts. */
        REFRESH_COMPLETE: 'Metadata refresh complete:',
        /** Success count message after refreshing all prompts. Uses {0} for count. */
        REFRESH_SUCCESS_COUNT: '{0} prompts refreshed successfully.',
        /** Failure count message after refreshing all prompts. Uses {0} for count. */
        REFRESH_FAILED_COUNT: '{0} prompts failed to refresh.',
        /** Info message confirming the selected prompt. Uses {0} for title, {1} for ID. */
        PROMPT_SELECTED: 'Selected prompt: "{0}" (ID: {1})',
        /** Success message after removing a prompt from favorites. */
        PROMPT_REMOVED_FAVORITES: SUCCESS_MESSAGES.PROMPT_UNFAVORITED
    },

    // --- Direct Mapping to Centralized Messages ---
    /** Direct mapping for success messages. */
    SUCCESS: SUCCESS_MESSAGES,
    /** Direct mapping for error messages. */
    ERROR: ERROR_MESSAGES,
    /** Direct mapping for warning messages. */
    WARNING: WARNING_MESSAGES,
    /** Direct mapping for info messages. */
    INFO: INFO_MESSAGES
};
