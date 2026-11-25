import { mapDataTypeToJsonSchema } from '../../../lib/schema/types.js';
import { parseQueryPlaceholders } from '../../../lib/sql/placeholders.js';
const cast = (value, type) => {
    /* c8 ignore start */
    if (value === undefined || value === null) {
        throw new Error('Missing value for parameter');
    }
    /* c8 ignore stop */
    switch (type) {
        case 'integer':
            return Math.trunc(Number(value));
        case 'boolean':
            if (value === 'true')
                return true;
            if (value === 'false')
                return false;
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
            return typeof value === 'string' ? JSON.parse(value) : value;
        case 'enum':
            return String(value);
        case 'uuid':
            return String(value);
        case 'ulid':
            return String(value);
        default:
            return String(value);
    }
};
function interpolateQuery(queryTemplate, { body = {}, params = {}, query = {}, headers = {} }) {
    const values = [];
    let paramIndex = 1;
    const regex = /\[\[(path|body|query|header)\.([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\]\]/g;
    const sql = queryTemplate.replace(regex, (_, source, name, type) => {
        let val;
        if (source === 'path') {
            val = params[name];
            if (val === undefined)
                throw new Error(`Missing path param: "${name}"`);
        }
        else if (source === 'body') {
            val = body[name];
            if (val === undefined)
                throw new Error(`Missing body param: "${name}"`);
        }
        else if (source === 'query') {
            val = query[name];
            if (val === undefined)
                throw new Error(`Missing query param: "${name}"`);
        }
        else {
            val = headers[name];
            if (val === undefined)
                throw new Error(`Missing header param: "${name}"`);
        }
        values.push(cast(val, type));
        return `$${paramIndex++}`;
    });
    return { sql, values };
}
export function buildSqlEndpoint(sql, method, configValidation) {
    const paramsProperties = {};
    const queryProperties = {};
    const bodyProperties = {};
    const placeholders = parseQueryPlaceholders(sql);
    for (const { source, name, type } of placeholders) {
        if (source === 'header')
            continue;
        const jsonSchema = {
            ...mapDataTypeToJsonSchema(type),
            description: `Custom ${source} parameter`,
        };
        if (source === 'path') {
            paramsProperties[name] = jsonSchema;
        }
        else if (source === 'query') {
            queryProperties[name] = jsonSchema;
        }
        else {
            bodyProperties[name] = jsonSchema;
        }
    }
    const paramsKeys = Object.keys(paramsProperties);
    const queryKeys = Object.keys(queryProperties);
    const bodyKeys = Object.keys(bodyProperties);
    const configProps = configValidation?.properties ?? {};
    const configRequired = Array.isArray(configValidation?.required)
        ? configValidation.required
        : [];
    const result = {};
    if (paramsKeys.length > 0) {
        const finalParamsProps = {};
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
        const finalQueryProps = {};
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
            ...(requiredQuery.length > 0 ? { required: requiredQuery } : {}),
            additionalProperties: false,
        };
    }
    if (bodyKeys.length > 0 && method !== 'GET') {
        const finalBodyProps = {};
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
            ...(requiredBody.length > 0 ? { required: requiredBody } : {}),
            additionalProperties: false,
        };
    }
    return result;
}
export async function handleSql(app, request, reply, sql) {
    const params = request.params;
    const query = request.query;
    const body = request.body || {};
    const headers = request.headers;
    const interpolated = interpolateQuery(sql, { params, query, body, headers });
    const res = await app.db.query(interpolated.sql, interpolated.values);
    return reply.status(200).send(app.buildResponse(200, 'Success', {
        data: res.rows,
        res,
    }));
}
//# sourceMappingURL=sql.js.map