import {FastifyRequest} from 'fastify';

import {SspConfig, SspParamType} from '@/schema/config';

/**
 * Apply SSP values to the request based on the ssp config.
 */
export function enforceSSP(ssps: SspConfig[], request: FastifyRequest) {
  const apply = (val: unknown, type: SspParamType) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const record = val as Record<string, unknown>;
      ssps.forEach(ssp => {
        if (ssp.paramType === type) {
          record[ssp.paramName] = ssp.value;
        }
      });
    }
  };

  // 1. replace request.query values based on spp
  apply(request.query, 'query');

  // 2. replace request.body
  apply(request.body, 'body');

  // 3. finally request.path (path params)
  apply(request.params, 'path');
}
