/**
 * Recursively resolves environment variables in the configuration object.
 * If a string starts with 'env:', it's replaced with the value of the environment variable.
 * This function modifies the object in-place.
 * @param config The configuration object to resolve.
 * @returns The configuration object with environment variables resolved.
 */
export function resolveEnvVars<T>(config: T): T {
  if (typeof config === 'string') {
    if (config.startsWith('env:')) {
      const envVarName = config.substring(4);
      return (process.env[envVarName] || config) as unknown as T;
    }
    return config;
  }

  if (Array.isArray(config)) {
    for (let i = 0; i < config.length; i++) {
      config[i] = resolveEnvVars(config[i]);
    }
    return config;
  }

  if (config !== null && typeof config === 'object') {
    const obj = config as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      obj[key] = resolveEnvVars(obj[key]);
    }
    return config;
  }

  return config;
}
