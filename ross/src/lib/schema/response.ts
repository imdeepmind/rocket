import {ResolvedAppConfig} from '@/interfaces/config';

export const getResponseStructureSchema = (
  codes: number[],
  dataSchema: Record<string, unknown>,
): Record<number, object> => {
  const respSchema: Record<number, object> = {};

  for (const code of codes) {
    switch (code) {
      case 200:
      case 201:
        respSchema[code] = {
          type: 'object',
          properties: {
            code: {type: 'integer'},
            message: {type: 'string'},
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
export function buildSecurityArray(
  config: ResolvedAppConfig,
  authorization: boolean,
): Array<{[key: string]: string[]}> {
  const security: Array<{[key: string]: string[]}> = [];

  if (!config.authentication.enabled || !authorization) {
    return security;
  }

  const providers = config.authentication.providers;

  if (providers.some(provider => provider.type === 'api-key')) {
    security.push({apiKeyAuth: []});
    return security;
  }

  if (providers.some(provider => provider.type !== 'api-key')) {
    security.push({bearerAuth: []});
  }

  return security;
}
