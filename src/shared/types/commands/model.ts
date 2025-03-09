/**
 * Types specific to the 'model' command, defining its actions and options
 * for configuring AI model settings.
 */
import { BaseCommandOptions } from './base-options';
import { ModelProvider } from '../../constants';
import { ModelAction } from '../ui/action-types';

/**
 * Type alias for model command actions, referencing the centralized action types.
 * Ensures consistency with UI action definitions.
 */
export type ModelCommandAction = ModelAction;

/**
 * Interface defining the command-line options accepted by the 'model' command.
 * Extends BaseCommandOptions for common flags like --json, --nonInteractive.
 */
export interface ModelCommandOptions extends BaseCommandOptions {
    /**
     * Option to set the default AI provider ('anthropic' or 'openai').
     * If provided, the command will attempt to set this provider non-interactively.
     */
    provider?: ModelProvider;

    /**
     * Option to set the specific AI model identifier to use for the current provider.
     * If provided, the command will attempt to set this model non-interactively.
     */
    model?: string;

    /**
     * Option to set the API key for the currently selected provider.
     * If provided, the command will attempt to set this key non-interactively.
     * **Note:** Providing API keys directly on the command line can be insecure.
     */
    apiKey?: string;
}
