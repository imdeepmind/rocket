import {buildApiIdentifier} from '@/lib/config/identifier';

import {
  AppConfig,
  ResolvedAppConfig,
  UpAuthProviderConfig,
} from '@/interfaces/config';

/**
 * Enumerate every API identifier that the route registration layer can
 * generate for a resolved configuration.
 *
 * This is deliberately structural: identifiers are included even when the
 * resolved policy disables them (`apis.<id>.enabled === false`), because an
 * `apis` override may legitimately reference and re-enable a gated route.
 * Variant identifiers are derived from `apiVariants` entries keyed by the
 * default-variant identifier.
 */
export function getGeneratedApiIdentifiers(
  config: AppConfig | ResolvedAppConfig,
): Set<string> {
  const identifiers = new Set<string>();
  // Compatibility: `validateConfig` also accepts sparse input shapes, where
  // the variant may not have been resolved yet.
  const defaultVariant =
    config.application.dangerouslyOverrideDefaultVariant ?? 'v1';

  const addTargets = (
    module: string,
    model: string,
    field: string,
    operation: string,
  ): void => {
    const defaultIdentifier = buildApiIdentifier(
      module,
      defaultVariant,
      model,
      field,
      operation,
    );
    const variants = [
      defaultVariant,
      ...(config.apiVariants?.[defaultIdentifier]?.variants ?? []),
    ];

    for (const variant of new Set(variants)) {
      identifiers.add(
        buildApiIdentifier(module, variant, model, field, operation),
      );
    }
  };

  for (const [modelName, model] of Object.entries(config.data.models)) {
    addTargets('model', modelName, 'unknown', 'insert');
    addTargets('model', modelName, 'unknown', 'getAll');

    for (const [fieldName, field] of Object.entries(model.fields)) {
      const fieldApis = field.apis ?? [];

      if (field.primaryKey || field.unique || fieldApis.includes('index')) {
        addTargets('model', modelName, fieldName, 'index');
      }
      if (fieldApis.includes('search')) {
        addTargets('model', modelName, fieldName, 'search');
      }
      if (fieldApis.includes('edit')) {
        addTargets('model', modelName, fieldName, 'edit');
      }
      if (fieldApis.includes('delete')) {
        addTargets('model', modelName, fieldName, 'delete');
      }
      if ((field.aggregations ?? []).length > 0) {
        addTargets('aggregate', modelName, fieldName, 'getAggregation');
      }
    }
  }

  for (const name of Object.keys(config.customEndpoints ?? {})) {
    addTargets('custom', 'all', 'unknown', name);
  }

  const authentication = config.authentication;

  if (authentication?.enabled && authentication.provider?.type === 'up-auth') {
    const upConfig = authentication.provider.config as UpAuthProviderConfig;
    const authModel = upConfig.userModel?.model;

    if (!authModel) return identifiers;

    const operations = [
      'registration',
      'login',
      'changePassword',
      'me',
      'deleteMe',
      'editMe',
    ];

    if (config.integrations?.email) {
      operations.push(
        'forgotPassword',
        'otpVerifyForgotPassword',
        'resendOtpForgotPassword',
      );
    }

    if (upConfig.mfaRequired) {
      operations.push('otpVerifyLogin', 'resendOtpLogin');
    }

    if (upConfig.userModel.isVerifiedField) {
      operations.push('otpVerifyRegister', 'resendOtpRegister', 'emailChange');
    }

    for (const operation of operations) {
      addTargets('auth', authModel, 'unknown', operation);
    }
  }

  return identifiers;
}

/**
 * Whether an `apis` override key refers to a route the router can generate.
 */
export function isGeneratedApiIdentifier(
  config: AppConfig | ResolvedAppConfig,
  identifier: string,
): boolean {
  return getGeneratedApiIdentifiers(config).has(identifier);
}
