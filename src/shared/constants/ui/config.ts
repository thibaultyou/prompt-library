/**
 * UI constants specific to the 'config' command.
 * Defines text, descriptions, options, and structure for the configuration management interface.
 */
import { STYLE_TYPES } from './formatting'; // Import standard style types

export const CONFIG_UI = {
    /**
     * Descriptions used in command help text.
     */
    DESCRIPTIONS: {
        /** Description for the main 'config' command. */
        COMMAND: 'View and manage CLI configuration settings.'
    },

    /**
     * Descriptions for command-line options specific to the 'config' command.
     */
    OPTIONS: {
        /** Description for the --key option. */
        KEY_OPTION: 'Specify the configuration key to view or set.',
        /** Description for the --value option. */
        VALUE_OPTION: 'Provide the value to set for the specified key.',
        /** Description for the --reset option. */
        RESET_OPTION: 'Reset all configuration settings to their default values.',
        /** Description for the --flush option (delegated to flush command). */
        FLUSH_OPTION: 'Flush all application data (prompts, fragments, history). Preserves configuration.',
        /** Description for the --nonInteractive option. */
        NON_INTERACTIVE: 'Run command without interactive prompts (requires necessary options).',
        /** Description for the --json option. */
        JSON_FORMAT: 'Output configuration data in JSON format (useful for scripting).'
    },

    /**
     * Help messages providing guidance on command usage, especially for errors.
     */
    HELP: {
        /** Error message shown in non-JSON mode when required options are missing. */
        MISSING_OPTIONS:
            'Required options missing. Use --key <key> to view, --key <key> --value <value> to set, --reset, or --flush.',
        /** Error message shown in JSON mode when required options are missing. */
        MISSING_OPTIONS_JSON: 'Required options missing for non-interactive mode.'
    },

    /**
     * Titles and icons for different sections within the config command's UI.
     */
    SECTION_HEADER: {
        /** Main title for the configuration management section. */
        TITLE: 'CLI Configuration',
        /** Default icon for configuration sections. */
        ICON: '🔧',
        /** Title for the view displaying current configuration. */
        VIEW: 'Current Configuration',
        /** Icon for the configuration view section. */
        VIEW_ICON: '📋',
        /** Title for the section allowing configuration editing. */
        EDIT: 'Edit Configuration',
        /** Icon for the configuration editing section. */
        EDIT_ICON: '✏️'
    },

    /**
     * Text and structure for interactive menus within the config command.
     */
    MENU: {
        /** Default prompt message for the main config action menu. */
        PROMPT: 'Select a configuration action:',
        /** Labels for the different actions available in the config menu. */
        OPTIONS: {
            /** Menu item to view the current configuration. */
            VIEW: 'View current configuration',
            /** Menu item to set or update a specific configuration value. */
            SET: 'Set a configuration value',
            /** Menu item to initiate the data flush process (delegated). */
            FLUSH: 'Flush application data',
            /** Menu item to reset configuration to defaults. */
            RESET: 'Reset configuration to defaults',
            /** Menu item to export the current configuration (future feature). */
            EXPORT: 'Export configuration',
            /** Menu item to import configuration from a file (future feature). */
            IMPORT: 'Import configuration'
        }
    },

    /**
     * Standard action identifiers used internally to represent config command actions.
     * Using constants improves code clarity and reduces errors from typos.
     */
    ACTIONS: {
        /** Action identifier for viewing configuration. */
        VIEW: 'view' as const,
        /** Action identifier for setting a configuration value. */
        SET: 'set' as const,
        /** Action identifier for flushing data. */
        FLUSH: 'flush' as const,
        /** Action identifier for resetting configuration. */
        RESET: 'reset' as const,
        /** Action identifier for exporting configuration. */
        EXPORT: 'export' as const,
        /** Action identifier for importing configuration. */
        IMPORT: 'import' as const,
        /** Standard action identifier for going back in menus. */
        BACK: 'back' as const
    },

    /**
     * Mapping of configuration actions to standard UI style types for consistent formatting.
     */
    STYLES: {
        /** Style for the potentially destructive 'flush' action. */
        FLUSH: STYLE_TYPES.DANGER,
        /** Style for the potentially destructive 'reset' action. */
        RESET: STYLE_TYPES.DANGER,
        /** Style for the informational 'view' action. */
        VIEW: STYLE_TYPES.INFO,
        /** Style for the primary 'set' action. */
        SET: STYLE_TYPES.PRIMARY,
        /** Style for the 'export' action. */
        EXPORT: STYLE_TYPES.SUCCESS,
        /** Style for the 'import' action. */
        IMPORT: STYLE_TYPES.WARNING
    },

    /**
     * Standard labels used in the configuration UI for keys, values, etc.
     */
    LABELS: {
        /** Label for displaying a configuration key. */
        KEY: 'Key:',
        /** Label for displaying a configuration value. */
        VALUE: 'Value:',
        /** Label indicating the path to the configuration file. */
        CONFIG_FILE: 'Config File:',
        /** Label for specifying the export file path. */
        EXPORT_PATH: 'Export Path:',
        /** Label for specifying the import file path. */
        IMPORT_PATH: 'Import Path:'
    }
};
