import {buildApiIdentifier, parseApiIdentifier} from '@/lib/config/identifier';
import {deriveApiTags} from '@/lib/config/tags';

import {
  Aggregation,
  QueryOperation,
  ResolvedAppConfig,
  ServerSideParamConfig,
  UpAuthProviderConfig,
  WebhookConfig,
} from '@/interfaces/config';

/**
 * Fully resolved policy for a single generated API endpoint.
 *
 * Scalar fields (`enabled`, `tags`, `authorization`, `bypassSecret`) inherit
 * from the base (default-variant) API override when the variant does not set
 * them. List fields (`webhooks`, `serverSideParams`, `supported*`) never
 * inherit.
 */
export interface ResolvedApiPolicy {
  enabled: boolean;
  tags: string[];
  authorization: boolean;
  bypassSecret: boolean;
  webhooks: WebhookConfig[];
  serverSideParams: ServerSideParamConfig[];
  supportedQueries: QueryOperation[] | undefined;
  supportedAggregations: Aggregation[] | undefined;
}

export interface ApiRouteTarget {
  identifier: string;
  variant: string;
  policy: ResolvedApiPolicy;
}

function getAuthModel(config: ResolvedAppConfig): string | null {
  const {authentication} = config;

  if (!authentication.enabled || authentication.provider.type !== 'up-auth') {
    return null;
  }

  return (authentication.provider.config as UpAuthProviderConfig).userModel
    .model;
}

/**
 * Resolve the effective policy for one API identifier.
 *
 * Rules:
 *   - explicit `enabled` wins; otherwise CRUD APIs of the auth user model are
 *     off; otherwise on
 *   - `authorization` explicit wins, else the global auth flag
 *   - `bypassSecret` explicit or `false`
 *   - `webhooks` / `serverSideParams` configured or `[]`
 *   - `supportedQueries` / `supportedAggregations` stay `undefined` when absent
 *   - scalar fields inherit base → variant
 */
export function resolveApiPolicy(
  config: ResolvedAppConfig,
  identifier: string,
): ResolvedApiPolicy {
  const parsed = parseApiIdentifier(identifier);
  const defaultVariant = config.application.dangerouslyOverrideDefaultVariant;

  const baseIdentifier = parsed
    ? buildApiIdentifier(
        parsed.module,
        defaultVariant,
        parsed.model,
        parsed.field,
        parsed.operation,
      )
    : identifier;

  const override = config.apis[identifier];
  const baseOverride = config.apis[baseIdentifier];

  const authModelDefaultOff =
    parsed?.module === 'model' && parsed.model === getAuthModel(config);

  const enabled =
    override?.enabled ?? baseOverride?.enabled ?? !authModelDefaultOff;

  return {
    enabled,
    tags: override?.tags ?? baseOverride?.tags ?? deriveApiTags(identifier),
    authorization:
      override?.authorization ??
      baseOverride?.authorization ??
      config.authentication.enabled,
    bypassSecret: override?.bypassSecret ?? baseOverride?.bypassSecret ?? false,
    webhooks: override?.webhooks ?? [],
    serverSideParams: override?.serverSideParams ?? [],
    supportedQueries: override?.supportedQueries,
    supportedAggregations: override?.supportedAggregations,
  };
}

/**
 * Enumerate the default + configured-variant route targets for an API, in
 * registration order. Targets whose policy resolves to disabled are omitted.
 */
export function getApiRouteTargets(
  config: ResolvedAppConfig,
  module: string,
  model: string,
  field: string,
  operation: string,
): ApiRouteTarget[] {
  const defaultVariant = config.application.dangerouslyOverrideDefaultVariant;
  const defaultIdentifier = buildApiIdentifier(
    module,
    defaultVariant,
    model,
    field,
    operation,
  );

  const variants = [
    defaultVariant,
    ...(config.apiVariants[defaultIdentifier]?.variants ?? []),
  ];

  const targets: ApiRouteTarget[] = [];

  for (const variant of new Set(variants)) {
    const identifier = buildApiIdentifier(
      module,
      variant,
      model,
      field,
      operation,
    );
    const policy = resolveApiPolicy(config, identifier);

    if (policy.enabled) {
      targets.push({identifier, variant, policy});
    }
  }

  return targets;
}
