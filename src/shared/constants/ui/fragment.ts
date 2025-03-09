/**
 * UI constants specific to the 'fragments' command and its subcommands.
 * Defines text, descriptions, options, and structure for the fragment management interface.
 */
import { SEPARATOR as BASE_SEPARATOR, UI_ICONS } from './formatting'; // Import base separator and styles
import { SUCCESS_MESSAGES, ERROR_MESSAGES, WARNING_MESSAGES, INFO_MESSAGES } from './messages'; // Import centralized messages

export const FRAGMENT_UI = {
    /**
     * Descriptions used in command help text.
     */
    DESCRIPTIONS: {
        /** Description for the main 'fragments' command. */
        COMMAND: 'Manage and browse reusable prompt fragments.',
        /** Description for the 'fragments list' subcommand. */
        LIST_COMMAND: 'List and browse available fragments.',
        /** Description for the 'fragments create' subcommand. */
        CREATE_COMMAND: 'Create a new prompt fragment.',
        /** Description for the 'fragments delete' subcommand. */
        DELETE_COMMAND: 'Delete an existing fragment.',
        /** Description for the 'fragments read' subcommand. */
        READ_COMMAND: 'View the content of a specific fragment.',
        /** Description for the 'fragments update' subcommand. */
        UPDATE_COMMAND: 'Update the content of an existing fragment.',
        /** Description for the 'fragments search' subcommand. */
        SEARCH_COMMAND: 'Search fragments by keyword in name or category.',
        /** Base command description (internal use). */
        BASE_COMMAND: 'Base command for fragment operations.'
    },

    /**
     * Descriptions for command-line options used by 'fragments' commands.
     */
    OPTIONS: {
        /** Option to output results in JSON format. */
        JSON_FORMAT: 'Output in JSON format (for CI/scripts).',
        /** Option to specify the fragment category. */
        CATEGORY: 'Specify the fragment category.',
        /** Option to specify the fragment name (should be snake_case). */
        NAME: 'Specify the fragment name (use snake_case).',
        /** Option to skip the confirmation prompt during deletion. */
        FORCE_DELETE: 'Force deletion without confirmation.',
        /** Option to provide a keyword for searching fragments. */
        KEYWORD: 'Keyword to search for in fragment names or categories.',
        /** Option to provide fragment content directly via CLI. */
        CONTENT: 'Provide the new content for the fragment directly.',
        /** Option to specify a file containing the new fragment content. */
        FILE: 'Path to a file containing the new content for the fragment.',
        /** Option to list only the available categories. */
        CATEGORIES: 'List all available fragment categories.',
        /** Option to browse fragments interactively by category. */
        BROWSE_CATEGORY: 'Browse fragments interactively, starting with category selection.'
    },

    /**
     * Titles and icons for different sections within the 'fragments' command's UI.
     */
    SECTION_HEADER: {
        /** Main title for the fragment management section. */
        TITLE: 'Prompt Fragments',
        /** Default icon for fragment sections. */
        ICON: UI_ICONS.FRAGMENT, // Use standard icon
        /** Title for the fragment details view. */
        FRAGMENT_DETAILS: 'Fragment Details',
        /** Title for the search results view. */
        SEARCH_RESULTS: 'Search Results for "{0}"',
        /** Icon for the search results view. */
        SEARCH_RESULTS_ICON: UI_ICONS.SEARCH, // Use standard icon
        /** Title for the fragment creation section. */
        CREATE_FRAGMENT: 'Create New Fragment',
        /** Icon for the fragment creation section. */
        CREATE_ICON: '📝',
        /** Title for the fragment deletion section. */
        DELETE_FRAGMENT: 'Delete Fragment',
        /** Icon for the fragment deletion section. */
        DELETE_ICON: '🗑️',
        /** Title for the fragment update section. */
        UPDATE_FRAGMENT: 'Update Fragment',
        /** Icon for the fragment update section. */
        UPDATE_ICON: '♻️',
        /** Title for the view listing all fragments. */
        ALL_FRAGMENTS: 'All Fragments',
        /** Title for the view listing fragment categories. */
        FRAGMENT_CATEGORIES: 'Fragment Categories',
        /** Icon for the categories view. */
        CATEGORIES_ICON: UI_ICONS.REPOSITORY, // Use standard icon
        /** Title for the category creation section. */
        CREATE_CATEGORY: 'Create New Fragment Category',
        /** Icon for the category creation section. */
        CREATE_CATEGORY_ICON: '📁',
        /** Title for the category deletion section. */
        DELETE_CATEGORY: 'Delete Fragment Category',
        /** Icon for the category deletion section. */
        DELETE_CATEGORY_ICON: '🗑️'
    },

    /**
     * Text prompts used in interactive menus for fragments.
     */
    MENU: {
        /** Prompt for selecting a fragment from a list. */
        SELECT_FRAGMENT: 'Select a fragment:',
        /** Prompt for selecting a category from a list. */
        SELECT_CATEGORY: 'Select a category:',
        /** Prompt for choosing an action for a selected fragment. */
        SELECT_ACTION: 'Choose an action for this fragment:',
        /** Prompt asking what to do next in certain workflows. */
        WHAT_NEXT: 'What would you like to do next?'
    },

    /**
     * Standard labels used in the fragment UI.
     */
    LABELS: {
        /** Header for the category column in tables. */
        HEADER_CATEGORIES: 'Category',
        /** Header for the count column in category tables. */
        HEADER_COUNT: 'Count',
        /** Header for the example fragments column in category tables. */
        HEADER_EXAMPLES: 'Example Fragments',
        /** Menu item to edit the selected fragment. */
        EDIT_FRAGMENT: 'Edit this fragment',
        /** Menu item to delete the selected fragment. */
        DELETE_FRAGMENT: 'Delete this fragment',
        /** Menu item to create a new fragment. */
        CREATE_FRAGMENT: 'Create a new fragment',
        /** Menu item to create a new category. */
        CREATE_CATEGORY: 'Create a new category',
        /** Menu item to delete a category. */
        DELETE_CATEGORY: 'Delete this category',
        /** Standard 'Go back' menu item. */
        GO_BACK: 'Go back',
        /** Menu item to start a new search. */
        NEW_SEARCH: 'New search',
        /** Label indicating an empty category. */
        EMPTY_CATEGORY: '(Empty category)',
        /** Header for the list of existing categories in selection menus. */
        EXISTING_CATEGORIES: 'EXISTING CATEGORIES'
    },

    /**
     * Text prompts used for gathering user input related to fragments.
     */
    INPUT: {
        /** Prompt asking the user to edit fragment content (usually opens editor). */
        EDIT_CONTENT: 'Edit fragment content:',
        /** Prompt for entering a new category name. */
        ENTER_CATEGORY: 'Enter new category name (use snake_case):',
        /** Prompt for entering a new fragment name. */
        ENTER_NAME: 'Enter fragment name (use snake_case):',
        /** Prompt for entering a search keyword. */
        SEARCH_KEYWORD: 'Enter search keyword:'
    },

    /**
     * Confirmation messages shown to the user before performing actions.
     */
    CONFIRM: {
        /** Confirmation prompt before deleting a fragment. */
        DELETE_FRAGMENT: 'Are you sure you want to delete this fragment? This action cannot be undone.',
        /** Base confirmation prompt before deleting a category. Includes placeholders. */
        DELETE_CATEGORY: 'Are you sure you want to delete the category "{0}"{1}?',
        /** Placeholder text added to DELETE_CATEGORY if it contains fragments. */
        DELETE_CATEGORY_WITH_FRAGMENTS: ' and all {0} fragments inside it',
        /** Placeholder text added to DELETE_CATEGORY if it's empty. */
        DELETE_EMPTY_CATEGORY: ' (this category is empty)',
        /** Confirmation prompt asking if the user wants to try another search. */
        TRY_ANOTHER_SEARCH: 'No matches found. Try another search?',
        /** Confirmation prompt asking if the user wants to sync changes to the remote repo. */
        SYNC_REMOTE: 'Sync this change to the remote repository now?'
    },

    /**
     * Success messages displayed after successful operations.
     */
    SUCCESS: {
        /** Message shown after successfully creating a fragment. Uses {0} for category, {1} for name. */
        FRAGMENT_CREATED: SUCCESS_MESSAGES.FRAGMENT_CREATED,
        /** Message shown after successfully updating a fragment. Uses {0} for category, {1} for name. */
        FRAGMENT_UPDATED: SUCCESS_MESSAGES.FRAGMENT_UPDATED,
        /** Message shown after successfully deleting a fragment. Uses {0} for category, {1} for name. */
        FRAGMENT_DELETED: SUCCESS_MESSAGES.FRAGMENT_DELETED,
        /** Message shown after successfully creating a category. Uses {0} for category name. */
        CATEGORY_CREATED: 'Category "{0}" created successfully.',
        /** Message shown after successfully deleting a category. Uses {0} for category name. */
        CATEGORY_DELETED: SUCCESS_MESSAGES.FRAGMENT_DELETED.replace('Fragment {0}/{1}', 'Category {0}') // Reusing structure
    },

    /**
     * Warning messages displayed for non-critical issues or user cancellations.
     */
    WARNINGS: {
        /** Message shown when no fragments are found in the library. */
        NO_FRAGMENTS_FOUND: WARNING_MESSAGES.NO_FRAGMENTS_FOUND,
        /** Message shown when a search yields no results. Uses {0} for the keyword. */
        NO_MATCHES_FOUND: WARNING_MESSAGES.SEARCH_NO_RESULTS.replace('prompts', 'fragments'), // Reusing structure
        /** Message shown if the user cancels category selection. */
        NO_CATEGORY_SELECTED: 'No category selected. Operation cancelled.',
        /** Message shown if the user cancels fragment selection. */
        NO_FRAGMENT_SELECTED: 'No fragment selected. Operation cancelled.',
        /** Generic message for cancelled operations. */
        OPERATION_CANCELLED: WARNING_MESSAGES.OPERATION_CANCELLED,
        /** Specific message for cancelled deletion. */
        DELETION_CANCELLED: 'Deletion cancelled.',
        /** Message indicating a selected category has no fragments. */
        EMPTY_CATEGORY: 'This category currently contains no fragments.',
        /** Note shown when user opts out of immediate remote sync. */
        REMOTE_SYNC_NOTE: INFO_MESSAGES.REPOSITORY_SETUP_INSTRUCTION.replace(
            'Run "prompt-library-cli setup" first to set up the repository.',
            'Changes tracked locally. Use `sync --push` later.'
        ) // Reusing structure
    },

    /**
     * Error messages displayed when operations fail.
     */
    ERRORS: {
        /** Error when a specific fragment cannot be found. Uses {0} for category, {1} for name, {2} for error details. */
        FRAGMENT_NOT_FOUND: ERROR_MESSAGES.FRAGMENT_NOT_FOUND.replace('Prompt {0}/{1}', 'Fragment {0}/{1}'), // Reusing structure
        /** Error when a category directory is missing. Uses {0} for category, {1} for error details. */
        CATEGORY_NOT_FOUND: 'Category directory not found: {0}. Details: {1}',
        /** Error when fragment content cannot be loaded. Uses {0} for category, {1} for name, {2} for error details. */
        LOAD_CONTENT_FAILED: ERROR_MESSAGES.FRAGMENT_CONTENT_FAILED.replace(
            'Error loading fragment content',
            'Could not load content for fragment {0}/{1}: {2}'
        ), // Reusing structure
        /** Error when saving a fragment fails. Uses {0} for error details. */
        SAVE_FAILED: 'Failed to save fragment: {0}',
        /** Error when updating a fragment fails. Uses {0} for error details. */
        UPDATE_FAILED: 'Failed to update fragment: {0}',
        /** Error when deleting a fragment fails. Uses {0} for error details. */
        DELETE_FAILED: 'Failed to delete fragment: {0}',
        /** Error when reading content from a specified file fails. Uses {0} for file path, {1} for error details. */
        READ_FILE_FAILED: 'Failed to read content from file {0}: {1}',
        /** Error when provided fragment content is empty. */
        EMPTY_CONTENT: 'Fragment content cannot be empty.',
        /** Error when search keyword is missing in non-interactive mode. */
        KEYWORD_REQUIRED: 'Search keyword is required. Use --keyword option or provide as argument.',
        /** Error when fragment creation is cancelled due to missing name. */
        CREATE_CANCELLED: 'Fragment creation cancelled: {0}',
        /** Error when category creation is cancelled due to missing name. */
        CATEGORY_CREATE_CANCELLED: 'Category creation cancelled: {0}',
        /** Generic error for failed menu actions. Uses {0} for action name. */
        ACTION_FAILED: ERROR_MESSAGES.EXECUTING_COMMAND.replace("command '{0}'", 'fragment action: {0}') // Reusing structure
    },

    /**
     * Labels for displaying fragment properties.
     */
    PROPERTIES: {
        /** Label for the category property. */
        CATEGORY: 'Category:',
        /** Label for the name property. */
        NAME: 'Name:',
        /** Label for the content section. */
        CONTENT: 'Content:'
    },

    /**
     * Separator style configuration inherited from base formatting constants.
     */
    SEPARATOR: BASE_SEPARATOR,

    /**
     * Helpful hints and informational messages for the user.
     */
    HINTS: {
        /** Hint asking if the user wants to create a fragment after creating a category. */
        CREATE_FRAGMENT_HINT: 'Category created. Create a fragment in this category now?',
        /** Hint showing the number of search results found. Uses {0} for count, {1} for keyword. */
        FOUND_FRAGMENTS: 'Found {0} fragments matching "{1}"',
        /** Hint showing the total number of categories and fragments. Uses {0} for category count, {1} for fragment count. */
        FOUND_CATEGORIES: 'Found {0} categories with {1} total fragments',
        /** Summary text showing the total number of fragments. Uses {0} for count. */
        TOTAL_FRAGMENTS: 'Total: {0} fragments',
        /** Summary text showing the total number of categories. Uses {0} for count. */
        TOTAL_CATEGORIES: 'Total: {0} categories'
    },

    /**
     * Help text structure for the 'fragments' command group.
     */
    HELP_TEXT: {
        /** Header text displayed before the command list in help output. */
        HEADER: `\n${UI_ICONS.FRAGMENT} Prompt Library - Fragments Management\n`,
        /** Detailed examples and subcommand list displayed after the main options in help output. */
        EXAMPLES: `
Subcommands:
  list         List and browse fragments
  search       Search fragments by keyword
  read         View a fragment by category and name
  create       Create a new fragment
  update       Update an existing fragment
  delete       Delete an existing fragment

Examples:
  $ prompt-library-cli fragments                   # Browse fragments interactively
  $ prompt-library-cli fragments list              # List all available fragments
  $ prompt-library-cli fragments list --json       # List fragments in JSON format
  $ prompt-library-cli fragments list --categories # List all fragment categories
  $ prompt-library-cli fragments list --category   # Browse fragments by category
  $ prompt-library-cli fragments search <keyword>  # Search fragments by keyword
  $ prompt-library-cli fragments read              # View a fragment interactively
  $ prompt-library-cli fragments read --category common --name formatting # View specific fragment
  $ prompt-library-cli fragments create            # Create a new fragment interactively
  $ prompt-library-cli fragments update            # Update a fragment interactively
  $ prompt-library-cli fragments delete            # Delete a fragment interactively

Related Commands:
  execute    Run prompts that might use fragments
  prompts    Manage prompts (which can reference fragments)
  env        Manage environment variables (which can reference fragments)
        `
    }
};
