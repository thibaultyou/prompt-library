/**
 * Database schema definitions using SQL CREATE TABLE statements.
 * These constants define the structure of the SQLite database used by the application.
 */

export const DB_SCHEMA = {
    /**
     * Stores the main information about each prompt, including its content,
     * categorization, and basic metadata.
     */
    PROMPTS: `
        CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier for the prompt
            title TEXT NOT NULL,                  -- User-friendly title of the prompt
            content TEXT NOT NULL,                -- The actual prompt text/template
            primary_category TEXT NOT NULL,       -- Main category for organization
            directory TEXT NOT NULL UNIQUE,       -- Filesystem directory name (used as a unique key)
            one_line_description TEXT,            -- Short summary for lists/menus
            description TEXT,                     -- More detailed description
            model_provider TEXT DEFAULT 'anthropic', -- AI provider ('anthropic' or 'openai')
            content_hash TEXT,                    -- MD5 hash of the content for change detection
            tags TEXT,                            -- Comma-separated list of searchable tags
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp of creation
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Timestamp of last update
        );
    `,

    /**
     * Stores secondary categories (subcategories) associated with prompts.
     * A prompt can belong to multiple subcategories.
     */
    SUBCATEGORIES: `
        CREATE TABLE IF NOT EXISTS subcategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier for the subcategory link
            prompt_id INTEGER NOT NULL,           -- Foreign key linking to the prompts table
            name TEXT NOT NULL,                   -- Name of the subcategory
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE -- Ensure data integrity
        );
    `,

    /**
     * Stores variables defined within prompts, including their roles,
     * optionality, and potentially assigned values.
     */
    VARIABLES: `
        CREATE TABLE IF NOT EXISTS variables (
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier for the variable definition
            prompt_id INTEGER NOT NULL,           -- Foreign key linking to the prompts table
            name TEXT NOT NULL,                   -- Name of the variable (e.g., "{{VAR_NAME}}")
            role TEXT NOT NULL,                   -- Description of the variable's purpose
            value TEXT,                           -- Currently assigned value (can be direct, env ref, or fragment ref)
            optional_for_user BOOLEAN DEFAULT 0,  -- Whether the user must provide this variable (0=false, 1=true)
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE -- Ensure data integrity
        );
    `,

    /**
     * Stores links between prompts and the fragments they utilize,
     * specifying which variable the fragment content should be injected into.
     */
    FRAGMENTS: `
        CREATE TABLE IF NOT EXISTS fragments (
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier for the fragment link
            prompt_id INTEGER NOT NULL,           -- Foreign key linking to the prompts table
            category TEXT NOT NULL,               -- Category of the referenced fragment
            name TEXT NOT NULL,                   -- Name of the referenced fragment
            variable TEXT NOT NULL,               -- The prompt variable this fragment is associated with
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE -- Ensure data integrity
        );
    `,

    /**
     * Stores user-defined environment variables that can be referenced
     * within prompts or used globally by the CLI.
     */
    ENV_VARS: `
        CREATE TABLE IF NOT EXISTS env_vars (
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier for the environment variable
            name TEXT NOT NULL UNIQUE COLLATE NOCASE, -- Variable name (stored uppercase, unique case-insensitively)
            description TEXT,                     -- Optional description of the variable
            value TEXT,                           -- The value of the variable
            scope TEXT NOT NULL DEFAULT 'global', -- Scope ('global' or 'prompt')
            prompt_id INTEGER,                    -- Associated prompt ID if scope is 'prompt'
            is_secret BOOLEAN DEFAULT 0,          -- Flag indicating if the value is sensitive (0=false, 1=true)
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE SET NULL -- Allow prompt deletion without deleting var
        );
    `,

    /**
     * Tracks the execution history of prompts.
     */
    EXECUTIONS: `
        CREATE TABLE IF NOT EXISTS prompt_executions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier for the execution record
            prompt_id INTEGER NOT NULL,           -- Foreign key linking to the executed prompt
            execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the execution occurred
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE -- Ensure data integrity
        );
    `,

    /**
     * Stores prompts marked as favorites by the user.
     */
    FAVORITES: `
        CREATE TABLE IF NOT EXISTS favorite_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier for the favorite entry
            prompt_id INTEGER NOT NULL UNIQUE,    -- Foreign key linking to the favorited prompt (unique constraint)
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp when it was favorited
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE -- Ensure data integrity
        );
    `
};

/**
 * Index creation statements for performance optimization.
 */
export const DB_INDICES = {
    PROMPTS_DIRECTORY_IDX: `CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_directory ON prompts(directory);`,
    PROMPTS_CATEGORY_IDX: `CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(primary_category);`,
    SUBCATEGORIES_PROMPT_ID_IDX: `CREATE INDEX IF NOT EXISTS idx_subcategories_prompt_id ON subcategories(prompt_id);`,
    VARIABLES_PROMPT_ID_IDX: `CREATE INDEX IF NOT EXISTS idx_variables_prompt_id ON variables(prompt_id);`,
    VARIABLES_NAME_IDX: `CREATE INDEX IF NOT EXISTS idx_variables_name ON variables(name);`,
    FRAGMENTS_PROMPT_ID_IDX: `CREATE INDEX IF NOT EXISTS idx_fragments_prompt_id ON fragments(prompt_id);`,
    ENV_VARS_NAME_IDX: `CREATE UNIQUE INDEX IF NOT EXISTS idx_env_vars_name ON env_vars(UPPER(name));`, // Case-insensitive unique index
    EXECUTIONS_PROMPT_ID_IDX: `CREATE INDEX IF NOT EXISTS idx_executions_prompt_id ON prompt_executions(prompt_id);`,
    EXECUTIONS_TIMESTAMP_IDX: `CREATE INDEX IF NOT EXISTS idx_executions_timestamp ON prompt_executions(execution_time);`,
    FAVORITES_PROMPT_ID_IDX: `CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_prompt_id ON favorite_prompts(prompt_id);`
};
