import {resolveConfig} from '@/lib/config/resolve';

import {
  AppConfigInput,
  ModelConfig,
  ResolvedAppConfig,
} from '@/interfaces/config';

export const authModels: Record<string, ModelConfig> = {
  users: {
    fields: {
      id: {type: 'integer', primaryKey: true},
      email: {type: 'string', nullable: true},
      password: {type: 'string', nullable: true},
      provider: {type: 'string'},
      provider_id: {type: 'string'},
      display_name: {type: 'string'},
      is_active: {type: 'boolean'},
    },
  },
};

export const upAuthProvider = {
  type: 'up-auth' as const,
  config: {
    fields: {
      emailField: 'email',
      passwordField: 'password',
      isVerifiedField: 'is_active',
    },
  },
};

export const oidcProvider = {
  type: 'sso' as const,
  name: 'google',
  protocol: 'oidc' as const,
  config: {
    fields: {providerIdField: 'provider_id'},
    issuerUrl: 'https://accounts.google.com',
    clientId: 'client-id',
    clientSecret: 'client-secret',
  },
};

export const oauth2Provider = {
  type: 'sso' as const,
  name: 'github',
  protocol: 'oauth2' as const,
  config: {
    fields: {providerIdField: 'provider_id'},
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    scopes: ['read:user'],
  },
};

export const samlProvider = {
  type: 'sso' as const,
  name: 'corp',
  protocol: 'saml' as const,
  config: {
    fields: {providerIdField: 'provider_id'},
    entryPoint: 'https://idp.example.com/saml',
    issuer: 'ross',
    cert: 'certificate',
  },
};

export const upAuthAuthentication = {
  enabled: true as const,
  jwtSecret: 'a-very-long-secret-used-for-testing-purposes',
  userModel: {
    modelName: 'users',
    idField: 'id',
    providerField: 'provider',
  },
  providers: [upAuthProvider],
};

export function buildResolvedConfig(
  authentication: AppConfigInput['authentication'],
  overrides: Partial<AppConfigInput> = {},
): ResolvedAppConfig {
  return resolveConfig(
    {
      application: {name: 'Auth Test'},
      data: {models: authModels},
      authentication,
      ...overrides,
    },
    {mode: 'dev'},
  );
}

export function buildEnabledAuth(
  providers: unknown[],
  overrides: Partial<AppConfigInput> = {},
): ResolvedAppConfig {
  return buildResolvedConfig(
    {
      enabled: true,
      jwtSecret: 'a-very-long-secret-used-for-testing-purposes',
      userModel: {
        modelName: 'users',
        idField: 'id',
        providerField: 'provider',
      },
      providers: providers as never,
    },
    overrides,
  );
}
