/**
 * Types related to formatting and displaying data in tables within the CLI.
 */

/**
 * Defines the configuration for a single column within a table.
 *
 * @template T - The type of the data items being displayed in the table rows. Defaults to a generic record.
 */
export interface TableColumn<T = Record<string, any>> {
    /** The text displayed in the header row for this column. */
    header: string;

    /**
     * The key (property name) in the data object (`T`) that holds the value for this column.
     * Can use dot notation for nested properties (e.g., 'author.name') if supported by the renderer.
     */
    key: string; // Changed from keyof T to string to allow flexibility, e.g., derived values

    /**
     * Optional desired width for the column in characters. If not provided, width might be calculated automatically.
     * Can also be a string percentage (e.g., '50%') if supported by the renderer.
     */
    width?: number | string;

    /** Text alignment within the column ('left', 'right', or 'center'). Defaults to 'left'. */
    align?: 'left' | 'right' | 'center';

    /**
     * An optional function to format the raw cell value before display.
     * Receives the cell value and the entire data item for the row as arguments.
     * Should return the formatted string representation.
     */
    formatter?: (value: any, item: T) => string; // value is any to allow flexibility
}

/**
 * Represents the result of a table formatting operation. Contains the formatted strings
 * needed to render the table, along with metadata about the formatting.
 *
 * @template T - The type of the original data items used to generate the table rows. Defaults to a generic record.
 */
export interface TableFormatResult<T = Record<string, any>> {
    /** The fully formatted header row as a single string. */
    headers: string;

    /** The formatted separator line (e.g., '----') as a string. */
    separator: string;

    /** An array where each element is a fully formatted data row as a single string. */
    rows: string[];

    /** A record mapping column keys to their calculated maximum content width (used for padding). */
    maxLengths: Record<string, number>;

    /**
     * An array containing the original data items, preserving the order in which they appear
     * in the `rows` array (after potential sorting). This allows mapping selected rows back to data items.
     */
    itemsMap: T[];
}

/**
 * Defines options for controlling the formatting and behavior of table rendering.
 */
export interface TableFormatOptions {
    /** If true, includes a column showing the directory associated with the item (e.g., for prompts). */
    showDirectory?: boolean;

    /** If true, sorts the table rows primarily by the item's ID. */
    sortById?: boolean;

    /** An optional category name to visually highlight rows belonging to this category. */
    highlightCategory?: string | null;

    /** The target maximum width for the entire table in characters. */
    tableWidth?: number;

    /** If true, includes a column for the item's description. */
    showDescription?: boolean;

    /** If true, includes the header row in the output (defaults to true). */
    includeHeaders?: boolean; // Added option

    /** An optional custom sorting function to apply to the data items before formatting rows. */
    sort?: <T>(a: T, b: T) => number;

    /** If true, disables the default sorting behavior and maintains the original order of items. */
    preserveOrder?: boolean;
}
