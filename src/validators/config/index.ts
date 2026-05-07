import {AppConfig} from '@/interfaces/config';

import validateSchema, {ajv} from './schema';
import validateApisConstraints from './validate-apis';
import validateAuthConstraints from './validate-auth';
import validateCacheDbConstraints from './validate-cache-db';
import validateCustomAPIs from './validate-custom-apis';
import validateForeignKeys from './validate-fk';
import validateIndexes from './validate-index';
import validateModelValidation from './validate-model';
import validateRateLimitConstraints from './validate-rate-limit';

export function validateConfig(input: AppConfig) {
  const valid = validateSchema(input);

  const ajvErrors: string[] = valid
    ? []
    : (validateSchema.errors?.map(e => `${e.instancePath} ${e.message}`) ?? []);

  const constraintErrors = valid
    ? [
        ...validateModelValidation(input as AppConfig, ajv),
        ...validateIndexes(input as AppConfig),
        ...validateForeignKeys(input as AppConfig),
        ...validateRateLimitConstraints(input as AppConfig),
        ...validateCacheDbConstraints(input as AppConfig),
        ...validateCustomAPIs(input as AppConfig),
        ...validateApisConstraints(input as AppConfig),
        ...validateAuthConstraints(input as AppConfig),
      ]
    : [];

  const allErrors = [...ajvErrors, ...constraintErrors];

  if (allErrors.length > 0) {
    throw new Error(allErrors.join('\n'));
  }

  return input;
}
