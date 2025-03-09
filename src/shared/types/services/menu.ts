/**
 * Types related to menu services, defining structures for commands
 * that can be represented and executed within interactive menus.
 */

/**
 * Interface representing a simple command object suitable for display and execution
 * within a menu system. This is often used by menu services to represent actions
 * that trigger specific commands.
 */
export interface MenuCommand {
    /** The display name of the command as it should appear in the menu. */
    name: string;

    /** A brief description of what the command does. */
    description: string;

    /** The function to call when this menu item is selected, executing the command's logic. */
    execute: () => Promise<void>;
}
