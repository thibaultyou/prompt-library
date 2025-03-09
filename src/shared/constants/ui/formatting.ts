/**
 * Constants related to UI formatting, including icons, text styles,
 * table dimensions, and standard separators.
 */

/**
 * Standard UI icons used to visually represent different message types or states.
 */
export const UI_ICONS = {
    /** Icon for success messages. */
    SUCCESS: '✅',
    /** Icon for warning messages. */
    WARNING: '⚠️',
    /** Icon for error messages. */
    ERROR: '❌',
    /** Icon for informational messages. */
    INFO: 'ℹ️',
    /** Icon for indicating loading or processing. */
    LOADING: '⏳',
    /** Icon for questions or prompts requiring user input. */
    QUESTION: '❓',
    /** Default icon used for section headers if none is specified. */
    DEFAULT_HEADER: '➡️', // Changed from book for neutrality
    /** Icon often used for menus or lists. */
    MENU: '📋',
    /** Icon often used for settings or configuration. */
    SETTINGS: '⚙️',
    /** Icon specifically for general configuration. */
    CONFIG: '🔧',
    /** Icon often used for prompts or execution. */
    PROMPT: '🚀',
    /** Icon for repository related sections. */
    REPOSITORY: '📦',
    /** Icon for synchronization operations. */
    SYNC: '🔄',
    /** Icon for fragment related sections. */
    FRAGMENT: '🧩',
    /** Icon for environment variable sections. */
    ENV: '🌱',
    /** Icon for AI model configuration sections. */
    MODEL: '🧠',
    /** Icon for search-related sections or prompts. */
    SEARCH: '🔍'
};

/**
 * Configuration for standard text display elements like truncation and indentation.
 */
export const TEXT_FORMAT = {
    /** Settings for truncating long strings. */
    TRUNCATION: {
        /** Default maximum length before truncating. */
        DEFAULT_LENGTH: 50,
        /** Characters to append indicating truncation. */
        ELLIPSIS: '...'
    },
    /** Standard indentation levels in spaces. */
    INDENT: {
        /** Level 1 indentation (2 spaces). */
        LEVEL_1: 2,
        /** Level 2 indentation (4 spaces). */
        LEVEL_2: 4,
        /** Level 3 indentation (6 spaces). */
        LEVEL_3: 6
    }
};

/**
 * Configuration for formatting tables in the CLI output.
 */
export const TABLE_FORMAT = {
    /** Default widths for tables and specific columns. */
    WIDTH: {
        /** Default maximum width for the entire table. */
        DEFAULT: 100, // Adjusted default width
        /** Default width for standard columns. */
        COLUMN: 20,
        /** Default width for description columns. */
        DESCRIPTION: 40, // Adjusted description width
        /** Default width for value columns. */
        VALUE: 30 // Adjusted value width
    },
    /** Default limits for the number of rows displayed in tables. */
    ROWS: {
        /** Maximum number of rows to show with full detail before summarizing. */
        MAX_DETAILED: 10, // Increased detail rows
        /** Maximum number of rows to show in summary lists. */
        MAX_SUMMARY: 20,
        /** Default number of rows per page in interactive table menus. */
        DEFAULT_PAGE_SIZE: 15
    }
};

/**
 * Standard style type identifiers used for consistent text formatting.
 * These map to chalk styles (or potentially other formatting libraries).
 * Using constants ensures type safety and easier refactoring of styles.
 */
export const STYLE_TYPES = {
    /** Style for informational messages (typically blue or cyan). */
    INFO: 'info' as const,
    /** Style for success messages (typically green). */
    SUCCESS: 'success' as const,
    /** Style for warning messages (typically yellow). */
    WARNING: 'warning' as const,
    /** Style for error messages (typically red). */
    ERROR: 'error' as const,
    /** Style for dangerous or destructive actions (typically red). */
    DANGER: 'danger' as const,
    /** Style for primary actions or elements (typically cyan). */
    PRIMARY: 'primary' as const,
    /** Style for secondary actions or elements (typically magenta). */
    SECONDARY: 'secondary' as const,
    /** Style for debug or low-priority messages (typically gray). */
    DEBUG: 'debug' as const,
    /** Style for dimmed or less important text (typically gray/dimmed). */
    DIM: 'dim' as const,
    /** Style for bold text. */
    BOLD: 'bold' as const
};

/**
 * Standard configuration for separator lines used in UI layouts.
 */
export const SEPARATOR = {
    /** Default length for separator lines. */
    LINE_LENGTH: 50,
    /** Alias for LINE_LENGTH for backward compatibility. */
    LENGTH: 50,
    /** Default character used for single-line separators. */
    CHAR: '─',
    /** Character used for double-line separators (e.g., for major sections). */
    DOUBLE_CHAR: '═'
};
