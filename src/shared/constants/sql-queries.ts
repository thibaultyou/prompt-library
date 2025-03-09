/**
 * Centralized repository of SQL queries used throughout the application.
 * Organizing queries here improves maintainability and reduces duplication.
 * Uses standard SQL syntax compatible with SQLite.
 */
export const SQL_QUERIES = {
    // --- Prompt Table Operations ---
    PROMPT: {
        /** Select a prompt by its unique ID. */
        GET_BY_ID: 'SELECT * FROM prompts WHERE id = ?',
        /** Select a prompt by its title (case-insensitive search). */
        GET_BY_TITLE: 'SELECT * FROM prompts WHERE LOWER(title) LIKE ?',
        /** Select a prompt's ID by its unique directory name. */
        GET_BY_DIRECTORY: 'SELECT id FROM prompts WHERE directory = ?',
        /** Select a prompt's directory by its unique ID. */
        GET_DIRECTORY_BY_ID: 'SELECT directory FROM prompts WHERE id = ?',
        /** Select all columns for a prompt by its unique directory name. */
        GET_FULL_BY_DIRECTORY: 'SELECT * FROM prompts WHERE directory = ?',
        /** Insert a new prompt record. */
        INSERT: `
            INSERT INTO prompts (title, content, primary_category, directory, one_line_description, description, content_hash, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        /** Update an existing prompt record by ID. */
        UPDATE: `
            UPDATE prompts SET
                title = ?, content = ?, primary_category = ?, directory = ?,
                one_line_description = ?, description = ?, content_hash = ?, tags = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
        /** Delete a prompt record by ID. Cascading deletes handle related data. */
        DELETE: 'DELETE FROM prompts WHERE id = ?',
        /** Select all prompts with basic details, grouping subcategories. */
        GET_ALL: `
            SELECT p.id, p.title, p.primary_category, p.directory, p.one_line_description, p.description,
                   GROUP_CONCAT(s.name) as subcategories
            FROM prompts p
            LEFT JOIN subcategories s ON p.id = s.prompt_id
            GROUP BY p.id
            ORDER BY p.primary_category, p.title
        `,
        /** Search prompts by matching content (case-insensitive). */
        SEARCH_BY_CONTENT: `
            SELECT id, title, primary_category, directory, content, one_line_description, description
            FROM prompts
            WHERE LOWER(content) LIKE ?
        `,
        /** Select only the directory names of all prompts. */
        GET_DIRECTORIES: 'SELECT directory FROM prompts',
        /** Select ID and directory names of all prompts. */
        GET_ALL_DIRECTORIES: 'SELECT id, directory FROM prompts',
        /** Select all prompts with concatenated subcategories and tags for easier processing. */
        GET_ALL_WITH_DETAILS: `
            SELECT p.*, GROUP_CONCAT(DISTINCT s.name) as subcategories_concat
            FROM prompts p
            LEFT JOIN subcategories s ON p.id = s.prompt_id
            GROUP BY p.id
            ORDER BY p.id
        `
    },

    // --- Subcategory Table Operations ---
    SUBCATEGORY: {
        /** Select all subcategory names for a given prompt ID. */
        GET: 'SELECT name FROM subcategories WHERE prompt_id = ?',
        /** Insert a new subcategory link for a prompt. */
        INSERT: 'INSERT INTO subcategories (prompt_id, name) VALUES (?, ?)',
        /** Delete all subcategory links for a given prompt ID. */
        DELETE: 'DELETE FROM subcategories WHERE prompt_id = ?'
    },

    // --- Variable Table Operations ---
    VARIABLE: {
        /** Select basic variable details (name, role, optionality) for a prompt ID. */
        GET: 'SELECT name, role, optional_for_user FROM variables WHERE prompt_id = ?',
        /** Select variable details including the current value for a prompt ID. */
        GET_WITH_VALUES: 'SELECT name, role, optional_for_user, value FROM variables WHERE prompt_id = ?',
        /** Select only the name and value of variables for a prompt ID. */
        GET_VALUES: 'SELECT name, value FROM variables WHERE prompt_id = ?',
        /** Insert a new variable definition for a prompt (without a value). */
        INSERT: 'INSERT INTO variables (prompt_id, name, role, optional_for_user) VALUES (?, ?, ?, ?)',
        /** Insert a new variable definition for a prompt (with a value). */
        INSERT_WITH_VALUE:
            'INSERT INTO variables (prompt_id, name, role, optional_for_user, value) VALUES (?, ?, ?, ?, ?)',
        /** Update the value of a specific variable for a prompt. */
        UPDATE_VALUE: 'UPDATE variables SET value = ? WHERE prompt_id = ? AND name = ?',
        /** Delete all variables associated with a given prompt ID. */
        DELETE: 'DELETE FROM variables WHERE prompt_id = ?',
        /** Select distinct prompt IDs that use a specific variable name. */
        GET_PROMPTS_BY_VARIABLE: 'SELECT DISTINCT prompt_id FROM variables WHERE name = ?',
        /** Select basic details (name, role, prompt_id) for all variables across all prompts. */
        GET_ALL: 'SELECT name, role, prompt_id FROM variables'
    },

    // --- Fragment Link Table Operations ---
    FRAGMENT: {
        /** Select all fragment links (category, name, variable) for a given prompt ID. */
        GET: 'SELECT category, name, variable FROM fragments WHERE prompt_id = ?',
        /** Delete all fragment links associated with a given prompt ID. */
        DELETE: 'DELETE FROM fragments WHERE prompt_id = ?',
        /** Insert a new fragment link for a prompt. */
        INSERT: 'INSERT INTO fragments (prompt_id, category, name, variable) VALUES (?, ?, ?, ?)'
    },

    // --- Environment Variable Table Operations ---
    ENV_VAR: {
        /** Select all environment variables. */
        GET_ALL: 'SELECT * FROM env_vars ORDER BY name',
        /** Select an environment variable by its exact name (case-sensitive). */
        GET_BY_NAME: 'SELECT * FROM env_vars WHERE name = ?',
        /** Select an environment variable by its name (case-insensitive). Uses UPPER for index. */
        GET_BY_NAME_INSENSITIVE: 'SELECT * FROM env_vars WHERE UPPER(name) = UPPER(?)',
        /** Insert a new environment variable. */
        INSERT: 'INSERT INTO env_vars (name, value, scope, prompt_id) VALUES (?, ?, ?, ?)',
        /** Insert a new environment variable with description and secret flag. */
        INSERT_WITH_DESCRIPTION:
            'INSERT INTO env_vars (name, description, value, scope, prompt_id, is_secret) VALUES (?, ?, ?, ?, ?, ?)',
        /** Update the value of an environment variable by its ID. */
        UPDATE: 'UPDATE env_vars SET value = ? WHERE id = ?',
        /** Update value, scope, and prompt_id of an environment variable by its ID. */
        UPDATE_FULL: 'UPDATE env_vars SET value = ?, scope = ?, prompt_id = ? WHERE id = ?',
        /** Update all fields of an environment variable by its ID. */
        UPDATE_WITH_DESCRIPTION:
            'UPDATE env_vars SET value = ?, description = ?, scope = ?, prompt_id = ?, is_secret = ? WHERE id = ?',
        /** Delete an environment variable by its ID. */
        DELETE: 'DELETE FROM env_vars WHERE id = ?',
        /** Select all environment variables with 'global' scope. */
        GET_GLOBAL: 'SELECT * FROM env_vars WHERE scope = "global" ORDER BY name',
        /** Select all environment variables with 'prompt' scope for a specific prompt ID. */
        GET_PROMPT_SPECIFIC: 'SELECT * FROM env_vars WHERE scope = "prompt" AND prompt_id = ? ORDER BY name',
        /** Select all global variables plus prompt-specific variables for a given prompt ID. */
        GET_GLOBAL_AND_PROMPT:
            'SELECT * FROM env_vars WHERE scope = "global" OR (scope = "prompt" AND prompt_id = ?) ORDER BY name'
    },

    // --- Favorite Prompts Table Operations ---
    FAVORITE: {
        /** Add a prompt to favorites by ID. */
        ADD: 'INSERT INTO favorite_prompts (prompt_id) VALUES (?)',
        /** Add a prompt to favorites, ignoring if it already exists. */
        ADD_IGNORE_DUPLICATES: 'INSERT OR IGNORE INTO favorite_prompts (prompt_id) VALUES (?)',
        /** Delete a prompt from favorites by prompt ID. */
        DELETE: 'DELETE FROM favorite_prompts WHERE prompt_id = ?',
        /** Check if a specific prompt ID exists in favorites. */
        CHECK: 'SELECT COUNT(*) as count FROM favorite_prompts WHERE prompt_id = ?',
        /** Count the total number of favorite prompts. */
        COUNT: 'SELECT COUNT(*) as count FROM favorite_prompts',
        /** Select all favorite prompts along with their basic details from the prompts table. */
        GET_ALL: `
            SELECT fp.id, fp.prompt_id, fp.timestamp, p.title, p.primary_category, p.directory, p.one_line_description as description
            FROM favorite_prompts fp
            JOIN prompts p ON fp.prompt_id = p.id
            ORDER BY fp.timestamp DESC
        `
    },

    // --- Prompt Execution History Table Operations ---
    EXECUTION: {
        /** Record a new prompt execution event. */
        RECORD: 'INSERT INTO prompt_executions (prompt_id) VALUES (?)',
        /** Delete all execution records for a specific prompt ID. */
        DELETE: 'DELETE FROM prompt_executions WHERE prompt_id = ?',
        /** Select the most recently executed prompts (distinct) with basic details. */
        GET_RECENT: `
            SELECT pe.id, pe.prompt_id, p.title, p.primary_category, p.directory, p.one_line_description as description, MAX(pe.execution_time) as execution_time
            FROM prompt_executions pe
            JOIN prompts p ON pe.prompt_id = p.id
            GROUP BY pe.prompt_id
            ORDER BY MAX(pe.execution_time) DESC
            LIMIT ?
        `
    },

    // --- Database Cleanup Operations ---
    CLEANUP: {
        /** Delete all records from the prompts table. */
        DELETE_ALL_PROMPTS: 'DELETE FROM prompts',
        /** Delete all records from the subcategories table. */
        DELETE_ALL_SUBCATEGORIES: 'DELETE FROM subcategories',
        /** Delete all records from the variables table. */
        DELETE_ALL_VARIABLES: 'DELETE FROM variables',
        /** Delete all records from the fragments table. */
        DELETE_ALL_FRAGMENTS: 'DELETE FROM fragments',
        /** Delete all records from the env_vars table. */
        DELETE_ALL_ENV_VARS: 'DELETE FROM env_vars',
        /** Delete all records from the prompt_executions table. */
        DELETE_ALL_EXECUTIONS: 'DELETE FROM prompt_executions',
        /** Delete all records from the favorite_prompts table. */
        DELETE_ALL_FAVORITES: 'DELETE FROM favorite_prompts'
    }
};
