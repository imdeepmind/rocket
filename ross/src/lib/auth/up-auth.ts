import {
  AuthUserModelConfig,
  ResolvedAppConfig,
  ResolvedSsoProvider,
  ResolvedUpAuthProvider,
} from '@/interfaces/config';

export interface UpAuthRuntime {
  provider: ResolvedUpAuthProvider;
  model: string;
  idField: string;
  providerField: string;
  emailField: string;
  passwordField: string;
  isVerifiedField: string;
  mfaRequired: boolean;
}

/**
 * Project the resolved up-auth provider into the shape the password routes
 * need. Returns `null` when no up-auth provider is configured, which is the
 * capability check every password route performs.
 */
export function getUpAuth(config: ResolvedAppConfig): UpAuthRuntime | null {
  const {authentication} = config;

  if (!authentication.enabled) {
    return null;
  }

  const provider = authentication.providers.find(
    candidate => candidate.type === 'up-auth',
  );

  if (!provider || !authentication.userModel) {
    return null;
  }

  const {fields} = provider.config;
  const {modelName, idField, providerField} = authentication.userModel;

  return {
    provider,
    model: modelName,
    idField,
    providerField,
    emailField: fields.emailField,
    passwordField: fields.passwordField,
    isVerifiedField: fields.isVerifiedField,
    mfaRequired: provider.config.mfaRequired,
  };
}

export function getSsoProviders(
  config: ResolvedAppConfig,
): ResolvedSsoProvider[] {
  const {authentication} = config;

  if (!authentication.enabled) {
    return [];
  }

  return authentication.providers.filter(
    (provider): provider is ResolvedSsoProvider => provider.type === 'sso',
  );
}

export function getAuthModel(config: ResolvedAppConfig): string | null {
  return getActiveUserModel(config)?.modelName ?? null;
}

/**
 * The shared user-table columns, or `null` when only a static `api-key`
 * provider is configured (which has no identity table).
 */
export function getActiveUserModel(
  config: ResolvedAppConfig,
): AuthUserModelConfig | null {
  const {authentication} = config;

  if (!authentication.enabled) {
    return null;
  }

  const hasIdentityProvider = authentication.providers.some(
    provider => provider.type !== 'api-key',
  );

  if (!hasIdentityProvider) {
    return null;
  }

  // The resolver always materialises `userModel` for identity providers.
  return authentication.userModel as AuthUserModelConfig;
}
