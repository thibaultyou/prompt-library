/**
 * Main index file for the 'shared/types' directory.
 * This file organizes and re-exports all shared type definitions used across
 * the application's different layers (Domain, Application, Infrastructure).
 * Grouping types by their conceptual domain helps maintain clarity and follows
 * Domain-Driven Design principles.
 */

// --- Core Domain Types ---
// Represents the fundamental entities and value objects of the application.
export * from './domain';

// --- Command & Operation Types ---
// Defines the structure of CLI commands, their options, and actions.
export * from './commands';

// --- Service Interface Types ---
// Defines interfaces for services, particularly command interfaces used for decoupling.
export * from './services';

// --- API Result Types ---
// Standardized structure for returning results from operations (success/failure).
export * from './api';

// --- Error Types ---
// Defines custom error structures used within the application.
export * from './errors';

// --- UI-Related Types ---
// Defines types specific to the user interface components and interactions.
export * from './ui';

// --- Infrastructure Types ---
// Defines types related to the underlying infrastructure, such as file systems and repositories.
export * from './infrastructure';
