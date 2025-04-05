/**
 * UI constants specific to the 'env' command and its subcommands.
 * Defines text, descriptions, options, and structure for the environment variable management interface.
 */
import { SEPARATOR as BASE_SEPARATOR } from './formatting'; // Import standard separator and styles
import { INFO_MESSAGES, ERROR_MESSAGES, WARNING_MESSAGES } from './messages'; // Import centralized messages

export const ENV_UI = {
    /**
     * Descriptions used in command help text for 'env' and its subcommands.
     */
    DESCRIPTIONS: {
        /** Description for the main 'env' command. */
        COMMAND: 'Manage global and prompt-specific environment variables.',
        /** Description for the 'env list' subcommand. */
        LIST_COMMAND: 'List and browse all defined environment variables.',
        /** Description for the 'env create' subcommand. */
        CREATE_COMMAND: 'Create a new custom environment variable.',
        /** Description for the 'env delete' subcommand. */
        DELETE_COMMAND: 'Delete a custom environment variable.',
        /** Description for the 'env read' subcommand. */
        READ_COMMAND: 'View details, value, or sources of an environment variable.',
        /** Description for the 'env update' subcommand. */
        UPDATE_COMMAND: 'Update the value of an existing environment variable.'
    },

    /**
     * Descriptions for command-line options used by 'env' commands.
     */
    OPTIONS: {
        /** Option to output results in JSON format. */
        JSON_FORMAT: 'Output in JSON format (for CI/scripts).',
        /** Option to set a variable's value directly (KEY=VALUE). */
        SET_OPTION: 'Set or update a variable with a direct value (e.g., MY_VAR=some_value).',
        /** Option to set a variable to reference a fragment (KEY=category/name). */
        FRAGMENT_OPTION: 'Set or update a variable to reference a fragment (e.g., CONTEXT=common/project_details).',
        /** Option to create a new variable (used in legacy command). */
        CREATE_OPTION: 'Create a new environment variable (legacy).',
        /** Option to get detailed information about a variable. */
        INFO_OPTION: 'Get detailed information about a specific variable by name.',
        /** Option to delete a custom variable by name. */
        DELETE_OPTION: 'Specify the name of the custom variable to delete.',
        /** Option to unset (clear value or delete) a variable by name. */
        UNSET_OPTION: 'Clear the value of a variable (inferred) or delete it (custom).',
        /** Option to skip the confirmation prompt during deletion. */
        FORCE_DELETE: 'Force deletion of a custom variable without confirmation.',
        /** Option to view only the resolved value of a variable. */
        VALUE_ONLY: 'Display only the resolved value of the specified variable.',
        /** Option to show the prompts where a variable is used. */
        SOURCES: 'Show the prompts that use the specified variable.',
        /** Option to display prompt titles instead of IDs when showing sources. */
        SHOW_TITLES: 'Show prompt titles instead of IDs when using --sources.'
    },

    /**
     * Titles and icons for different sections within the 'env' command's UI.
     */
    SECTION_HEADER: {
        /** Main title for the environment variable management section. */
        TITLE: 'Environment Variables',
        /** Default icon for environment variable sections. */
        ICON: '🌱',
        /** Title for the variable creation section. */
        CREATE: 'Create New Environment Variable',
        /** Icon for the variable creation section. */
        CREATE_ICON: '✨', // Changed icon
        /** Prefix for the variable management section title. */
        VARIABLE_MANAGEMENT: 'Manage Variable: ',
        /** Icon for the variable management section. */
        MANAGEMENT_ICON: '🔧',
        /** Prefix for the section showing prompts using a variable. */
        PROMPTS_USING: 'Prompts Using ',
        /** Icon for the prompts using variable section. */
        PROMPTS_ICON: '📊',
        /** Title for the section explaining why an inferred variable cannot be deleted. */
        CANNOT_DELETE_INFERRED: 'Cannot Delete Inferred Variable',
        /** Title for the deletion confirmation section. */
        DELETE_CONFIRMATION: 'Confirm Variable Deletion',
        /** Title for the variable update section. */
        UPDATE_VARIABLE: 'Update Environment Variable',
        /** Title for the variable information view section. */
        VARIABLE_INFO: 'Environment Variable Information'
    },

    /**
     * Text prompts used in interactive menus for environment variables.
     */
    MENU: {
        /** Prompt for selecting a variable from a list. */
        PROMPT: 'Select an environment variable to manage:',
        /** Prompt for choosing an action for a selected variable. */
        MANAGE_PROMPT: 'Choose an action for this variable:',
        /** Prompt for selecting the type of value for a new variable. */
        CREATE_TYPE_PROMPT: 'Select the type of value for the new variable:',
        /** Prompt for selecting a fragment to reference. */
        FRAGMENT_PROMPT: 'Select a fragment to reference:',
        /** Prompt for selecting the type of information to view for a variable. */
        INFO_TYPE_PROMPT: 'Select the information you want to view:',
        /** Prompt for selecting how to update a variable. */
        UPDATE_TYPE_PROMPT: 'Select how you want to update the variable:'
    },

    /**
     * Standard labels used in the environment variable UI.
     */
    LABELS: {
        // --- Menu Actions ---
        /** Menu item to create a new variable. */
        CREATE_VARIABLE: 'Create new custom variable',
        /** Menu item to set/update a variable's value directly. */
        SET_VALUE: 'Set/Update direct value',
        /** Menu item to set/update a variable to reference a fragment. */
        SET_FRAGMENT: 'Set/Update fragment reference',
        /** Menu item to unset (clear or delete) a variable. */
        UNSET: 'Unset variable',
        /** Menu item to clear a variable's value (for inferred variables). */
        CLEAR_VALUE: 'Clear value',
        /** Menu item to view prompts using the variable. */
        VIEW_PROMPTS: 'View prompts using this variable',
        /** Menu item option for setting a direct value. */
        SET_DIRECT_VALUE: 'Set a direct value',
        /** Menu item option for setting a fragment reference. */
        SET_FRAGMENT_REF: 'Set a reference to a fragment',
        /** Standard 'Go back' menu item. */
        GO_BACK: 'Go back',
        /** Menu item option for viewing detailed variable info. */
        DETAILED_INFO: 'View detailed information',
        /** Menu item option for viewing the variable's resolved value. */
        VARIABLE_VALUE: 'View variable value',
        /** Menu item option for viewing the prompts using the variable. */
        PROMPT_SOURCES: 'View prompt sources',

        // --- Variable Properties ---
        /** Label for the variable's description/role. */
        DESCRIPTION: 'Description:',
        /** Label for the variable's current status (Set/Not Set). */
        STATUS: 'Status:',
        /** Label for the type of value (Direct/Fragment). */
        TYPE: 'Type:',
        /** Label for the fragment reference path. */
        REFERENCE: 'Reference:',
        /** Label for the variable's direct value. */
        VALUE: 'Value:',
        /** Label indicating which prompts use the variable. */
        USED_IN: 'Used in:',
        /** Label for displaying fragment content preview. */
        FRAGMENT_CONTENT: 'Fragment Content Preview:',
        /** Label for the variable's name. */
        VARIABLE_NAME: 'Name:',
        /** Label indicating a fragment reference. */
        FRAGMENT: 'Fragment:',
        /** Label for the variable's scope (global/prompt). */
        SCOPE: 'Scope:',
        /** Label for the variable's database ID. */
        ID: 'ID:',
        /** Label indicating if the variable is treated as secret. */
        IS_SECRET: 'Secret:',
        /** Label indicating if the variable is required by a prompt. */
        IS_REQUIRED: 'Required:'
    },

    /**
     * Standard action identifiers used internally for 'env' command operations.
     */
    ACTIONS: {
        /** Action identifier for creating a variable. */
        CREATE: 'create' as const,
        /** Action identifier for setting a direct value. */
        SET: 'set' as const,
        /** Action identifier for setting a fragment reference. */
        SET_FRAGMENT: 'set-fragment' as const,
        /** Action identifier for unsetting a variable. */
        UNSET: 'unset' as const,
        /** Action identifier for viewing prompts using a variable. */
        VIEW_PROMPTS: 'view-prompts' as const,
        /** Action identifier representing a direct value type. */
        VALUE: 'value' as const,
        /** Action identifier representing a fragment reference type. */
        FRAGMENT: 'fragment' as const,
        /** Standard action identifier for going back. */
        BACK: 'back' as const,
        /** Action identifier for refreshing the variable list. */
        REFRESH: 'refresh' as const,
        /** Action identifier for clearing a variable's value. */
        CLEAR_VALUE: 'clear' as const // Renamed from 'clear' for clarity
    },

    /**
     * Display text for different variable statuses.
     */
    STATUS: {
        /** Status indicating the variable has a value assigned. */
        SET: 'Set',
        /** Status indicating the variable has no value or is empty. */
        NOT_SET: 'Not Set',
        /** Status indicating the variable's value is a fragment reference. */
        FRAGMENT_REFERENCE: 'Fragment Reference',
        /** Status indicating the variable's value is a direct string. */
        DIRECT_VALUE: 'Direct Value',
        /** Status indicating the variable's value is sensitive and masked. */
        SENSITIVE_VALUE: '******** (sensitive)',
        /** Status indicating the variable is custom and not used in any prompts. */
        CUSTOM_VARIABLE: 'Custom (not used in prompts)'
    },

    /**
     * Text prompts used for gathering user input related to environment variables.
     */
    INPUT: {
        /** Prompt for entering the variable name. */
        VARIABLE_NAME: 'Enter variable name (e.g., MY_API_KEY): ',
        /** Prompt for entering the variable's value. */
        ENTER_VALUE: 'Enter value: ',
        /** Prompt for entering an optional description. */
        ENTER_DESCRIPTION: 'Enter description (optional): ',
        /** Prompt asking if the variable value is secret. */
        IS_SECRET: 'Is this a secret value? (yes/no): '
    },

    /**
     * Separator style configuration inherited from base formatting constants.
     */
    SEPARATOR: BASE_SEPARATOR,

    /**
     * Helpful hints and informational messages for the user.
     */
    HINTS: {
        /** General troubleshooting suggestions. */
        TROUBLESHOOTING_HINTS: INFO_MESSAGES.TROUBLESHOOTING_HINTS,
        /** Hint shown after creating a variable. */
        VARIABLE_CREATED_HINT: INFO_MESSAGES.VARIABLE_CREATED_HINT,
        /** Explanation about inferred variables. */
        INFERRED_VARIABLES_INFO: 'Inferred variables are derived from prompts and cannot be deleted directly.',
        /** Hint suggesting the use of the 'update' command for inferred variables. */
        UPDATE_COMMAND_HINT: 'Use the "update" command to change its value.'
    },

    /**
     * Message templates used in various scenarios within the 'env' command UI.
     */
    MESSAGES: {
        /** Warning message shown before deleting a variable. */
        DELETE_WARNING: 'You are about to delete the custom variable "{0}".',
        /** Standard confirmation that an action cannot be undone. */
        ACTION_IRREVERSIBLE: WARNING_MESSAGES.OPERATION_CANCELLED.replace('Operation', 'This action cannot be undone.'), // Reused message
        /** Warning message when attempting to delete an inferred variable. */
        INFERRED_VARIABLE_WARNING: 'The variable "{0}" is inferred from prompts and cannot be deleted.',
        /** Message indicating how many prompts use a variable. */
        USED_IN_PROMPTS: 'This variable is used by {0} prompt(s).',
        /** Confirmation prompt for showing prompt titles instead of IDs. */
        SHOW_PROMPT_TITLES_CONFIRM: 'Show prompt titles instead of IDs?',
        /** Instruction for entering a new value for a variable. */
        ENTER_NEW_VALUE: 'Enter the new value for this variable. Press Ctrl+C to cancel.',
        /** Error message for invalid fragment path format. */
        INVALID_FRAGMENT_PATH: ERROR_MESSAGES.INVALID_FORMAT_FRAGMENT.replace(
            'Error: Invalid format. Use --fragment key=category/name',
            'Invalid fragment path format. Use category/name.'
        ) // Reused message
    }
};
