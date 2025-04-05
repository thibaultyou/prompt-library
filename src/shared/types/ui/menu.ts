/**
 * Types defining the structure and options for interactive menu items and menus.
 */

/**
 * Represents a single item within an interactive menu.
 *
 * @template T - The type of the value associated with this menu item when selected. Defaults to `string`.
 */
export interface MenuItem<T = string> {
    /** The text displayed for this menu item. Can include formatting (e.g., using chalk). */
    name: string;

    /** The value returned when this item is selected by the user. */
    value: T;

    /** An optional short description displayed alongside the item name (behavior depends on menu library). */
    description?: string;

    /**
     * If set, makes the item non-selectable. Can be a boolean `true` or a string
     * (often used by libraries like Inquirer to display a message instead of disabling).
     */
    disabled?: boolean | string;

    /**
     * The type of the menu item, used for rendering and behavior.
     * 'item': A standard selectable choice.
     * 'header': A non-selectable section header.
     * 'separator': A non-selectable visual separator line.
     */
    type?: 'header' | 'item' | 'separator';
}

/**
 * Defines configuration options for controlling the behavior and appearance of an interactive menu.
 *
 * @template T - The type of the value associated with the menu's choices. Defaults to `unknown`.
 */
export interface MenuOptions<T = unknown> {
    /** If true, automatically adds a "Go back" option to the end of the menu choices. Default: true. */
    includeGoBack?: boolean;

    /** The value to return when the "Go back" option is selected. Defaults to 'back'. */
    goBackValue?: T; // Often 'back' as string, but generic for flexibility

    /** The text label to display for the "Go back" option. Defaults to 'Go back'. */
    goBackLabel?: string;

    /** If true, clears the console screen before displaying the menu. Default: false. */
    clearConsole?: boolean;

    /** The maximum number of items to display per page before scrolling is enabled. */
    pageSize?: number;

    /** If true, allows navigation to wrap around from the last item to the first and vice-versa. Default: true. */
    loop?: boolean;

    /** If true, bypasses the interactive menu prompt and uses `defaultValue` or the first choice. Default: false. */
    nonInteractive?: boolean;

    /** The value to return automatically when `nonInteractive` is true. */
    defaultValue?: T;

    /**
     * Specifies the type or context of the menu, which can influence layout calculations
     * (e.g., header height) or styling.
     */
    menuType?: 'main' | 'prompt' | 'fragment' | 'env' | 'default';
}
