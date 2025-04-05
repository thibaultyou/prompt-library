/**
 * Constants related to interactive menu behavior and display.
 */

/**
 * Standard values and labels for common menu navigation actions.
 */
export const MENU_NAVIGATION = {
    /** Represents the action to go back to the previous menu or state. */
    BACK: {
        LABEL: 'Go back',
        VALUE: 'back'
    },
    /** Represents the action to exit the application or current workflow. */
    EXIT: {
        LABEL: 'Exit',
        VALUE: 'exit'
    },
    /** Represents the action to cancel the current operation. */
    CANCEL: {
        LABEL: 'Cancel',
        VALUE: 'cancel'
    }
};

/**
 * Default display settings for interactive menus.
 */
export const MENU_DISPLAY = {
    /** Default number of items shown per page in a scrollable menu. */
    PAGE_SIZE: 20, // Increased default size
    /** Default setting for whether menus should loop when navigating past the top/bottom. */
    LOOP: true,
    /** Default setting for whether to clear the console before showing a menu. */
    CLEAR_CONSOLE: true
};

/**
 * Standard type identifiers for different kinds of menu items.
 * Used internally by menu rendering logic.
 */
export const MENU_ITEM_TYPES = {
    /** A non-selectable item used as a section header. */
    HEADER: 'header',
    /** A non-selectable item used as a visual separator. */
    SEPARATOR: 'separator',
    /** A standard selectable menu item. */
    ITEM: 'item',
    /** A non-selectable item used purely for spacing (similar to separator but might be empty). */
    SPACER: 'spacer'
};

/**
 * Keywords that, when entered in an input prompt allowing cancellation,
 * will trigger the cancellation behavior (returning null). Case-insensitive.
 */
export const CANCEL_KEYWORDS = ['cancel', 'exit', 'quit', 'back', ':q'];

/**
 * Standard text prompts used in various menu interactions.
 */
export const MENU_PROMPTS = {
    /** Default message shown when asking the user to select an option. */
    DEFAULT: 'Select an option:',
    /** Standard instruction for navigating menus. */
    NAVIGATION: 'Use ↑↓ to navigate, Enter to select',
    /** Default message for confirmation prompts. */
    CONFIRMATION: 'Are you sure?',
    /** Default message for search input prompts. */
    SEARCH: 'Type to search:'
};
