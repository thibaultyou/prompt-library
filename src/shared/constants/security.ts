/**
 * Constants related to security, primarily for identifying and handling sensitive data.
 */

/**
 * Patterns used to identify potentially sensitive data within strings,
 * such as API keys, passwords, or tokens.
 */
export const SENSITIVE_DATA_PATTERNS = {
    /**
     * Array of common substrings found in the names of sensitive configuration keys or variables.
     * Case-insensitive matching should generally be used when applying these patterns.
     */
    KEY_PATTERNS: [
        'API_KEY',
        'SECRET',
        'TOKEN',
        'PASSWORD',
        'CREDENTIAL',
        'PASSPHRASE',
        'ACCESS_KEY',
        'PRIVATE_KEY', // Added common key type
        'AUTH' // Common prefix for auth tokens
    ],

    /**
     * Array of regular expressions designed to match common formats of secrets or keys.
     * These provide more specific pattern matching than simple substring checks.
     */
    REGEX_PATTERNS: [
        // Example: Basic pattern for typical API keys
        /[a-zA-Z0-9\-_]{32,}/, // Matches strings of 32+ alphanumeric chars, underscores, hyphens

        // Example: More specific patterns (uncomment or add as needed)
        /gh[ps]_[A-Za-z0-9_]{36,255}/, // GitHub token pattern
        /xox[baprs]-[A-Za-z0-9-]{10,48}/, // Slack token pattern
        /^[A-Za-z0-9+/]{40,}$/, // Potential Base64 encoded secrets (40+ chars)
        /['"][a-zA-Z0-9\-_]{32,}['"]/ // Secrets within quotes
    ]
};

/**
 * Constants defining how sensitive data should be displayed or masked in the UI and logs.
 */
export const SECURITY_DISPLAY = {
    /** Character used for masking sensitive information (e.g., '*'). */
    MASK_CHAR: '*',
    /** Default number of characters to leave visible at the beginning/end when masking. */
    DEFAULT_VISIBLE_CHARS: 4,
    /** Standard text used to replace a fully masked sensitive value. */
    MASK_TEXT: '********', // Consistent masked representation

    /** Number of characters to show at the beginning of a partially masked value. */
    VISIBLE_PREFIX_LENGTH: 4, // Increased visibility slightly
    /** Number of characters to show at the end of a partially masked value. */
    VISIBLE_SUFFIX_LENGTH: 4 // Increased visibility slightly
};
