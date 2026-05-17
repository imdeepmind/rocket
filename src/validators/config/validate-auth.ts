import {AppConfig} from '@/interfaces/config';

function validateAuthConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  // if authModel is api-key, then apiKey is required
  if (config.auth?.authEngine === 'api-key' && !config.auth?.apiKey) {
    errors.push('/auth/apiKey: apiKey is required when authEngine is api-key');
  }

  // if authModel is api-key, then authModel should not be present
  if (config.auth?.authEngine === 'api-key' && config.auth?.authModel) {
    errors.push(
      '/auth/authModel: authModel should not be present when authEngine is api-key',
    );
  }

  // if authModel is api-key, then otpVerification should not be present
  if (config.auth?.authEngine === 'api-key' && config.auth?.otpVerification) {
    errors.push(
      '/auth/otpVerification: otpVerification should not be present when authEngine is api-key',
    );
  }

  // if authModel is api-key, then otpEngine should not be present
  if (config.auth?.authEngine === 'api-key' && config.auth?.otpEngine) {
    errors.push(
      '/auth/otpEngine: otpEngine should not be present when authEngine is api-key',
    );
  }

  // if authModel is up-auth, then authModel is required
  if (config.auth?.authEngine === 'up-auth' && !config.auth?.authModel) {
    errors.push(
      '/auth/authModel: authModel is required when authEngine is up-auth',
    );
  }

  // if authEngine is up-auth and otpVerification is true then otpEngine is required
  if (
    config.auth?.authEngine === 'up-auth' &&
    config.auth?.otpVerification &&
    !config.auth?.otpEngine
  ) {
    errors.push(
      '/auth/otpEngine: otpEngine is required when authEngine is up-auth and otpVerification is true',
    );
  }

  // if authModel is up-auth, then apiKey should not be present
  if (config.auth?.authEngine === 'up-auth' && config.auth?.apiKey) {
    errors.push(
      '/auth/apiKey: apiKey should not be present when authEngine is up-auth',
    );
  }

  // check if authModel.modelName exists in models
  if (config.auth?.authEngine === 'up-auth' && config.auth?.authModel) {
    if (
      config.auth?.authModel.modelName &&
      !config.models.some(m => m.name === config.auth?.authModel.modelName)
    ) {
      errors.push('/auth/authModel/modelName: model does not exist');
    }

    // check if authModel.idColumn exists in models
    if (
      config.auth?.authModel.idColumn &&
      !config.models.some(m =>
        m.fields.some(f => f.name === config.auth?.authModel.idColumn),
      )
    ) {
      errors.push('/auth/authModel/idColumn: field does not exist in model');
    }

    // check if authModel.usernameColumn exists in models
    if (
      config.auth?.authModel.usernameColumn &&
      !config.models.some(m =>
        m.fields.some(f => f.name === config.auth?.authModel.usernameColumn),
      )
    ) {
      errors.push(
        '/auth/authModel/usernameColumn: field does not exist in model',
      );
    }

    // check if authModel.passwordColumn exists in models
    if (
      config.auth?.authModel.passwordColumn &&
      !config.models.some(m =>
        m.fields.some(f => f.name === config.auth?.authModel.passwordColumn),
      )
    ) {
      errors.push(
        '/auth/authModel/passwordColumn: field does not exist in model',
      );
    }
  }

  return errors;
}

export default validateAuthConstraints;
