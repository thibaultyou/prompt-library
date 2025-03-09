import * as path from 'path';

import { getBaseDir } from '../utils/context'; // Use the context utility

/**
 * Centralized definition of important filesystem paths used by the application.
 * Uses `getBaseDir()` to adapt paths based on whether the app is running
 * in development mode (from source) or package mode (installed).
 */

/**
 * Base directory for the application's data and configuration.
 * - Development Mode: Current working directory (project root).
 * - Package Mode: ~/.prompt-library
 */
export const BASE_DIR = getBaseDir();

/**
 * Configuration directory within the base directory.
 * Stores config files, database, logs, etc.
 * Path: <BASE_DIR>/.config
 */
export const CONFIG_DIR = path.join(BASE_DIR, '.config');

/**
 * Full path to the main JSON configuration file.
 * Path: <CONFIG_DIR>/config.json
 */
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Full path to the SQLite database file.
 * Path: <CONFIG_DIR>/prompts.sqlite
 */
export const DB_PATH = path.join(CONFIG_DIR, 'prompts.sqlite');

/**
 * Directory containing user-defined prompt templates and metadata.
 * Path: <BASE_DIR>/prompts
 */
export const PROMPTS_DIR = path.join(BASE_DIR, 'prompts');

/**
 * Directory containing reusable prompt fragments.
 * Path: <BASE_DIR>/fragments
 */
export const FRAGMENTS_DIR = path.join(BASE_DIR, 'fragments');

/**
 * Directory for storing temporary files generated during operations.
 * Path: <CONFIG_DIR>/temp
 */
export const TEMP_DIR = path.join(CONFIG_DIR, 'temp');

/**
 * Constants related to the Git repository structure within the base directory.
 */
export const REPOSITORY_PATHS = {
    /** The root directory of the repository (same as BASE_DIR). */
    ROOT: BASE_DIR,
    /** Standard path to the .git directory. */
    GIT: path.join(BASE_DIR, '.git')
};

/**
 * Alias for the main library directory (same as BASE_DIR).
 * @deprecated Use BASE_DIR directly.
 */
export const LIBRARY_DIR = BASE_DIR;

/**
 * Alias for the prompts directory within the library.
 * @deprecated Use PROMPTS_DIR directly.
 */
export const LIBRARY_PROMPTS_DIR = PROMPTS_DIR;

/**
 * Alias for the fragments directory within the library.
 * @deprecated Use FRAGMENTS_DIR directly.
 */
export const LIBRARY_FRAGMENTS_DIR = FRAGMENTS_DIR;

/**
 * Structure defining the primary content directories.
 */
export const CONTENT_PATHS = {
    /** Path to the prompts directory. */
    PROMPTS: PROMPTS_DIR,
    /** Path to the fragments directory. */
    FRAGMENTS: FRAGMENTS_DIR,
    /** Path to system prompts (used internally, typically within src). */
    // Assuming system prompts remain relative to source, not BASE_DIR
    SYSTEM_PROMPTS: path.resolve(process.cwd(), 'src', 'system_prompts')
};

/**
 * Standard filenames used within prompt and fragment directories.
 */
export const FILE_PATHS = {
    /** Standard filename for the main prompt content. */
    PROMPT_MARKDOWN: 'prompt.md',
    /** Standard filename for prompt metadata. */
    METADATA_YAML: 'metadata.yml',
    /** Standard filename for documentation within content directories. */
    README: 'README.md'
};
