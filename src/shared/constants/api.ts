/**
 * Constants related to API communication, including timeouts, status codes,
 * endpoints, response formats, and retry configurations.
 */

/**
 * Standard API request timeout values in milliseconds.
 * Used to prevent requests from hanging indefinitely.
 */
export const API_TIMEOUT = {
    /** Default timeout for standard requests (30 seconds). */
    DEFAULT: 30000,
    /** Extended timeout for potentially longer operations (1 minute). */
    EXTENDED: 60000,
    /** Long timeout for operations expected to take significant time (2 minutes). */
    LONG: 120000
};

/**
 * Common HTTP status codes used for interpreting API responses.
 */
export const HTTP_STATUS = {
    // Success Codes (2xx)
    /** Request succeeded. */
    OK: 200,
    /** Request succeeded and a new resource was created. */
    CREATED: 201,
    /** Request succeeded, but there is no content to return. */
    NO_CONTENT: 204,

    // Client Error Codes (4xx)
    /** Server could not understand the request due to invalid syntax. */
    BAD_REQUEST: 400,
    /** Authentication is required and has failed or has not yet been provided. */
    UNAUTHORIZED: 401,
    /** Client does not have access rights to the content. */
    FORBIDDEN: 403,
    /** Server cannot find the requested resource. */
    NOT_FOUND: 404,
    /** Request method is known by the server but is not supported by the target resource. */
    METHOD_NOT_ALLOWED: 405,
    /** Request timed out. */
    REQUEST_TIMEOUT: 408,
    /** Too many requests hit the API too quickly. */
    TOO_MANY_REQUESTS: 429,

    // Server Error Codes (5xx)
    /** Server encountered an unexpected condition that prevented it from fulfilling the request. */
    INTERNAL_SERVER_ERROR: 500, // Renamed for clarity
    /** Server is not ready to handle the request (e.g., maintenance or overloaded). */
    SERVICE_UNAVAILABLE: 503,
    /** Server, acting as a gateway, did not get a timely response from the upstream server. */
    GATEWAY_TIMEOUT: 504
};

/**
 * Base URLs for the supported AI service providers.
 */
export const API_ENDPOINTS = {
    /** Base URL for the Anthropic API. */
    ANTHROPIC: 'https://api.anthropic.com',
    /** Base URL for the OpenAI API. */
    OPENAI: 'https://api.openai.com'
};

/**
 * Standard response format identifiers.
 */
export const RESPONSE_FORMAT = {
    /** JSON format identifier. */
    JSON: 'json',
    /** Plain text format identifier. */
    TEXT: 'text'
};

/**
 * Configuration for automatic retries on failed API requests.
 */
export const RETRY_CONFIG = {
    /** Maximum number of retry attempts for a failed request. */
    MAX_ATTEMPTS: 3,
    /** Initial delay in milliseconds before the first retry. */
    DELAY_MS: 1000, // 1 second
    /** Multiplier for exponential backoff (e.g., 1000ms, 2000ms, 4000ms). */
    BACKOFF_MULTIPLIER: 2,
    /** Randomization factor to add jitter to retry delays (0 to 1). */
    JITTER: 0.3 // Adds +/- 30% randomness to delay
};
