import { getApiRouteTargets } from '../../lib/config/api.js';
import { generateJSONValidationSchema } from '../../lib/schema/body.js';
import { buildAllQueryProperties } from '../../lib/schema/query.js';
import { buildSecurityArray, getResponseStructureSchema, } from '../../lib/schema/response.js';
import { getPublicFields, mapDataTypeToJsonSchema } from '../../lib/schema/types.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { applyFilters } from '../../lib/sql/filters.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerIndexRoutes(app, config) {
    const { models } = config.data;
    for (const [modelName, model] of Object.entries(models)) {
        const indexFields = Object.entries(model.fields).filter(([, f]) => {
            return f.primaryKey || f.unique || f.apis.includes('index');
        });
        for (const [fieldName, field] of indexFields) {
            const targets = getApiRouteTargets(config, 'model', modelName, fieldName, 'index');
            for (const { identifier, variant, policy } of targets) {
                registerIndexEndpoint(app, config, modelName, fieldName, field, model, variant, identifier, policy);
            }
        }
    }
}
function registerIndexEndpoint(app, config, modelName, fieldName, field, model, variant, apiIdentifier, policy) {
    const { schema, isUnique, } = generateSchema(fieldName, field, model, modelName, config, policy);
    const path = `/${variant}/${modelName}/${fieldName}/:${fieldName}`;
    app.get(path, {
        schema,
        config: { apiIdentifier },
        preValidation: buildPreValidation(app, config, policy.authorization, policy.roles),
        preHandler: async (request) => {
            await app.callWebhook('request', request, null);
        },
        onSend: async (request, _, payload) => {
            await app.callWebhook('response', request, payload);
        },
    }, async (request, reply) => {
        const queryParams = request.query;
        const params = request.params;
        const tableName = modelName;
        const publicFields = getPublicFields(model, policy.bypassSecret);
        const columns = publicFields.map(([name]) => `"${name}"`).join(', ');
        let query = `SELECT ${columns} FROM "${tableName}"`;
        const values = [];
        let paramIndex = 1;
        const whereClauses = [];
        whereClauses.push(`"${fieldName}" = $${paramIndex++}`);
        values.push(params[fieldName]);
        if (!isUnique) {
            const { whereClauses: filterClauses, values: filterValues, nextParamIndex, } = applyFilters(queryParams, paramIndex);
            whereClauses.push(...filterClauses);
            values.push(...filterValues);
            paramIndex = nextParamIndex;
        }
        query += ` WHERE ${whereClauses.join(' AND ')}`;
        let tx;
        try {
            tx = await app.db.beginTransaction();
            let total = 0;
            if (!isUnique) {
                const countQuery = `SELECT COUNT(*) as total FROM "${tableName}" WHERE ${whereClauses.join(' AND ')}`;
                const countRes = await tx.query(countQuery, values);
                total = Number(countRes.rows[0]?.total || 0);
            }
            let page = 1;
            let limit = 20;
            if (!isUnique) {
                if (queryParams.orderBy) {
                    query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
                }
                page = Math.max(Number(queryParams.page) || 1, 1);
                limit = Math.min(Math.max(Number(queryParams.limit) || 20, 10), 100);
                const offset = (page - 1) * limit;
                query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
                values.push(limit, offset);
            }
            else {
                query += ` LIMIT $${paramIndex++};`;
                values.push(1);
            }
            const res = await tx.query(query, values);
            await tx.commit();
            const responsePayload = {
                data: isUnique ? res.rows[0] || null : res.rows || [],
            };
            if (!isUnique) {
                responsePayload.pagination = {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                };
            }
            return reply
                .status(200)
                .send(app.buildResponse(200, `Successfully retrieved records from the ${tableName} table`, responsePayload));
        }
        catch (err) {
            if (tx)
                await tx.rollback().catch(() => { });
            throw err;
        }
        finally {
            tx?.release();
        }
    });
}
function generateSchema(fieldName, field, model, modelName, config, policy) {
    const isUnique = field.primaryKey || field.unique;
    const fieldSchemaType = mapDataTypeToJsonSchema(field.type);
    const effectiveQueries = policy.supportedQueries;
    const queryProperties = isUnique
        ? {}
        : buildAllQueryProperties(model, effectiveQueries, policy.bypassSecret);
    const excludeSecret = !policy.bypassSecret;
    const responseSchemaProperties = {
        data: isUnique
            ? {
                ...generateJSONValidationSchema(model, {
                    excludeSecretFields: excludeSecret,
                }),
                nullable: true,
            }
            : {
                type: 'array',
                items: generateJSONValidationSchema(model, {
                    excludeSecretFields: excludeSecret,
                }),
            },
    };
    if (!isUnique) {
        responseSchemaProperties.pagination = {
            type: 'object',
            properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
            },
        };
    }
    const schema = {
        summary: `Get ${capitalizeFirstLetter(modelName)} record(s) by ${fieldName}`,
        description: `Get ${modelName} record(s) from the database by ${fieldName}`,
        tags: policy.tags,
        params: {
            type: 'object',
            properties: {
                [fieldName]: {
                    ...fieldSchemaType,
                    description: `The ${fieldName} value to look up`,
                },
            },
            required: [fieldName],
        },
        response: getResponseStructureSchema([200], {
            type: 'object',
            properties: responseSchemaProperties,
        }),
    };
    if (Object.keys(queryProperties).length > 0) {
        schema.querystring = {
            type: 'object',
            properties: queryProperties,
            additionalProperties: false,
        };
    }
    const security = buildSecurityArray(config, policy.authorization);
    if (security.length > 0) {
        schema.security = security;
    }
    return { schema, isUnique };
}
//# sourceMappingURL=index-route.js.map