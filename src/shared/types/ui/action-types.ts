/**
 * Defines standardized string literal types for actions used throughout the
 * application's interactive menus and command handling. This ensures consistency
 * and reduces the risk of typos when referring to actions.
 */

/**
 * Common actions related to navigation or UI structure, shared across many menus.
 */
export type CommonAction =
    // Navigation
    | 'back' // Go to the previous menu/state
    | 'exit' // Exit the application or current workflow

    // UI Elements (often non-selectable)
    | 'separator' // Visual separator line
    | 'header' // Section header text
    | 'spacer'; // Blank space for layout

/**
 * Common actions related to managing resources (like prompts, fragments, variables).
 */
export type ResourceAction =
    | 'create' // Create a new resource
    | 'update' // Update an existing resource
    | 'delete' // Delete an existing resource
    | 'view' // View details of a resource
    | 'read' // Read content or details of a resource (often synonymous with 'view')
    | 'list' // List multiple resources
    | 'search' // Search for resources
    | 'execute'; // Execute or run a resource (e.g., a prompt)

/**
 * Actions available in the main application menu.
 */
export type MainMenuAction =
    // Top-level command categories
    | 'sync'
    | 'prompt'
    | 'fragment'
    | 'env'
    | 'model'
    | 'config'
    | 'flush'
    | 'repository'

    // Common UI/navigation actions
    | CommonAction

    // Specific header identifiers used in the main menu structure
    | 'quick_actions_header'
    | 'menu_header'
    | 'config_header'
    | 'repo_header'

    // Specific actions within the main menu context
    | 'list_changes' // Action to view pending repository changes
    | 'reset_changes' // Action to reset repository changes
    | 'push_changes' // Action to push repository changes
    | 'last_prompt' // Action to execute the most recently used prompt
    | 'search_prompts' // Action to initiate a prompt search
    | 'favorites' // Action to view favorite prompts
    | 'recent'; // Action to view recent prompts

/**
 * Actions specific to the 'prompts' command group and its submenus.
 */
export type PromptAction =
    // Common navigation and resource actions
    | CommonAction
    | ResourceAction

    // Prompt-specific listing/browsing actions
    | 'category' // Browse by category
    | 'all' // List all prompts
    | 'id' // List prompts sorted by ID
    | 'recent' // View recent prompts
    | 'favorites' // View favorite prompts

    // Prompt-specific management actions
    | 'refresh' // Refresh prompt metadata
    | 'variables' // Manage prompt variables
    | 'view_content' // View the full content of a prompt
    | 'favorite' // Add prompt to favorites
    | 'unfavorite' // Remove prompt from favorites
    | 'history' // View conversation history
    | 'unset_all'; // Clear all variable values for a prompt

/**
 * Actions specific to the 'fragments' command group and its submenus.
 */
export type FragmentAction =
    // Common navigation and resource actions
    | CommonAction
    | ResourceAction

    // Fragment-specific listing/browsing actions
    | 'category' // Browse by category
    | 'all' // List all fragments
    | 'categories' // List fragment categories

    // Fragment-specific management actions
    | 'insert' // (Potentially for inserting into prompts - context dependent)
    | 'new_search'; // Start a new search within the fragment context

/**
 * Actions specific to the 'config' command group.
 */
export type ConfigAction =
    // Common navigation actions
    | CommonAction

    // Config-specific actions
    | 'view' // View current configuration
    | 'set' // Set a configuration value
    | 'flush' // Flush application data (delegated)
    | 'reset'; // Reset configuration to defaults

/**
 * Actions specific to the 'model' command group.
 */
export type ModelAction =
    // Common navigation actions
    | CommonAction

    // Model-specific actions
    | 'provider' // Change AI provider
    | 'model' // Select specific model
    | 'key'; // Configure API key

/**
 * Actions specific to the 'env' command group (environment variables).
 */
export type EnvAction =
    // Common navigation actions
    | CommonAction

    // Env-specific actions
    | 'set' // Set/update a direct value
    | 'set-fragment' // Set/update to a fragment reference
    | 'unset' // Unset (clear value or delete) a variable
    | 'view-prompts' // View prompts using the variable
    | 'value' // Action representing a direct value type (for creation/update menus)
    | 'fragment' // Action representing a fragment reference type (for creation/update menus)
    | 'refresh' // Refresh the list of variables
    | 'clear'; // Action to clear a variable's value

// --- Type Aliases for Simplicity/Backward Compatibility ---

/** Alias for MainMenuAction. */
export type MenuAction = MainMenuAction;

/** Alias for PromptAction. */
export type PromptMenuAction = PromptAction;

/** Alias for FragmentAction. */
export type FragmentMenuAction = FragmentAction;
