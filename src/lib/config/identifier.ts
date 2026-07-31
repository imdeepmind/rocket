import {AppConfig, CustomEndpointConfig} from '@/interfaces/config';

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
