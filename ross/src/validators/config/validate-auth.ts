import {
  AppConfig,
  AuthProviderInput,
  ModelConfig,
  ModelFieldConfig,
  ResolvedModelFieldConfig,
} from '@/interfaces/config';

type UpAuthProviderInput = Extract<AuthProviderInput, {type: 'up-auth'}>;
type SsoProviderInput = Extract<AuthProviderInput, {type: 'sso'}>;
type AnyFieldConfig = ModelFieldConfig | ResolvedModelFieldConfig;

/**
 * Provider names that would shadow static segments of the auth route tree
 * (`/auth/login`, `/auth/providers`, ...) or collide with provider types.
 */
const RESERVED_PROVIDER_NAMES = new Set([
  'api-key',
  'callback',
  'change-email',
  'change-password',
  'edit-me',
  'forgot-password',
  'login',
  'logout',
  'me',
  'metadata',
  'providers',
  'refresh',
  'register',
  'registration',
  'resend-otp',
  'sso',
  'token',
  'up-auth',
  'user',
  'verify',
]);

function assertField(
  errors: string[],
  model: ModelConfig,
  name: string | undefined,
  pointer: string,
): AnyFieldConfig | undefined {
  /* c8 ignore next - the schema guarantees required fields are present */
  if (!name) return undefined;

  const field = model.fields[name];

  if (!field) {
    errors.push(`${pointer}: field does not exist in model`);
    return undefined;
  }

  return field;
}

function assertNullable(
  errors: string[],
  model: ModelConfig,
  name: string | undefined,
  pointer: string,
  message?: string,
): void {
  /* c8 ignore next - the schema guarantees required fields are present */
  if (!name) return;

  const field = model.fields[name];
  if (!field) return;

  if (field.nullable === false && field.default === undefined) {
    errors.push(
      message ??
        `${pointer}: field must be nullable because SSO accounts do not set it`,
    );
  }
}

