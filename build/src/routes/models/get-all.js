import { getApiRouteTargets } from '../../lib/config/api.js';
import { generateJSONValidationSchema } from '../../lib/schema/body.js';
import { buildAllQueryProperties } from '../../lib/schema/query.js';
import { buildSecurityArray, getResponseStructureSchema, } from '../../lib/schema/response.js';
import { getPublicFields } from '../../lib/schema/types.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { applyFilters } from '../../lib/sql/filters.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerGetAllRoutes(app, config) {
    const { models } = config.data;
    for (const [modelName, model] of Object.entries(models)) {
        const targets = getApiRouteTargets(config, 'model', modelName, 'unknown', 'getAll');
        for (const { identifier, variant, policy } of targets) {
            registerGetAllEndpoint(app, config, modelName, model, variant, identifier, policy);
        }
    }
}
function registerGetAllEndpoint(app, config, modelName, model, variant, apiIdentifier, policy) {
    const schema = generateSchema(model, modelName, config, policy);
    const path = `/${variant}/${modelName}/`;
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
        const { whereClauses: filterClauses, values: filterValues, nextParamIndex, } = applyFilters(queryParams, paramIndex);
        whereClauses.push(...filterClauses);
        values.push(...filterValues);
        paramIndex = nextParamIndex;
        if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''}`;
        let tx;
        try {
            tx = await app.db.beginTransaction();
            const countRes = await tx.query(countQuery, filterValues);
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
            return reply.status(200).send(app.buildResponse(200, `Successfully retrieved records from the ${tableName} table`, {
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
function generateSchema(model, modelName, config, policy) {
    const effectiveQueries = policy.supportedQueries;
    const queryProperties = buildAllQueryProperties(model, effectiveQueries, policy.bypassSecret);
    const excludeSecret = !policy.bypassSecret;
    const schema = {
        summary: `Get all ${capitalizeFirstLetter(modelName)} records`,
        description: `Get all ${modelName} records from the database`,
        tags: policy.tags,
        querystring: {
            type: 'object',
            properties: queryProperties,
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
//# sourceMappingURL=get-all.js.map