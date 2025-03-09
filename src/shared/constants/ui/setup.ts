// src/shared/constants/ui/setup.ts
import { UI_ICONS } from './formatting';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from './messages'; // Import centralized messages

/**
 * UI constants for setup command
 */
export const SETUP_UI = {
    DESCRIPTIONS: {
        COMMAND: 'Set up the prompt library repository'
    },
    SECTION_HEADER: {
        TITLE: 'Prompt Library Setup',
        ICON: UI_ICONS.SETTINGS
    },
    INFO: {
        INTRO: 'This will set up a local repository for storing prompt files.\nYou can either clone from a remote repository or use a local directory.\n',
        REPO_EXISTS: 'Repository is already set up.',
        CONFIRM_REDO: 'Do you want to redo the setup?',
        SETUP_COMPLETE: 'Setup complete!'
    },
    MENU: {
        PROMPT: 'How would you like to set up the repository?',
        OPTIONS: {
            REMOTE: 'Clone from a remote Git repository',
            LOCAL: 'Use an existing local folder',
            DEFAULT: 'Create a default empty repository'
        }
    },
    // ADDED INPUT object
    INPUT: {
        REMOTE_URL: 'Enter the Git repository URL:',
        LOCAL_DIR: 'Enter the path to your local directory:'
    },
    SPINNER: {
        SETUP: 'Setting up repository...',
        DEFAULT_REPO: 'Creating default repository...'
    },
    SUCCESS: {
        DEFAULT_CREATED: 'Default repository created successfully',
        SETUP_LOCATION: 'Repository has been set up at: {0}',
        NEXT_STEPS: 'You can now use the CLI to manage your prompts!',
        EXAMPLE_COMMAND: 'Try: prompt-library-cli prompts --list',
        // ADDED missing success messages
        CLONED: SUCCESS_MESSAGES.REPO_CLONED, // Use centralized message
        LOCAL_SETUP: SUCCESS_MESSAGES.REPO_LOCAL_SETUP // Use centralized message
    },
    ERRORS: {
        CHECK_FAILED: 'Failed to check if setup is needed',
        CONFIRM_REDO_FAILED: 'Failed to confirm setup redo',
        SETUP_FAILED: 'Failed to setup repository',
        REMOTE_SETUP_FAILED: ERROR_MESSAGES.SETUP_FAILED.replace('Setup failed.', 'Failed to setup from remote URL.'), // More specific
        LOCAL_SETUP_FAILED: ERROR_MESSAGES.SETUP_FAILED.replace(
            'Setup failed.',
            'Failed to setup from local directory.'
        ), // More specific
        DEFAULT_SETUP_FAILED: ERROR_MESSAGES.SETUP_FAILED.replace(
            'Setup failed.',
            'Failed to create default repository.'
        ) // More specific
    }
};
