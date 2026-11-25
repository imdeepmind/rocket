import { getApiRouteTargets } from '../../lib/config/api.js';
import { stripManagedTimestampProperties } from '../../lib/schema/body.js';
import { isManagedTimestampField } from '../../lib/schema/fields.js';
import { normalizeSchemaForAjv } from '../../lib/schema/normalize.js';
import { buildAllQueryProperties } from '../../lib/schema/query.js';
import { buildSecurityArray, getResponseStructureSchema, } from '../../lib/schema/response.js';
import { getPublicFields, mapDataTypeToJsonSchema } from '../../lib/schema/types.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { applyFilters } from '../../lib/sql/filters.js';
import { buildUpdatedAtClause } from '../../lib/sql/timestamps.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerEditRoutes(app, config) {
    const { models } = config.data;
    for (const [modelName, model] of Object.entries(models)) {
        const editableFields = Object.entries(model.fields).filter(([, f]) => f.apis.includes('edit'));
        for (const [fieldName, field] of editableFields) {
            const targets = getApiRouteTargets(config, 'model', modelName, fieldName, 'edit');
            for (const { identifier, variant, policy } of targets) {
                registerEditEndpoint(app, config, modelName, fieldName, field, model, variant, identifier, policy);
            }
        }
    }
}
function registerEditEndpoint(app, config, modelName, fieldName, field, model, variant, apiIdentifier, policy) {
    const isUnique = field.primaryKey || field.unique;
    const paramSchema = mapDataTypeToJsonSchema(field.type);
    const effectiveQueries = policy.supportedQueries;
    const queryProperties = isUnique
        ? {}
        : buildAllQueryProperties(model, effectiveQueries, policy.bypassSecret);
    const bodyProperties = {};
    const allBodyFieldNames = [];
    for (const [otherName, otherField] of Object.entries(model.fields)) {
        if (otherName === fieldName || isManagedTimestampField(otherName))
            continue;
        bodyProperties[otherName] = {
            ...mapDataTypeToJsonSchema(otherField.type),
            ...(otherField.type === 'enum' && otherField.values
                ? { enum: otherField.values }
                : {}),
            description: `Updated value for ${otherName}`,
        };
        allBodyFieldNames.push(otherName);
    }
    const publicFieldNames = new Set(getPublicFields(model, policy.bypassSecret).map(([name]) => name));
    const buildRouteSchema = (method) => {
        let finalBodySchema;
        if (model.validation) {
            finalBodySchema = normalizeSchemaForAjv(model.validation);
            stripManagedTimestampProperties(finalBodySchema);
            if (method === 'PATCH') {
                delete finalBodySchema.required;
            }
        }
        else {
            finalBodySchema = {
                type: 'object',
                properties: bodyProperties,
                required: method === 'PUT' ? allBodyFieldNames : [],
                additionalProperties: false,
            };
        }
        const responseDataSchema = {
            ...finalBodySchema,
            properties: Object.fromEntries(Object.entries(finalBodySchema.properties || {}).filter(([name]) => publicFieldNames.has(name))),
        };
        if (method === 'PATCH' && responseDataSchema.required) {
            delete responseDataSchema.required;
        }
        const schema = {
            summary: `${method === 'PATCH' ? 'Partial' : 'Complete'} edit of ${capitalizeFirstLetter(modelName)} record(s) by ${fieldName}`,
            description: `${method} update on records from the database by ${fieldName}`,
            tags: policy.tags,
            params: {
                type: 'object',
                properties: {
                    [fieldName]: {
                        ...paramSchema,
                        description: `The ${fieldName} value identifying the record to edit`,
                    },
                },
                required: [fieldName],
                additionalProperties: false,
            },
            body: finalBodySchema,
            response: getResponseStructureSchema([200], responseDataSchema),
        };
        const security = buildSecurityArray(config, policy.authorization);
        if (security.length > 0) {
            schema.security = security;
        }
        if (Object.keys(queryProperties).length > 0) {
            schema.querystring = {
                type: 'object',
                properties: queryProperties,
                additionalProperties: false,
            };
        }
        return schema;
    };
    const handleEditRequest = async (request, reply) => {
        const queryParams = request.query;
        const params = request.params;
        const tableName = modelName;
        const body = request.body;
        delete body[fieldName];
        for (const key of Object.keys(body)) {
            if (isManagedTimestampField(key)) {
                delete body[key];
            }
        }
        const updatedAtClause = buildUpdatedAtClause(model, config.infrastructure.database.engine);
        const keys = Object.keys(body);
        if (keys.length === 0) {
            return reply.status(400).send({ error: 'No fields provided for update' });
        }
        const values = [];
        let paramIndex = 1;
        const setClauses = [];
        for (const key of keys) {
            setClauses.push(`"${key}" = $${paramIndex++}`);
            values.push(body[key]);
        }
        if (updatedAtClause) {
            setClauses.push(updatedAtClause);
        }
        const whereClauses = [];
        whereClauses.push(`"${fieldName}" = $${paramIndex++}`);
        values.push(params[fieldName]);
        if (!isUnique) {
            const { whereClauses: filterClauses, values: filterValues, nextParamIndex, } = applyFilters(queryParams, paramIndex, [fieldName]);
            whereClauses.push(...filterClauses);
            values.push(...filterValues);
            paramIndex = nextParamIndex;
        }
        const query = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
        const responseBody = {};
        for (const [key, value] of Object.entries(body)) {
            if (publicFieldNames.has(key)) {
                responseBody[key] = value;
            }
        }
        let tx;
        try {
            tx = await app.db.beginTransaction();
            const res = await tx.query(query, values);
            await tx.commit();
            const affected = res.changes;
            if (affected !== undefined && affected === 0) {
                return reply
                    .status(404)
                    .send(app.buildResponse(404, `No ${tableName} record found matching the given criteria`, null));
            }
            return reply
                .status(200)
                .send(app.buildResponse(200, `Successfully updated records in the ${tableName} table`, responseBody));
        }
        catch (err) {
            if (tx)
                await tx.rollback().catch(() => { });
            throw err;
        }
        finally {
            tx?.release();
        }
    };
    const basePath = `/${variant}/${modelName}/${fieldName}/:${fieldName}`;
    app.patch(basePath, {
        schema: buildRouteSchema('PATCH'),
        config: { apiIdentifier },
        preValidation: buildPreValidation(app, config, policy.authorization, policy.roles),
        preHandler: async (request) => {
            await app.callWebhook('request', request, null);
        },
        onSend: async (request, _, payload) => {
            await app.callWebhook('response', request, payload);
        },
    }, handleEditRequest);
    app.put(basePath, {
        schema: buildRouteSchema('PUT'),
        config: { apiIdentifier },
        preValidation: buildPreValidation(app, config, policy.authorization, policy.roles),
        preHandler: async (request) => {
            await app.callWebhook('request', request, null);
        },
        onSend: async (request, _, payload) => {
            await app.callWebhook('response', request, payload);
        },
    }, handleEditRequest);
}
//# sourceMappingURL=edit.js.map