/**
 * Constants defining standard UI sections and their associated icons.
 * Used for creating consistent headers and organizing menu items.
 */
import { UI_ICONS } from './formatting';

/**
 * Configuration for main application areas and detail views.
 * Each section has a TITLE (display text) and an ICON (emoji).
 */
export const SECTIONS = {
    /** Sections for the main application menu or top-level navigation. */
    MAIN: {
        /** Section for managing the prompt/fragment library content. */
        LIBRARY: {
            TITLE: 'LIBRARY',
            ICON: UI_ICONS.REPOSITORY // Using repository icon for library
        },
        /** Section for application configuration (CLI settings, model settings). */
        CONFIGURATION: {
            TITLE: 'CONFIGURATION',
            ICON: UI_ICONS.SETTINGS
        },
        /** Section specifically for managing the Git repository. */
        REPOSITORY: {
            TITLE: 'REPOSITORY',
            ICON: UI_ICONS.REPOSITORY
        },
        /** Section for frequently used actions. */
        QUICK_ACTIONS: {
            TITLE: 'QUICK ACTIONS',
            ICON: UI_ICONS.INFO // Using info icon for quick actions
        },
        /** General section for management tasks. */
        MANAGE: {
            TITLE: 'MANAGE',
            ICON: UI_ICONS.CONFIG // Using config icon for general management
        }
    },

    /** Sections used within specific detail views or sub-menus. */
    DETAILS: {
        /** Section for displaying details of a single prompt. */
        PROMPT: {
            TITLE: 'Prompt Details',
            ICON: UI_ICONS.PROMPT // Using prompt icon
        },
        /** Section for displaying details of a single fragment. */
        FRAGMENT: {
            TITLE: 'Fragment Details',
            ICON: UI_ICONS.FRAGMENT // Using fragment icon
        },
        /** Section for managing environment variables. */
        VARIABLES: {
            TITLE: 'Environment Variables',
            ICON: UI_ICONS.ENV // Using env icon
        },
        /** Section for viewing recent prompt executions. */
        EXECUTIONS: {
            TITLE: 'Recent Executions',
            ICON: '⏱️'
        },
        /** Section for viewing favorite prompts. */
        FAVORITES: {
            TITLE: 'Favorites',
            ICON: '⭐'
        },
        /** Section for displaying search results. */
        SEARCH: {
            TITLE: 'Search Results',
            ICON: UI_ICONS.SEARCH
        },
        /** Section for AI model configuration. */
        MODEL: {
            TITLE: 'AI Model Settings',
            ICON: UI_ICONS.MODEL
        },
        /** Section for general CLI configuration. */
        CONFIG: {
            TITLE: 'CLI Configuration',
            ICON: UI_ICONS.CONFIG
        },
        /** Section for repository synchronization. */
        SYNC: {
            TITLE: 'Repository Sync',
            ICON: UI_ICONS.SYNC
        },
        /** Section for initial application setup. */
        SETUP: {
            TITLE: 'Application Setup',
            ICON: UI_ICONS.SETTINGS
        }
    }
};