function validateAbsoluteUrl(
  errors: string[],
  value: string | undefined,
  pointer: string,
): URL | undefined {
  if (!value) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${pointer}: must be an absolute URL`);
    return undefined;
  }

  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (url.protocol !== 'https:' && !isLocal) {
    errors.push(
      `${pointer}: must use https (http is only allowed for localhost)`,
    );
  }

  return url;
}

function validateAuthConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  const authentication = config.authentication;

  if (!authentication || authentication.enabled !== true) {
    return errors;
  }

  const providers = authentication.providers ?? [];

  if (providers.length === 0) {
    errors.push(
      '/authentication/providers: at least one provider is required when authentication is enabled',
    );
    return errors;
  }

  const upAuthProviders = providers.filter(
    (provider): provider is UpAuthProviderInput => provider.type === 'up-auth',
  );
  const apiKeyProviders = providers.filter(
    provider => provider.type === 'api-key',
  );
  const ssoProviders = providers.filter(
    (provider): provider is SsoProviderInput => provider.type === 'sso',
  );

  if (upAuthProviders.length > 1) {
    errors.push(
      '/authentication/providers: at most one up-auth provider may be configured',
    );
  }

  if (apiKeyProviders.length > 1) {
    errors.push(
      '/authentication/providers: at most one api-key provider may be configured',
    );
  }

  if (
    apiKeyProviders.length > 0 &&
    (upAuthProviders.length > 0 || ssoProviders.length > 0)
  ) {
    errors.push(
      "/authentication/providers: 'api-key' cannot be combined with identity providers",
    );
  }

  const hasIdentityProvider =
    upAuthProviders.length > 0 || ssoProviders.length > 0;

  if (hasIdentityProvider && !authentication.jwtSecret) {
    errors.push(
      '/authentication/jwtSecret: jwtSecret is required when up-auth or sso providers are configured',
    );
  }

  if (!hasIdentityProvider && authentication.jwtSecret) {
    errors.push(
      "/authentication/jwtSecret: jwtSecret must not be provided when only 'api-key' is configured",
    );
  }

  const seenProviderNames = new Set<string>();

  for (const provider of ssoProviders) {
    const normalized = provider.name.toLowerCase();

    if (RESERVED_PROVIDER_NAMES.has(normalized)) {
      errors.push(
        `/authentication/providers: provider name '${provider.name}' is reserved`,
      );
    }

    if (seenProviderNames.has(normalized)) {
      errors.push(
        `/authentication/providers: duplicate sso provider name '${provider.name}'`,
      );
    }

    seenProviderNames.add(normalized);
  }

  // api-key has no user model: nothing further to validate.
  if (!hasIdentityProvider) {
    return errors;
  }

  const userModel = authentication.userModel;

  if (!userModel) {
    errors.push(
      '/authentication/userModel: userModel is required when up-auth or sso providers are configured',
    );
    return errors;
  }

  const targetModel = config.data.models[userModel.modelName];

  if (!targetModel) {
    errors.push('/authentication/userModel/modelName: model does not exist');
    return errors;
  }

  if (config.data.models['_ross_sessions']) {
    errors.push(
      '/data/models/_ross_sessions: model name is reserved for internal session storage',
    );
  }

  assertField(
    errors,
    targetModel,
    userModel.idField,
    '/authentication/userModel/idField',
  );

  const providerField = assertField(
    errors,
    targetModel,
    userModel.providerField,
    '/authentication/userModel/providerField',
  );

  if (providerField && providerField.type !== 'string') {
    errors.push(
      '/authentication/userModel/providerField: field must be of type string',
    );
  }

  if (ssoProviders.length > 0 && providerField?.nullable === true) {
    errors.push(
      '/authentication/userModel/providerField: field must not be nullable',
    );
  }

  const hasSso = ssoProviders.length > 0;
  const hasUpAuth = upAuthProviders.length > 0;

  for (const provider of upAuthProviders) {
    validateUpAuthProvider(errors, config, targetModel, provider, hasSso);
  }

  for (const provider of ssoProviders) {
    validateSsoProvider(
      errors,
      targetModel,
      provider,
      hasUpAuth,
      userModel.providerField,
      upAuthProviders,
    );
  }

  return errors;
}

function isFieldUnique(
  model: ModelConfig,
  fieldName: string,
  field: ModelFieldConfig,
): boolean {
  if (field.unique === true) {
    return true;
  }

  for (const index of Object.values(model.indexes ?? {})) {
    if (
      index.unique &&
      index.fields.length === 1 &&
      index.fields[0] === fieldName
    ) {
      return true;
    }
  }

  return false;
}

function validateUpAuthProvider(
  errors: string[],
  config: AppConfig,
  targetModel: ModelConfig,
  provider: UpAuthProviderInput,
  hasSso: boolean,
): void {
  const {fields} = provider.config;
  const base = '/authentication/providers/up-auth/config';

  const usernameField = assertField(
    errors,
    targetModel,
    fields.usernameField,
    `${base}/fields/usernameField`,
  );
  assertField(
    errors,
    targetModel,
    fields.passwordField,
    `${base}/fields/passwordField`,
  );

  if (usernameField && usernameField.type !== 'string') {
    errors.push(`${base}/fields/usernameField: field must be of type string`);
  }

  if (hasSso) {
    assertNullable(
      errors,
      targetModel,
      fields.usernameField,
      `${base}/fields/usernameField`,
    );
    assertNullable(
      errors,
      targetModel,
      fields.passwordField,
      `${base}/fields/passwordField`,
    );
  } else if (usernameField) {
    if (!isFieldUnique(targetModel, fields.usernameField, usernameField)) {
      errors.push(`${base}/fields/usernameField: field must be unique`);
    }
    if (usernameField.nullable !== false) {
      errors.push(
        `${base}/fields/usernameField: field must not be nullable when SSO is not configured`,
      );
    }
  }

  if (fields.isVerifiedField) {
    const verifiedField = assertField(
      errors,
      targetModel,
      fields.isVerifiedField,
      `${base}/fields/isVerifiedField`,
    );

    if (verifiedField && verifiedField.type !== 'boolean') {
      errors.push(
        `${base}/fields/isVerifiedField: field must be of type boolean`,
      );
    }

    if (!config.integrations?.email) {
      errors.push(
        `${base}/fields/isVerifiedField: integrations.email must be configured when isVerifiedField is set`,
      );
    }
  }

  if (provider.config.mfaRequired && !config.integrations?.email) {
    errors.push(
      `${base}/mfaRequired: integrations.email must be configured when mfaRequired is true`,
    );
  }
}

function validateSsoProvider(
  errors: string[],
  targetModel: ModelConfig,
  provider: SsoProviderInput,
  hasUpAuth: boolean,
  providerField: string,
  upAuthProviders: UpAuthProviderInput[] = [],
): void {
  const {config: providerConfig} = provider;
  const base = `/authentication/providers/${provider.name}/config`;

  const providerIdField = assertField(
    errors,
    targetModel,
    providerConfig.fields.providerIdField,
    `${base}/fields/providerIdField`,
  );

  if (providerIdField && providerIdField.type !== 'string') {
    errors.push(`${base}/fields/providerIdField: field must be of type string`);
  }

  if (providerConfig.fields.usernameField) {
    const ssoUsernameField = assertField(
      errors,
      targetModel,
      providerConfig.fields.usernameField,
      `${base}/fields/usernameField`,
    );

    if (ssoUsernameField && ssoUsernameField.type !== 'string') {
      errors.push(`${base}/fields/usernameField: field must be of type string`);
    }
  }

  if (hasUpAuth) {
    assertNullable(
      errors,
      targetModel,
      providerConfig.fields.providerIdField,
      `${base}/fields/providerIdField`,
      `${base}/fields/providerIdField: field must be nullable because up-auth accounts do not set it`,
    );
  }

  const mappedColumns = new Set(
    Object.values(providerConfig.attributeMapping ?? {}),
  );
  mappedColumns.add(providerConfig.fields.providerIdField);
  mappedColumns.add(providerField);
  if (providerConfig.fields.usernameField) {
    mappedColumns.add(providerConfig.fields.usernameField);
  }

  for (const [columnName, columnField] of Object.entries(targetModel.fields)) {
    if (
      columnField.primaryKey ||
      columnField.autoIncrement ||
      mappedColumns.has(columnName)
    ) {
      continue;
    }

    if (columnField.nullable === false && columnField.default === undefined) {
      const isUpAuthCredential = upAuthProviders.some(
        p =>
          p.config.fields.usernameField === columnName ||
          p.config.fields.passwordField === columnName,
      );

      if (isUpAuthCredential) {
        continue;
      }

      errors.push(
        `${base}: field '${columnName}' must be nullable or have a default because SSO accounts do not set it`,
      );
    }
  }

  for (const [claim, column] of Object.entries(
    providerConfig.attributeMapping ?? {},
  )) {
    assertField(
      errors,
      targetModel,
      column,
      `${base}/attributeMapping/${claim}`,
    );
  }

  if (providerConfig.failureRedirectUrl && !providerConfig.redirectUrl) {
    errors.push(
      `${base}/failureRedirectUrl: redirectUrl is required when failureRedirectUrl is set`,
    );
  }

  const callback = validateAbsoluteUrl(
    errors,
    providerConfig.callbackUrl,
    `${base}/callbackUrl`,
  );

  if (
    callback &&
    !callback.pathname.endsWith(`/auth/sso/${provider.name}/callback`)
  ) {
    errors.push(
      `${base}/callbackUrl: must end with /auth/sso/${provider.name}/callback`,
    );
  }

  validateAbsoluteUrl(
    errors,
    providerConfig.redirectUrl,
    `${base}/redirectUrl`,
  );
  validateAbsoluteUrl(
    errors,
    providerConfig.failureRedirectUrl,
    `${base}/failureRedirectUrl`,
  );
}

export default validateAuthConstraints;
