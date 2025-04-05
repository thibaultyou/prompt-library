/**
 * Centralized re-export for all core domain types.
 * This organizes the fundamental entities and value objects of the application.
 */

export * from './category'; // Types related to prompt categories (CategoryItem)
export * from './conversation'; // Types for AI conversations (ConversationMessage, ConversationManager)
export * from './env'; // Types for environment variables (EnvVariable, EnvVariableInfo, etc.)
export * from './fragment'; // Types for prompt fragments (PromptFragment, Fragment)
export * from './prompt'; // Types for prompts (PromptVariable, PromptMetadata, SimplePromptMetadata)
