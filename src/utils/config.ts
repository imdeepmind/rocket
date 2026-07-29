import {AppConfig, CustomEndpointConfig} from '@/interfaces/config';

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

export function getVariantSegment(config: AppConfig): string {
  return `.${config.application.dangerouslyOverrideDefaultVariant ?? 'v1'}`;
}

export function getAPIFromUniqueIdentifier(
  config: AppConfig,
  identifier: string,
): CustomEndpointConfig | null {
  const parts = identifier.split('.');

  if (parts[0] === 'custom') {
    if (parts.length === 5) {
      return config?.customEndpoints?.[parts[4]] ?? null;
    }
  }

  return null;
}

/**
 * Parse an API identifier and extract its components.
 * Format: <module>.<variant>.<model>.<field>.<operation>
 * Example: "aggregate.v1.users.id.getAggregation"
 * @param identifier The API identifier string to parse
 * @returns Object with module, variant, model, field, operation or null if invalid format
 */
export function parseApiIdentifier(identifier: string): {
  module: string;
  variant: string;
  model: string;
  field: string;
  operation: string;
} | null {
  const parts = identifier.split('.');
  if (parts.length !== 5) return null;

  return {
    module: parts[0],
    variant: parts[1],
    model: parts[2],
    field: parts[3],
    operation: parts[4],
  };
}

/**
 * Get additional variants for a given API identifier.
 * Looks up config.apiVariants and returns array of variant names.
 * @param config The application configuration
 * @param baseIdentifier The base identifier (with 'default' as variant placeholder)
 * @returns Array of additional variant names, empty array if none found
 */
export function getAdditionalVariants(
  config: AppConfig,
  baseIdentifier: string,
): string[] {
  const variantEntry = config.apiVariants?.[baseIdentifier];
  return variantEntry?.variants ?? [];
}

/**
 * Build an API identifier string with specific variant.
 * Example: buildApiIdentifier('aggregate', 'admin', 'users', 'id', 'getAggregation')
 * Returns: "aggregate.admin.users.id.getAggregation"
 * @param module The module name (e.g., 'aggregate', 'model', 'auth')
 * @param variant The variant name (e.g., 'v1', 'admin')
 * @param model The model name (e.g., 'users', 'posts')
 * @param field The field name (e.g., 'id', 'email') or 'unknown' or 'all'
 * @param operation The operation name (e.g., 'getAggregation', 'search')
 * @returns The constructed API identifier string
 */
export function buildApiIdentifier(
  module: string,
  variant: string,
  model: string,
  field: string,
  operation: string,
): string {
  return `${module}.${variant}.${model}.${field}.${operation}`;
}
