import { PROMPTS_DIR, FRAGMENTS_DIR, DB_PATH, TEMP_DIR, MENU_DISPLAY } from '../constants';

/**
 * CLI-specific configuration (used when running as installed package)
 * Defines paths and settings relevant when the application is installed
 * and run as a command-line tool (e.g., globally or via npx).
 */
// TODO - Relocate
export interface CliConfig {
    /** Directory containing prompt templates within the user's data directory. */
    PROMPTS_DIR: string;

    /** Directory containing prompt fragments within the user's data directory. */
    FRAGMENTS_DIR: string;

    /** Path to the SQLite database file within the user's config directory. */
    DB_PATH: string;

    /** Directory for temporary files used by the CLI. */
    TEMP_DIR: string;

    /** Default number of items to display per page in interactive menus. */
    MENU_PAGE_SIZE: number;
}

/**
 * Concrete implementation of CliConfig using constants defined for the CLI environment.
 * These paths typically point to locations within the user's home directory
 * (e.g., ~/.prompt-library).
 */
export const cliConfig: CliConfig = {
    PROMPTS_DIR, // Path like ~/.prompt-library/repository/prompts
    FRAGMENTS_DIR, // Path like ~/.prompt-library/repository/fragments
    DB_PATH, // Path like ~/.prompt-library/.config/prompts.sqlite
    TEMP_DIR, // Path like ~/.prompt-library/.config/temp
    MENU_PAGE_SIZE: MENU_DISPLAY.PAGE_SIZE // Default menu page size
};
