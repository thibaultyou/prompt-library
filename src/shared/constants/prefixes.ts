/**
 * Standardized prefixes used to identify special value types within strings,
 * particularly for environment variables and fragment references.
 */

/**
 * Prefix indicating that a variable's value is a reference to a prompt fragment.
 * Example: "Fragment: category/fragment_name"
 */
export const FRAGMENT_PREFIX = 'Fragment: ';

/**
 * Prefix indicating that a variable's value is a reference to an environment variable.
 * Example: "Env: MY_API_KEY"
 */
export const ENV_PREFIX = 'Env: ';
