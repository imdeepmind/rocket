import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

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
              if (sp.value === '[userId]') {
                record[sp.name] = request.user?.id;
              } else if (sp.value === '[userEmail]') {
                record[sp.name] = request.user?.email;
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
  },
  {
    name: 'ssp-plugin',
  },
);
