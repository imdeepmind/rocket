import { getApiRouteTargets } from '../../lib/config/api.js';
import { generateJSONValidationSchema } from '../../lib/schema/body.js';
import { buildAllQueryProperties } from '../../lib/schema/query.js';
import { buildSecurityArray, getResponseStructureSchema, } from '../../lib/schema/response.js';
import { getPublicFields } from '../../lib/schema/types.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { applyFilters } from '../../lib/sql/filters.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerSearchRoutes(app, config) {
    const { models } = config.data;
    for (const [modelName, model] of Object.entries(models)) {
        const searchableFields = Object.entries(model.fields).filter(([, f]) => f.apis.includes('search'));
        for (const [fieldName, field] of searchableFields) {
            const targets = getApiRouteTargets(config, 'model', modelName, fieldName, 'search');
            for (const { identifier, variant, policy } of targets) {
                registerSearchEndpoint(app, config, modelName, fieldName, field, model, variant, identifier, policy);
            }
        }
    }
}
function registerSearchEndpoint(app, config, modelName, fieldName, field, model, variant, apiIdentifier, policy) {
    const schema = generateSchema(fieldName, field, model, modelName, config, policy);
    const path = `/${variant}/${modelName}/search/${fieldName}`;
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
        const tableName = modelName;
        const publicFields = getPublicFields(model, policy.bypassSecret);
        const columns = publicFields.map(([name]) => `"${name}"`).join(', ');
        let query = `SELECT ${columns} FROM "${tableName}"`;
        const values = [];
        let paramIndex = 1;
        const whereClauses = [];
        const searchTerm = String(queryParams[`${fieldName}_search`] || '');
        whereClauses.push(`LOWER("${fieldName}") LIKE $${paramIndex++}`);
        values.push(`%${searchTerm.toLowerCase()}%`);
        const { whereClauses: filterClauses, values: filterValues, nextParamIndex, } = applyFilters(queryParams, paramIndex, [`${fieldName}_search`]);
        whereClauses.push(...filterClauses);
        values.push(...filterValues);
        paramIndex = nextParamIndex;
        query += ` WHERE ${whereClauses.join(' AND ')}`;
        const countQuery = `SELECT COUNT(*) as total FROM "${tableName}" WHERE ${whereClauses.join(' AND ')}`;
        let tx;
        try {
            tx = await app.db.beginTransaction();
            const countRes = await tx.query(countQuery, values);
            const total = Number(countRes.rows[0]?.total || 0);
            if (queryParams.orderBy) {
                query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
            }
            const page = Math.max(Number(queryParams.page) || 1, 1);
            const limit = Math.min(Math.max(Number(queryParams.limit) || 20, 10), 100);
            const offset = (page - 1) * limit;
            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
            values.push(limit, offset);
            const res = await tx.query(query, values);
            await tx.commit();
            return reply.status(200).send(app.buildResponse(200, `Successfully searched records from the ${tableName} table`, {
                data: res.rows || [],
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            }));
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
    const effectiveQueries = policy.supportedQueries;
    const queryProperties = {
        [`${fieldName}_search`]: {
            type: 'string',
            description: `Search pattern to match against ${fieldName}`,
        },
        ...buildAllQueryProperties(model, effectiveQueries, policy.bypassSecret),
    };
    const excludeSecret = !policy.bypassSecret;
    const schema = {
        summary: `Search ${capitalizeFirstLetter(modelName)} records by ${fieldName}`,
        description: `Search ${modelName} records from the database using a LIKE pattern on ${fieldName}`,
        tags: policy.tags,
        querystring: {
            type: 'object',
            properties: queryProperties,
            required: [`${fieldName}_search`],
            additionalProperties: false,
        },
        response: getResponseStructureSchema([200], {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: generateJSONValidationSchema(model, {
                        excludeSecretFields: excludeSecret,
                    }),
                },
                pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                    },
                },
            },
        }),
    };
    const security = buildSecurityArray(config, policy.authorization);
    if (security.length > 0) {
        schema.security = security;
    }
    return schema;
}
//# sourceMappingURL=search.js.map