import {AppConfig, ResolvedAppConfig} from '@/interfaces/config';

import validateSchema, {ajv} from './schema';
import validateApisConstraints from './validate-apis';
import validateAuthConstraints from './validate-auth';
import validateCacheDbConstraints from './validate-cache-db';
import validateCorsConstraints from './validate-cors';
import validateCustomAPIs from './validate-custom-apis';
import validateIndexes from './validate-index';
import validateModelValidation from './validate-model';
import validateRateLimitConstraints from './validate-rate-limit';
import validateRbacConstraints from './validate-rbac';
import validateRelations from './validate-relations';

export function validateConfig<T extends AppConfig | ResolvedAppConfig>(
  input: T,
): T {
  const valid = validateSchema(input);

  const ajvErrors: string[] = valid
    ? []
    : (validateSchema.errors?.map(e => `${e.instancePath} ${e.message}`) ?? []);

  const constraintErrors = valid
    ? [
        ...validateModelValidation(input as AppConfig, ajv),
        ...validateIndexes(input as AppConfig),
        ...validateRelations(input as AppConfig),
        ...validateCacheDbConstraints(input as AppConfig),
        ...validateCorsConstraints(input as AppConfig),
        ...validateRateLimitConstraints(input as AppConfig),
        ...validateCustomAPIs(input as AppConfig),
        ...validateApisConstraints(input as ResolvedAppConfig),
        ...validateAuthConstraints(input as AppConfig),
        ...validateRbacConstraints(input as AppConfig),
      ]
    : [];

  const allErrors = [...ajvErrors, ...constraintErrors];

  if (allErrors.length > 0) {
    throw new Error(allErrors.join('\n'));
  }

  return input;
}
