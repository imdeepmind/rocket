export const getResponseStructureSchema = (codes, dataSchema) => {
    const respSchema = {};
    for (const code of codes) {
        switch (code) {
            case 200:
            case 201:
                respSchema[code] = {
                    type: 'object',
                    properties: {
                        code: { type: 'integer' },
                        message: { type: 'string' },
                        data: dataSchema,
                    },
                };
                break;
            case 204:
                respSchema[code] = {
                    type: 'null',
                    description: 'Successfully deleted the entry',
                };
                break;
            default:
                throw new Error(`Unsupported HTTP status code: ${code}`);
        }
    }
    return respSchema;
};
/**
 * Build the security array for the schema based on authentication config.
 */
export function buildSecurityArray(config, authorization) {
    const security = [];
    if (!config.authentication.enabled || !authorization) {
        return security;
    }
    const providers = config.authentication.providers;
    if (providers.some(provider => provider.type === 'api-key')) {
        security.push({ apiKeyAuth: [] });
        return security;
    }
    if (providers.some(provider => provider.type !== 'api-key')) {
        security.push({ bearerAuth: [] });
    }
    return security;
}
//# sourceMappingURL=response.js.map