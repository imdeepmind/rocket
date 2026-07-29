import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {mapDataTypeToJsonSchema} from '@/routes/schema-helpers';

import {DataType} from '@/interfaces/config';

type ParamSource = {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

const cast = (value: unknown, type: DataType): unknown => {
  /* c8 ignore start */
  if (value === undefined || value === null) {
    throw new Error('Missing value for parameter');
  }
  /* c8 ignore stop */
  switch (type) {
    case 'integer':
      return Math.trunc(Number(value));
    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      return Boolean(value);
    case 'string':
      return String(value);
    case 'text':
      return String(value);
    case 'datetime':
      return String(value);
    case 'date':
      return String(value);
    case 'decimal':
      return Number(value);
    case 'json':
      return value;
    default:
      return String(value);
  }
};

function interpolateQuery(
  queryTemplate: string,
  {body = {}, params = {}, query = {}}: ParamSource,
): {sql: string; values: unknown[]} {
  const values: unknown[] = [];
  let paramIndex = 1;

  const regex = /(\$\$|@@|&&)([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\1/g;

  const sql = queryTemplate.replace(regex, (_, typeSymbol, name, type) => {
    let val: unknown;

    if (typeSymbol === '$$') {
      val = params[name];
      if (val === undefined) throw new Error(`Missing path param: "${name}"`);
    } else if (typeSymbol === '@@') {
      val = body[name];
      if (val === undefined) throw new Error(`Missing body param: "${name}"`);
    } else {
      val = query[name];
      if (val === undefined) throw new Error(`Missing query param: "${name}"`);
    }

    values.push(cast(val, type as DataType));
    return `$${paramIndex++}`;
  });

  return {sql, values};
}

export function buildSqlEndpoint(
  sql: string,
  method: string,
  configValidation?: Record<string, unknown>,
): {
  params?: Record<string, unknown>;
  querystring?: Record<string, unknown>;
  body?: Record<string, unknown>;
  routePath: string;
} {
  const paramsProperties: Record<string, object> = {};
  const queryProperties: Record<string, object> = {};
  const bodyProperties: Record<string, object> = {};

  const delims = ['@@', '$$', '&&'];
  const foundDelims: {pos: number; type: string}[] = [];

  delims.forEach(d => {
    let pos = sql.indexOf(d);
    while (pos !== -1) {
      foundDelims.push({pos, type: d});
      pos = sql.indexOf(d, pos + 2);
    }
  });

  foundDelims.sort((a, b) => a.pos - b.pos);

  for (let i = 0; i < foundDelims.length; i += 2) {
    const start = foundDelims[i];
    const end = foundDelims[i + 1];

    if (!end || start.type !== end.type) continue;

    const varString = sql.substring(start.pos + 2, end.pos);
    const parts = varString.split(':');

    const varName = parts[0];
    const varTypeStr = parts[1];

    const jsonSchema = {
      ...mapDataTypeToJsonSchema(varTypeStr as DataType),
      description: `Custom ${start.type === '@@' ? 'body' : start.type === '&&' ? 'query' : 'path'} parameter`,
    };

    if (start.type === '$$') {
      paramsProperties[varName] = jsonSchema;
    } else if (start.type === '&&') {
      queryProperties[varName] = jsonSchema;
    } else {
      bodyProperties[varName] = jsonSchema;
    }
  }

  const paramsKeys = Object.keys(paramsProperties);
  const queryKeys = Object.keys(queryProperties);
  const bodyKeys = Object.keys(bodyProperties);

  const configProps: Record<string, object> =
    (configValidation?.properties as Record<string, object> | undefined) ?? {};
  const configRequired = Array.isArray(configValidation?.required)
    ? (configValidation.required as string[])
    : [];

  const result: {
    routePath: string;
    params?: Record<string, unknown>;
    querystring?: Record<string, unknown>;
    body?: Record<string, unknown>;
  } = {routePath: ''};

  if (paramsKeys.length > 0) {
    for (const key of paramsKeys) {
      result.routePath += `/:${key}`;
    }
    const finalParamsProps: Record<string, object> = {};
    for (const key of paramsKeys) {
      finalParamsProps[key] = {
        ...paramsProperties[key],
        ...(configProps[key] ?? {}),
      };
    }
    result.params = {
      type: 'object',
      properties: finalParamsProps,
      required: paramsKeys,
      additionalProperties: false,
    };
  }

  if (queryKeys.length > 0) {
    const finalQueryProps: Record<string, object> = {};
    for (const key of queryKeys) {
      finalQueryProps[key] = {
        ...queryProperties[key],
        ...(configProps[key] ?? {}),
      };
    }
    const requiredQuery = queryKeys.filter(k => configRequired.includes(k));
    result.querystring = {
      type: 'object',
      properties: finalQueryProps,
      ...(requiredQuery.length > 0 ? {required: requiredQuery} : {}),
      additionalProperties: false,
    };
  }

  if (bodyKeys.length > 0 && method !== 'GET') {
    const finalBodyProps: Record<string, object> = {};
    for (const key of bodyKeys) {
      finalBodyProps[key] = {
        ...bodyProperties[key],
        ...(configProps[key] ?? {}),
      };
    }
    const requiredBody = bodyKeys.filter(k => configRequired.includes(k));
    result.body = {
      type: 'object',
      properties: finalBodyProps,
      ...(requiredBody.length > 0 ? {required: requiredBody} : {}),
      additionalProperties: false,
    };
  }

  return result;
}

export async function handleSql(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  sql: string,
): Promise<void> {
  const params = request.params as Record<string, unknown>;
  const query = request.query as Record<string, unknown>;
  const body = (request.body as Record<string, unknown>) || {};

  const interpolated = interpolateQuery(sql, {params, query, body});

  const res = await app.db.query(interpolated.sql, interpolated.values);

  return reply.status(200).send(
    app.buildResponse(200, 'Success', {
      data: res.rows,
      res,
    }),
  );
}
