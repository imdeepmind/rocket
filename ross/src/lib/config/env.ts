/**
 * Recursively resolves environment variables in the configuration object.
 * If a string starts with 'env:', it's replaced with the value of the
 * environment variable.
 *
 * Pure: the input is never modified; a new resolved structure is returned.
 * @param config The configuration object to resolve.
 * @returns A new configuration object with environment variables resolved.
 */
export function resolveEnvVars<T>(config: T): T {
  if (typeof config === 'string') {
    if (config.startsWith('env:')) {
      const envVarName = config.substring(4);
      if (envVarName === '' || envVarName.trim() === '') {
        throw new Error(
          `Config error: "${config}" has an empty environment variable name`,
        );
      }
      const value = process.env[envVarName];
      if (value === undefined) {
        throw new Error(
          `Config error: environment variable "${envVarName}" (referenced as "${config}") is not set`,
        );
      }
      return value as unknown as T;
    }
    return config;
  }

  if (Array.isArray(config)) {
    return config.map(value => resolveEnvVars(value)) as unknown as T;
  }

  if (config !== null && typeof config === 'object') {
    const obj = config as Record<string, unknown>;
    const resolved: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      resolved[key] = resolveEnvVars(obj[key]);
    }
    return resolved as unknown as T;
  }

  return config;
}
