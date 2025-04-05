/**
 * UI constants specific to the 'sync' command.
 * Defines text, descriptions, options, and structure for the repository synchronization interface.
 */
import { UI_ICONS } from './formatting';

export const SYNC_UI = {
    /**
     * Titles and icons for different sections within the 'sync' command's UI.
     */
    SECTION_HEADER: {
        /** Main title for the sync section. */
        TITLE: 'Repository Synchronization',
        /** Default icon for sync sections. */
        ICON: UI_ICONS.SYNC, // Use standard icon
        /** Title for the view showing pending local changes. */
        PENDING_CHANGES: 'Pending Local Changes',
        /** Title for the section allowing reset of local changes. */
        RESET_CHANGES: 'Reset Local Changes',
        /** Title for the section handling pushing changes to remote. */
        PUSH_CHANGES: 'Push Changes to Remote'
    },

    /**
     * Text and structure for interactive menus within the 'sync' command.
     */
    MENU: {
        /** Default prompt message for the main sync action menu. */
        PROMPT: 'Select a sync action:',
        /** Labels for the different actions available in the sync menu. */
        OPTIONS: {
            /** Menu item to push local changes to the remote repository. */
            PUSH_CHANGES: 'Push local changes to remote',
            /** Menu item to reset (discard) local changes. */
            RESET_CHANGES: 'Reset/Discard local changes',
            /** Standard 'Go back' menu item. */
            GO_BACK: 'Go back',
            /** Menu item option to reset all pending changes. */
            RESET_ALL: 'Reset ALL changes',
            /** Menu item option to select specific changes to reset. */
            SELECT_SPECIFIC: 'Select specific changes to reset',
            /** Menu item option to cancel the reset operation. */
            CANCEL_RESET: 'Cancel reset operation',
            /** Menu item to view detailed diff before pushing. */
            VIEW_DIFF: 'View detailed changes (diff)'
        },
        /** Prompt asking how to proceed with resetting changes. */
        RESET_PROMPT: 'How would you like to reset changes?',
        /** Prompt for selecting specific changes to reset. */
        SELECT_RESET_ITEMS: 'Select changes to reset (use spacebar):'
    },

    /**
     * Labels for different sections when displaying changes.
     */
    SECTIONS: {
        /** Header for listing prompt changes to be reset. */
        PROMPT_CHANGES: 'Prompt changes to reset:',
        /** Header for listing fragment changes to be reset. */
        FRAGMENT_CHANGES: 'Fragment changes to reset:',
        /** Header for displaying detailed diff output. */
        DETAILED_CHANGES: 'Detailed Changes (Diff):'
    },

    /**
     * Standard labels used in the sync UI.
     */
    LABELS: {
        /** Label for the target Git branch. */
        BRANCH: 'Branch:',
        /** Label for the commit message input/display. */
        COMMIT_MESSAGE: 'Commit Message:',
        /** Header for the commit message section. */
        COMMIT_MESSAGE_HEADER: 'Commit Message',
        /** Label indicating the total number of changes. Uses {0} for count. */
        TOTAL_CHANGES: 'Total: {0} change(s)'
    },

    /**
     * Standard action identifiers used internally for 'sync' command operations.
     */
    ACTIONS: {
        /** Action identifier for pushing changes. */
        PUSH: 'push' as const,
        /** Action identifier for resetting changes. */
        RESET: 'reset' as const,
        /** Standard action identifier for going back. */
        BACK: 'back' as const,
        /** Action identifier for resetting all changes. */
        ALL: 'all' as const,
        /** Action identifier for selecting specific changes. */
        SELECT: 'select' as const,
        /** Action identifier for cancelling an operation. */
        CANCEL: 'cancel' as const,
        /** Action identifier for listing changes. */
        LIST: 'list' as const,
        /** Action identifier for viewing diff. */
        DIFF: 'diff' as const
    },

    /**
     * Status messages displayed during sync operations.
     */
    SPINNER: {
        /** Generic processing message. */
        PROCESSING: 'Processing sync operations...',
        /** Message shown while generating diff. */
        DIFF: 'Generating diff...',
        /** Message shown while committing and pushing. */
        COMMIT: 'Committing and pushing changes...',
        /** Message shown while resetting changes. */
        RESET: 'Resetting local changes...',
        /** Message shown while fetching from remote. */
        FETCHING: 'Fetching from remote repository...',
        /** Message shown while pulling changes. */
        PULLING: 'Pulling changes from remote...',
        /** Message shown while checking for local changes. */
        CHECKING_LOCAL: 'Checking for local changes...',
        /** Message shown while checking for remote changes. */
        CHECKING_REMOTE: 'Checking for remote changes...'
    },

    /**
     * Display text for different types of change operations.
     */
    OPERATION_TYPES: {
        /** Text for added files/items. */
        ADD: 'Add',
        /** Text for modified files/items. */
        MODIFY: 'Modify',
        /** Text for deleted files/items. */
        DELETE: 'Delete',
        /** Text for restoring deleted/modified files. */
        RESTORE: 'Restore',
        /** Generic text for updated items. */
        UPDATE: 'Update'
    },

    /**
     * Default commit message template function. Uses {0} for timestamp.
     * @param timestamp - ISO timestamp string.
     * @returns Default commit message string.
     */
    DEFAULT_COMMIT_MESSAGE: (timestamp: string): string => `Update prompts and fragments [${timestamp}] via CLI`
};
