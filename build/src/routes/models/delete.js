import { getApiRouteTargets } from '../../lib/config/api.js';
import { buildFilterQueryProperties } from '../../lib/schema/query.js';
import { buildSecurityArray, getResponseStructureSchema, } from '../../lib/schema/response.js';
import { getPublicFields, mapDataTypeToJsonSchema } from '../../lib/schema/types.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { applyFilters } from '../../lib/sql/filters.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerDeleteRoutes(app, config) {
    const { models } = config.data;
    for (const [modelName, model] of Object.entries(models)) {
        const deletableFields = Object.entries(model.fields).filter(([, f]) => f.apis.includes('delete'));
        for (const [fieldName, field] of deletableFields) {
            const targets = getApiRouteTargets(config, 'model', modelName, fieldName, 'delete');
            for (const { identifier, variant, policy } of targets) {
                registerDeleteEndpoint(app, config, modelName, fieldName, field, model, variant, identifier, policy);
            }
        }
    }
}
function registerDeleteEndpoint(app, config, modelName, fieldName, field, model, variant, apiIdentifier, policy) {
    const isUnique = field.primaryKey || field.unique;
    const schema = generateSchema(fieldName, field, model, modelName, config, policy, isUnique);
    const path = `/${variant}/${modelName}/${fieldName}/:${fieldName}`;
    app.delete(path, {
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
        const { [fieldName]: value } = request.params;
        const queryParams = request.query;
        const tableName = modelName;
        const columnName = fieldName;
        const whereClauses = [];
        const values = [];
        let paramIndex = 1;
        whereClauses.push(`"${columnName}" = $${paramIndex++}`);
        values.push(value);
        if (!isUnique) {
            const { whereClauses: filterClauses, values: filterValues, nextParamIndex, } = applyFilters(queryParams, paramIndex, [fieldName]);
            whereClauses.push(...filterClauses);
            values.push(...filterValues);
            paramIndex = nextParamIndex;
        }
        const query = `DELETE FROM "${tableName}" WHERE ${whereClauses.join(' AND ')};`;
        let tx;
        try {
            tx = await app.db.beginTransaction();
            await tx.query(query, values);
            await tx.commit();
        }
        catch (err) {
            if (tx)
                await tx.rollback().catch(() => { });
            throw err;
        }
        finally {
            tx?.release();
        }
        return reply.status(204).send();
    });
}
function generateSchema(fieldName, field, model, modelName, config, policy, isUnique) {
    const paramSchema = mapDataTypeToJsonSchema(field.type);
    const effectiveQueries = policy.supportedQueries;
    const queryProperties = {};
    if (!isUnique) {
        const fields = policy.bypassSecret
            ? Object.entries(model.fields)
            : getPublicFields(model);
        for (const [fName, f] of fields) {
            if (fName === fieldName)
                continue;
            Object.assign(queryProperties, buildFilterQueryProperties(fName, f, effectiveQueries));
        }
    }
    const schema = {
        summary: `Delete ${capitalizeFirstLetter(modelName)} records by ${fieldName}`,
        description: `Delete records from ${capitalizeFirstLetter(modelName)} table where ${fieldName} matches the provided value`,
        tags: policy.tags,
        params: {
            type: 'object',
            properties: {
                [fieldName]: {
                    ...paramSchema,
                    description: `The ${fieldName} value identifying the record to delete`,
                },
            },
            required: [fieldName],
            additionalProperties: false,
        },
        response: getResponseStructureSchema([204], {}),
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
    return schema;
}
//# sourceMappingURL=delete.js.map