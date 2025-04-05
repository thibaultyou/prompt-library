/**
 * Standardized constants representing common CRUD (Create, Read, Update, Delete)
 * and other operations used throughout the application, particularly in commands
 * and services. Using constants improves consistency and reduces magic strings.
 */
export const OPERATION_TYPES = {
    /** Represents a create operation. */
    CREATE: 'create',
    /** Represents a read or view operation. */
    READ: 'read',
    /** Represents an update or edit operation. */
    UPDATE: 'update',
    /** Represents a delete or remove operation. */
    DELETE: 'delete',
    /** Represents a list or browse operation. */
    LIST: 'list',
    /** Represents a search operation. */
    SEARCH: 'search',
    /** Represents an execution operation (e.g., running a prompt). */
    EXECUTE: 'execute',
    /** Represents a synchronization operation. */
    SYNC: 'sync',
    /** Represents a setup or initialization operation. */
    SETUP: 'setup',
    /** Represents a configuration operation. */
    CONFIG: 'config',
    /** Represents a reset operation. */
    RESET: 'reset',
    /** Represents a push operation (e.g., to Git). */
    PUSH: 'push',
    /** Represents adding an item to a collection (e.g., favorites). */
    ADD: 'add',
    /** Represents removing an item from a collection. */
    REMOVE: 'remove',
    /** Represents viewing details of an item. */
    VIEW: 'view',
    /** Represents an inspection operation (viewing structure without execution). */
    INSPECT: 'inspect',
    /** Represents a refresh operation (e.g., metadata). */
    REFRESH: 'refresh'
};
