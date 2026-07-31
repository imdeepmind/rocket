import {ServerSideParamConfig} from '@/interfaces/config';

/**
 * Strip server-side params from a route schema for Swagger visibility.
 *
 * Removes query properties that match a SSP name (including filter
 * variants like `field_eq`, `field_lt` etc.) and body properties that
 * match a SSP name. **Path params are never removed** so the URL
 * structure stays visible in the docs.
 */
export function stripServerSideParamsFromSchema(
  schema: Record<string, unknown>,
  serverSideParams: ServerSideParamConfig[],
): void {
  if (!serverSideParams?.length) return;

  const queryNames = new Set(
    serverSideParams.filter(sp => sp.type === 'query').map(sp => sp.name),
  );
  const bodyNames = new Set(
    serverSideParams.filter(sp => sp.type === 'body').map(sp => sp.name),
  );

  if (queryNames.size > 0 && schema.querystring) {
    const qs = schema.querystring as Record<string, unknown>;
    const props = qs.properties as Record<string, object> | undefined;
    if (props) {
      for (const name of queryNames) {
        delete props[name];
        for (const key of Object.keys(props)) {
          if (key.startsWith(`${name}_`)) {
            delete props[key];
          }
        }
      }
    }
    if (props && Object.keys(props).length === 0) {
      delete schema.querystring;
    }
  }

  if (bodyNames.size > 0 && schema.body) {
    const body = schema.body as Record<string, unknown>;
    const props = body.properties as Record<string, object> | undefined;
    if (props) {
      for (const name of bodyNames) {
        delete props[name];
      }
      if (Array.isArray(body.required)) {
        body.required = (body.required as string[]).filter(
          r => !bodyNames.has(r),
        );
        if ((body.required as string[]).length === 0) {
          delete body.required;
        }
      }
    }
    if (props && Object.keys(props).length === 0) {
      delete schema.body;
    }
  }
}
