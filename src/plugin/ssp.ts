import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

import {SspConfig, SspParamType} from '@/interfaces/config';

export default fp(
  async (fastify: FastifyInstance) => {
    function enforceSSP(request: FastifyRequest): void {
      const apiIdentifier = request.routeOptions?.config?.apiIdentifier;
      if (!apiIdentifier) {
        return;
      }

      const ssps: SspConfig[] =
        fastify.appConfig.apis?.[apiIdentifier]?.ssp ?? [];
      if (!ssps.length) return;

      const apply = (val: unknown, type: SspParamType) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const record = val as Record<string, unknown>;
          ssps.forEach(ssp => {
            if (ssp.paramType === type) {
              if (ssp.value === '[userId]') {
                record[ssp.paramName] = request.user?.id;
              } else if (ssp.value === '[userEmail]') {
                record[ssp.paramName] = request.user?.email;
              } else {
                record[ssp.paramName] = ssp.value;
              }
            }
          });
        }
      };

      // 1. replace request.query values based on ssp
      apply(request.query, 'query');

      // 2. replace request.body
      apply(request.body, 'body');

      // 3. finally request.params (path params)
      apply(request.params, 'path');
    }

    fastify.decorate('enforceSSP', enforceSSP);
  },
  {
    name: 'ssp-plugin',
  },
);
