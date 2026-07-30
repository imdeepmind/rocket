import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

import {stripServerSideParamsFromSchema} from '@/routes/schema-helpers';

import {ServerSideParamConfig, ServerSideParamType} from '@/interfaces/config';

export default fp(
  async (fastify: FastifyInstance) => {
    function enforceSSP(request: FastifyRequest): void {
      const apiIdentifier = request.routeOptions?.config?.apiIdentifier;
      if (!apiIdentifier) {
        return;
      }

      const serverSideParams: ServerSideParamConfig[] =
        fastify.appConfig.apis?.[apiIdentifier]?.serverSideParams ?? [];
      if (!serverSideParams.length) return;

      const apply = (val: unknown, type: ServerSideParamType) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const record = val as Record<string, unknown>;
          serverSideParams.forEach(sp => {
            if (sp.type === type) {
              if (
                typeof sp.value === 'string' &&
                sp.value.startsWith('[') &&
                sp.value.endsWith(']') &&
                sp.value.length > 2
              ) {
                const varName = sp.value.slice(1, -1);
                const customVal =
                  fastify.appConfig.application.magicVariables?.[varName];
                if (customVal !== undefined) {
                  record[sp.name] = customVal;
                } else if (varName === 'userId') {
                  record[sp.name] = request.user?.id;
                } else if (varName === 'userEmail') {
                  record[sp.name] = request.user?.email;
                } else {
                  record[sp.name] = sp.value;
                }
              } else {
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
      if (!apiIdentifier) return;

      const serverSideParams =
        fastify.appConfig.apis?.[apiIdentifier]?.serverSideParams;
      if (!serverSideParams?.length) return;
      if (!routeOptions.schema) return;

      stripServerSideParamsFromSchema(
        routeOptions.schema as Record<string, unknown>,
        serverSideParams,
      );
    });
  },
  {
    name: 'ssp-plugin',
  },
);
