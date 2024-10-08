/**
 * Represents the metadata for an AI prompt.
 */
export interface Metadata {
    /** The title of the prompt */
    title: string;
    /** The primary category of the prompt */
    primary_category: string;
    /** An array of subcategories for the prompt */
    subcategories: string[];
    /** The directory name for the prompt */
    directory: string;
    /** An array of tags associated with the prompt */
    tags: string[];
    /** A one-line description of the prompt */
    one_line_description: string;
    /** A detailed description of the prompt */
    description: string;
    /** An array of variables used in the prompt */
    variables: Array<{
        name: string;
        role: string;
    }>;
    /** The content hash of the prompt file */
    content_hash?: string;
}
