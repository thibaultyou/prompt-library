/**
 * Types defining the configuration structure for creating interactive menus,
 * particularly used with menu builder utilities or libraries like Inquirer.
 */
import { MenuItem } from './menu'; // Import the standard MenuItem type

/**
 * Configuration object used to define the properties and behavior of an interactive menu.
 *
 * @template T - The type of the value associated with each selectable menu item. Defaults to `unknown`.
 */
export interface MenuConfig<T = unknown> {
    /** The main prompt message displayed to the user above the menu choices. */
    message: string;

    /**
     * An array of `MenuItem` objects representing the choices available in the menu.
     * This array can include standard items, headers, and separators.
     */
    choices: MenuItem<T>[];

    /** The maximum number of menu items to display on the screen at once before scrolling. */
    pageSize?: number;

    /** If true, navigation wraps around from the last item to the first and vice-versa. */
    loop?: boolean;

    /**
     * Optional theme object for customizing the appearance of the menu.
     * The structure depends on the underlying menu library (e.g., Inquirer).
     */
    theme?: Record<string, unknown>; // Structure depends on the menu library
}
