/**
 * Types related to UI styling, defining standard style identifiers used
 * for consistent text formatting and colorization in the CLI.
 */
import { STYLE_TYPES } from '../../constants/ui/formatting'; // Import the constant object

/**
 * Defines the set of standard style types available for formatting UI text.
 * Uses string literal types derived from `STYLE_TYPES` constants for type safety.
 * These types correspond to different semantic meanings (e.g., success, error)
 * and visual styles (e.g., bold, dim).
 */
export type StyleType =
    | typeof STYLE_TYPES.INFO
    | typeof STYLE_TYPES.SUCCESS
    | typeof STYLE_TYPES.WARNING
    | typeof STYLE_TYPES.ERROR
    | typeof STYLE_TYPES.DANGER
    | typeof STYLE_TYPES.PRIMARY
    | typeof STYLE_TYPES.SECONDARY
    | typeof STYLE_TYPES.DEBUG
    | typeof STYLE_TYPES.DIM
    | typeof STYLE_TYPES.BOLD;

/**
 * Defines a subset of `StyleType` specifically intended for styling menu items or headers.
 * This can help enforce consistency in menu appearance.
 */
export type MenuStyle =
    | typeof STYLE_TYPES.SUCCESS
    | typeof STYLE_TYPES.WARNING
    | typeof STYLE_TYPES.DANGER
    | typeof STYLE_TYPES.INFO
    | typeof STYLE_TYPES.PRIMARY
    | typeof STYLE_TYPES.SECONDARY;
