import fp from 'fastify-plugin';
import { stripServerSideParamsFromSchema } from '../lib/schema/ssp.js';
export default fp(async (fastify) => {
    function enforceSSP(request) {
        const apiIdentifier = request.routeOptions?.config?.apiIdentifier;
        if (!apiIdentifier) {
            return;
        }
        const serverSideParams = fastify.appConfig.apis[apiIdentifier]?.serverSideParams ?? [];
        if (!serverSideParams.length)
            return;
        const apply = (val, type) => {
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                const record = val;
                serverSideParams.forEach(sp => {
                    if (sp.type === type) {
                        if (typeof sp.value === 'string' &&
                            sp.value.startsWith('[[') &&
                            sp.value.endsWith(']]') &&
                            sp.value.length > 4) {
                            const varName = sp.value.slice(2, -2);
                            const customVal = fastify.appConfig.application.magicVariables[varName];
                            if (customVal !== undefined) {
                                record[sp.name] = customVal;
                            }
                            else if (varName === 'userId') {
                                record[sp.name] = request.user?.id;
                            }
                            else if (varName === 'userEmail') {
                                record[sp.name] = request.user?.email;
                            }
                            else {
                                record[sp.name] = sp.value;
                            }
                        }
                        else {
                            record[sp.name] = sp.value;
                        }
                    }
                });
            }
        };
        apply(request.query, 'query');
        apply(request.body, 'body');
        apply(request.params, 'path');
    }
    fastify.decorate('enforceSSP', enforceSSP);
    fastify.addHook('onRoute', routeOptions => {
        const apiIdentifier = routeOptions.config?.apiIdentifier;
        if (!apiIdentifier)
            return;
        const serverSideParams = fastify.appConfig.apis[apiIdentifier]?.serverSideParams;
        if (!serverSideParams?.length)
            return;
        if (!routeOptions.schema)
            return;
        stripServerSideParamsFromSchema(routeOptions.schema, serverSideParams);
    });
}, {
    name: 'ssp-plugin',
});
//# sourceMappingURL=ssp.js.map