/**
 * Represents a fragment used in an AI prompt.
 */
export interface Fragment {
    /** The name of the fragment */
    name: string;
    /** The category of the fragment */
    category: string;
    /** The variable where the fragment could be injected */
    variable?: string;
}
