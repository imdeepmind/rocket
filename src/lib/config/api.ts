import {
  Aggregation,
  AppConfig,
  QueryOperation,
  UpAuthProviderConfig,
} from '@/interfaces/config';

/**
 * Get the effective query operations for an API endpoint.
 * If the API config specifies supportedQueries, they restrict which
 * query operations are available. Returns undefined if no override.
 */
export function getEffectiveQueries(
  config: AppConfig,
  apiIdentifier: string,
): QueryOperation[] | undefined {
  return config.apis?.[apiIdentifier]?.supportedQueries;
}

/**
 * Get the effective aggregations for an API endpoint.
 * If the API config specifies supportedAggregations, they override
 * the field-level aggregations. Returns undefined if no override.
 */
export function getEffectiveAggregations(
  config: AppConfig,
  apiIdentifier: string,
): Aggregation[] | undefined {
  return config.apis?.[apiIdentifier]?.supportedAggregations;
}

/**
 * Get whether the API endpoint requires authorization.
 * Falls back to the global authentication.enabled flag.
 */
export function getApiAuthorization(
  config: AppConfig,
  apiIdentifier: string,
): boolean {
  return (
    config.apis?.[apiIdentifier]?.authorization ??
    config.authentication?.enabled ??
    false
  );
}

/**
 * Get whether the API endpoint bypasses secret field protection.
 */
export function getApiBypassSecret(
  config: AppConfig,
  apiIdentifier: string,
): boolean {
  return config.apis?.[apiIdentifier]?.bypassSecret ?? false;
}

export function shouldApiBeEnabled(
  config: AppConfig,
  apiIdentifier: string,
  modelName: string,
): boolean {
  const authModel =
    config.authentication?.provider?.type === 'up-auth'
      ? (config.authentication.provider.config as UpAuthProviderConfig)
          .userModel.model
      : null;

  const apiEnabled = config.apis?.[apiIdentifier]?.enabled;

  if (apiEnabled === false) return false;

  if (modelName === authModel) return apiEnabled === true;

  return true;
}
