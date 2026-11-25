import { buildProviderDescriptors } from '../../lib/auth/discovery.js';
import { getAuthModel } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
export function registerProvidersRoute(app, config) {
    const authModel = getAuthModel(config);
    if (!authModel) {
        return;
    }
    const targets = getApiRouteTargets(config, 'auth', authModel, 'unknown', 'providers');
    for (const { identifier, variant, policy } of targets) {
        registerProvidersEndpoint(app, config, variant, identifier, policy);
    }
}
function registerProvidersEndpoint(app, config, variant, apiIdentifier, policy) {
    app.get(`/${variant}/auth/providers`, {
        schema: generateSchema(policy),
        config: { apiIdentifier },
    }, async (request, reply) => {
        const [basePath] = request.url.split('/auth/providers');
        return reply
            .status(200)
            .send(app.buildResponse(200, 'Authentication providers', buildProviderDescriptors(config, basePath)));
    });
}
function generateSchema(policy) {
    const responseSchema = getResponseStructureSchema([200], {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                type: { type: 'string' },
                name: { type: 'string' },
                protocol: { type: 'string' },
                capabilities: { type: 'array', items: { type: 'string' } },
                login: {
                    type: 'object',
                    properties: {
                        method: { type: 'string' },
                        url: { type: 'string' },
                    },
                },
            },
        },
    });
    return {
        summary: 'List configured authentication providers',
        description: 'Returns every active authentication provider with the endpoints the frontend needs to render login options.',
        tags: policy.tags,
        response: responseSchema,
    };
}
//# sourceMappingURL=providers.js.map