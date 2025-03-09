/**
 * UI constants for repository command
 */
export const REPOSITORY_UI = {
    DESCRIPTIONS: {
        COMMAND: 'Manage the prompt library repository'
    },
    SECTION_HEADER: {
        TITLE: 'Repository Management',
        ICON: '📦'
    },
    LABELS: {
        LOCAL_DIR: 'Local Directory:',
        REMOTE_URL: 'Remote URL:',
        CURRENT_BRANCH: 'Current Branch:',
        STATUS: 'Status:',
        PENDING_CHANGES: 'Pending Changes:',
        UP_TO_DATE: 'Up to date',
        CHANGES_PENDING: 'Changes pending',
        NOT_CONFIGURED: 'Not configured'
    },
    MENU: {
        PROMPT: 'Use ↑↓ to select an action:',
        OPTIONS: {
            SETUP: 'Setup repository (clone or use local)',
            BRANCH: 'Change branch',
            STATUS: 'View repository status'
        },
        SETUP_PROMPT: 'Choose a setup option:',
        SETUP_OPTIONS: {
            REMOTE: 'Clone from a remote repository',
            LOCAL: 'Use an existing local folder',
            DEFAULT: 'Create a default empty repository'
        },
        BRANCH_PROMPT: 'Select a branch to checkout:',
        BRANCH_OPTIONS: {
            NEW: 'Create new branch'
        }
    },
    INPUT: {
        REMOTE_URL: 'Enter the Git repository URL:',
        LOCAL_DIR: 'Enter the path to your local repository:',
        NEW_BRANCH: 'Enter new branch name:'
    },
    SPINNER: {
        SETUP: 'Setting up repository...',
        BRANCH_CREATE: 'Creating and checking out branch: {0}...',
        BRANCH_CHECKOUT: 'Checking out branch: {0}...'
    },
    SUCCESS: {
        SETUP_COMPLETE: 'Repository setup complete',
        CLONED: 'Repository cloned to {0}',
        LOCAL_SETUP: 'Repository setup at {0}',
        BRANCH_CREATED: 'Branch created and checked out: {0}',
        BRANCH_CHECKOUT: 'Branch checked out: {0}',
        REMOTE_ADDED: 'Remote repository added successfully'
    },
    ERRORS: {
        SETUP_FAILED: 'Setup failed',
        BRANCH_CREATE_FAILED: 'Failed to create branch',
        BRANCH_CHECKOUT_FAILED: 'Failed to checkout branch',
        GET_BRANCHES_FAILED: 'Failed to get branches',
        GET_INFO_FAILED: 'Failed to retrieve repository information',
        ADD_REMOTE_FAILED: 'Failed to add remote'
    },
    INFO: {
        SYNC_INSTRUCTION: 'You can now run the sync command to ensure your local repository is up to date:',
        SYNC_COMMAND: 'prompt-library-cli sync'
    }
};
