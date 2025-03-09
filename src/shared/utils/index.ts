/**
 * Centralized re-export for shared utility functions.
 * This index focuses on utilities that are truly shared across different layers
 * or are needed very early in the application lifecycle (like context detection).
 *
 * Utilities specific to certain layers (e.g., infrastructure formatting, core business logic)
 * should reside within those layers.
 */

// Utility for determining application context (package vs. dev mode) and base directory.
export * from './context';
