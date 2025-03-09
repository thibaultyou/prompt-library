/**
 * Constants related to timing, delays, and timeouts used in the application.
 */

/**
 * Standard delays for User Interface (UI) elements in milliseconds.
 * Used to provide visual feedback pauses or control animation speeds.
 */
export const UI_DELAY = {
    /** Very short delay, often for quick visual feedback (0.5 seconds). */
    SHORT: 500,
    /** Standard delay for noticeable pauses or transitions (1 second). */
    MEDIUM: 1000,
    /** Longer delay for more significant pauses or showing messages (2 seconds). */
    LONG: 2000,
    /** Very long delay, typically used only when necessary (5 seconds). */
    VERY_LONG: 5000
};

/**
 * Standard timeouts for various types of operations in milliseconds.
 * Used to prevent operations from hanging indefinitely.
 */
export const OPERATION_TIMEOUT = {
    /** Timeout for typical database queries (5 seconds). */
    DATABASE: 5000,
    /** Timeout for filesystem operations (10 seconds). */
    FILE_SYSTEM: 10000,
    /** Timeout for network requests (e.g., Git operations, API calls) (30 seconds). */
    NETWORK: 30000,
    /** Timeout specifically for AI model inference requests (1 minute). */
    MODEL: 60000,
    /** Extended timeout for potentially very long operations (2 minutes). */
    EXTENDED: 120000
};

/**
 * Standard intervals for UI animations in milliseconds.
 */
export const ANIMATION_INTERVAL = {
    /** Interval for updating spinner animations (100ms). */
    PROGRESS: 100,
    /** Interval for simulating typing effects (50ms). */
    TYPING: 50,
    /** Duration for fade-in/fade-out effects (200ms). */
    FADE: 200
};
