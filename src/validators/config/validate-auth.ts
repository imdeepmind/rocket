import {
  ApiKeyProviderConfig,
  AppConfig,
  UpAuthProviderConfig,
} from '@/interfaces/config';

function isUpAuthConfig(
  config: UpAuthProviderConfig | ApiKeyProviderConfig | undefined,
): config is UpAuthProviderConfig {
  return config !== undefined && 'userModel' in config;
}

function isApiKeyConfig(
  config: UpAuthProviderConfig | ApiKeyProviderConfig | undefined,
): config is ApiKeyProviderConfig {
  return config !== undefined && 'key' in config;
}

function validateAuthConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  const authentication = config.authentication;

  if (!authentication) {
    return errors;
  }

  const providerType = authentication.provider?.type;
  const providerConfig = authentication.provider?.config;

  if (!providerConfig) {
    errors.push('/authentication/provider/config: provider config is required');
    return errors;
  }

  if (providerType === 'api-key') {
    const apiConfig = providerConfig as ApiKeyProviderConfig;

    if (!apiConfig.key) {
      errors.push(
        '/authentication/provider/config/key: key is required when provider type is api-key',
      );
    }

    if (isUpAuthConfig(providerConfig)) {
      errors.push(
        '/authentication/provider/config/userModel: userModel should not be present when provider type is api-key',
      );
    }

    if ((providerConfig as UpAuthProviderConfig)?.jwtSecret) {
      errors.push(
        '/authentication/provider/config/jwtSecret: jwtSecret should not be present when provider type is api-key',
      );
    }
  }

  if (providerType === 'up-auth') {
    const upConfig = providerConfig as UpAuthProviderConfig;

    if (!upConfig.userModel) {
      errors.push(
        '/authentication/provider/config/userModel: userModel is required when provider type is up-auth',
      );
    }

    if (!upConfig.jwtSecret) {
      errors.push(
        '/authentication/provider/config/jwtSecret: jwtSecret is required when provider type is up-auth',
      );
    }

    if (upConfig.mfaRequired) {
      if (!config.infrastructure?.cache) {
        errors.push(
          '/authentication/provider/config/mfaRequired: cache must be configured when mfaRequired is true',
        );
      }
      if (!config.integrations?.email) {
        errors.push(
          '/authentication/provider/config/mfaRequired: integrations.email must be configured when mfaRequired is true',
        );
      }
    }

    if (upConfig.userModel?.isVerifiedField && !config.integrations?.email) {
      errors.push(
        '/authentication/provider/config/userModel/isVerifiedField: integrations.email must be configured when isVerifiedField is set',
      );
    }

    if (isApiKeyConfig(providerConfig)) {
      errors.push(
        '/authentication/provider/config/key: key should not be present when provider type is up-auth',
      );
    }

    if (upConfig.userModel) {
      const targetModel = upConfig.userModel.model
        ? config.models.find(m => m.name === upConfig.userModel.model)
        : undefined;

      if (upConfig.userModel.model && !targetModel) {
        errors.push(
          '/authentication/provider/config/userModel/model: model does not exist',
        );
      }

      if (
        upConfig.userModel.idField &&
        typeof upConfig.userModel.idField !== 'string'
      ) {
        errors.push(
          '/authentication/provider/config/userModel/idField: must be a string',
        );
      }

      if (
        upConfig.userModel.usernameField &&
        typeof upConfig.userModel.usernameField !== 'string'
      ) {
        errors.push(
          '/authentication/provider/config/userModel/usernameField: must be a string',
        );
      }

      if (
        upConfig.userModel.passwordField &&
        typeof upConfig.userModel.passwordField !== 'string'
      ) {
        errors.push(
          '/authentication/provider/config/userModel/passwordField: must be a string',
        );
      }

      if (
        upConfig.userModel.isVerifiedField &&
        typeof upConfig.userModel.isVerifiedField !== 'string'
      ) {
        errors.push(
          '/authentication/provider/config/userModel/isVerifiedField: must be a string',
        );
      }

      if (targetModel) {
        if (
          typeof upConfig.userModel.idField === 'string' &&
          !targetModel.fields.some(f => f.name === upConfig.userModel.idField)
        ) {
          errors.push(
            '/authentication/provider/config/userModel/idField: field does not exist in model',
          );
        }

        if (
          typeof upConfig.userModel.usernameField === 'string' &&
          !targetModel.fields.some(
            f => f.name === upConfig.userModel.usernameField,
          )
        ) {
          errors.push(
            '/authentication/provider/config/userModel/usernameField: field does not exist in model',
          );
        }

        if (
          typeof upConfig.userModel.passwordField === 'string' &&
          !targetModel.fields.some(
            f => f.name === upConfig.userModel.passwordField,
          )
        ) {
          errors.push(
            '/authentication/provider/config/userModel/passwordField: field does not exist in model',
          );
        }

        if (
          typeof upConfig.userModel.isVerifiedField === 'string' &&
          !targetModel.fields.some(
            f => f.name === upConfig.userModel.isVerifiedField,
          )
        ) {
          errors.push(
            '/authentication/provider/config/userModel/isVerifiedField: field does not exist in model',
          );
        }

        if (
          typeof upConfig.userModel.isVerifiedField === 'string' &&
          targetModel.fields.some(
            f => f.name === upConfig.userModel.isVerifiedField,
          ) &&
          targetModel.fields.find(
            f => f.name === upConfig.userModel.isVerifiedField,
          )?.type !== 'boolean'
        ) {
          errors.push(
            '/authentication/provider/config/userModel/isVerifiedField: field must be of type boolean',
          );
        }
      }
    }
  }

  return errors;
}

export default validateAuthConstraints;
