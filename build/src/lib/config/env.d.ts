/**
 * Recursively resolves environment variables in the configuration object.
 * If a string starts with 'env:', it's replaced with the value of the
 * environment variable.
 *
 * Pure: the input is never modified; a new resolved structure is returned.
 * @param config The configuration object to resolve.
 * @returns A new configuration object with environment variables resolved.
 */
export declare function resolveEnvVars<T>(config: T): T;
