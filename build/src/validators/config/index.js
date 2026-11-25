import validateSchema, { ajv } from './schema.js';
import validateApisConstraints from './validate-apis.js';
import validateAuthConstraints from './validate-auth.js';
import validateCacheDbConstraints from './validate-cache-db.js';
import validateCorsConstraints from './validate-cors.js';
import validateCustomAPIs from './validate-custom-apis.js';
import validateIndexes from './validate-index.js';
import validateModelValidation from './validate-model.js';
import validateRateLimitConstraints from './validate-rate-limit.js';
import validateRbacConstraints from './validate-rbac.js';
import validateRelations from './validate-relations.js';
export function validateConfig(input) {
    const valid = validateSchema(input);
    const ajvErrors = valid
        ? []
        : (validateSchema.errors?.map(e => `${e.instancePath} ${e.message}`) ?? []);
    const constraintErrors = valid
        ? [
            ...validateModelValidation(input, ajv),
            ...validateIndexes(input),
            ...validateRelations(input),
            ...validateCacheDbConstraints(input),
            ...validateCorsConstraints(input),
            ...validateRateLimitConstraints(input),
            ...validateCustomAPIs(input),
            ...validateApisConstraints(input),
            ...validateAuthConstraints(input),
            ...validateRbacConstraints(input),
        ]
        : [];
    const allErrors = [...ajvErrors, ...constraintErrors];
    if (allErrors.length > 0) {
        throw new Error(allErrors.join('\n'));
    }
    return input;
}
//# sourceMappingURL=index.js.map