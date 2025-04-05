/**
 * Constants specific to the main Command Line Interface (CLI) presentation,
 * including branding, descriptions, and help text structure.
 */

/**
 * CLI header information and branding elements.
 */
export const CLI_HEADER = {
    /** The main title displayed at the top of the CLI help output. */
    TITLE: '🧠 Prompt Library CLI - AI Prompt Management Tool',
    /** The current version of the CLI application. Should be updated via package.json. */
    VERSION: '1.0.0' // Consider reading from package.json dynamically if needed
};

/**
 * Structured help text sections used in the main CLI help output (`--help`).
 */
export const CLI_HELP = {
    /** Provides a categorized overview of the available commands. */
    CATEGORIES: `
Command Categories:
• Content:       prompts, fragments      - Manage prompt templates and fragments
• Execution:     execute                 - Run prompts with AI models
• Configuration: config, model, env      - Configure app settings and environment
• Repository:    setup, sync, repository - Manage prompt library repository
• System:        flush                   - Maintenance operations`,

    /** Provides common usage examples for key commands. */
    EXAMPLES: `
Examples:
$ prompt-library-cli                     # Start interactive menu
$ prompt-library-cli setup               # Set up prompt library repository
$ prompt-library-cli execute -p 74       # Execute prompt by ID
$ prompt-library-cli execute -p "commit" # Execute prompt by name (fuzzy match)
$ prompt-library-cli prompts --list      # List all available prompts
$ prompt-library-cli prompts --search "git" # Search prompts containing "git"
$ prompt-library-cli fragments --list    # List all prompt fragments
$ prompt-library-cli model               # Configure AI model settings
$ prompt-library-cli sync                # Sync prompt repository with remote
$ prompt-library-cli env --list          # List all environment variables`
};

/**
 * A brief description of the CLI application's purpose.
 */
export const CLI_DESCRIPTION = 'Interactive CLI for managing and executing AI prompts';
