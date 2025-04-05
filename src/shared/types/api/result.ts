/**
 * Defines a standardized structure for the result of operations, particularly those
 * that might fail or return data (like API calls, service methods, etc.).
 * Promotes consistent handling of success/failure states and error messages.
 */

/**
 * Represents the outcome of an operation.
 *
 * @template T - The type of the data returned on success. Defaults to `void` if no data is expected.
 */
export interface ApiResult<T = void> {
    /** Indicates whether the operation completed successfully. */
    success: boolean;

    /**
     * The data returned by the operation if it was successful.
     * Will be `undefined` if `success` is `false` or if the operation returns `void`.
     */
    data?: T;

    /**
     * An error message describing the failure if the operation was unsuccessful.
     * Will be `undefined` if `success` is `true`.
     */
    error?: string;

    /**
     * Optional metadata providing additional context about the result,
     * especially useful for complex operations or error reporting.
     */
    meta?: Record<string, unknown>;
}

/**
 * Utility class for creating standardized `ApiResult` objects.
 * Provides static methods for easily constructing success and failure results.
 */
export class Result {
    /**
     * Creates a successful `ApiResult` object.
     *
     * @template T - The type of the data.
     * @param {T} data - The data payload for the successful result.
     * @param {Record<string, unknown>} [meta] - Optional metadata.
     * @returns {ApiResult<T>} A successful ApiResult object.
     */
    static success<T>(data: T, meta?: Record<string, unknown>): ApiResult<T> {
        return { success: true, data, meta };
    }

    /**
     * Creates a failure `ApiResult` object.
     *
     * @template T - The expected data type (will be undefined in failure case). Defaults to `void`.
     * @param {string} error - The error message describing the failure.
     * @param {Record<string, unknown>} [meta] - Optional metadata providing context about the error.
     * @returns {ApiResult<T>} A failure ApiResult object.
     */
    static failure<T = void>(error: string, meta?: Record<string, unknown>): ApiResult<T> {
        return { success: false, error, meta };
    }

    /**
     * Transforms the data of a successful `ApiResult` using a mapping function.
     * If the input result is a failure, it returns the failure result unchanged.
     *
     * @template T - The original data type.
     * @template U - The target data type.
     * @param {ApiResult<T>} result - The input ApiResult.
     * @param {(data: T) => U} mapper - The function to transform the data.
     * @returns {ApiResult<U>} The transformed ApiResult or the original failure result.
     */
    static map<T, U>(result: ApiResult<T>, mapper: (data: T) => U): ApiResult<U> {
        if (!result.success || result.data === undefined) {
            // If failure or success with no data, return the original failure/structure
            return { success: false, error: result.error, meta: result.meta };
        }
        // Apply mapper to successful data
        return { success: true, data: mapper(result.data), meta: result.meta };
    }

    /**
     * Chains asynchronous operations that return `ApiResult`.
     * If the initial `result` is a failure, the chain stops and returns the failure.
     * If successful, it passes the data to the next function `fn`.
     *
     * @template T - The data type of the initial result.
     * @template U - The data type of the result from the chained function.
     * @param {ApiResult<T>} result - The result of the previous operation.
     * @param {(data: T) => Promise<ApiResult<U>>} fn - The next asynchronous function to execute if `result` is successful.
     * @returns {Promise<ApiResult<U>>} A promise resolving to the final ApiResult of the chain.
     */
    static async chain<T, U>(result: ApiResult<T>, fn: (data: T) => Promise<ApiResult<U>>): Promise<ApiResult<U>> {
        if (!result.success || result.data === undefined) {
            // If initial result failed or has no data, propagate the failure
            return { success: false, error: result.error, meta: result.meta };
        }
        // Execute the next function in the chain with the successful data
        return await fn(result.data);
    }
}
