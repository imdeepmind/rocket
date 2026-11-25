import { getActiveUserModel, getUpAuth } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { isManagedTimestampField } from '../../lib/schema/fields.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
import { mapDataTypeToJsonSchema } from '../../lib/schema/types.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { buildUpdatedAtClause } from '../../lib/sql/timestamps.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerEditMeRoute(app, config) {
    const { models } = config.data;
    const userModel = getActiveUserModel(config);
    if (!userModel) {
        return;
    }
    const upAuth = getUpAuth(config);
    const { modelName: model, idField } = userModel;
    const usernameField = upAuth?.usernameField ?? '';
    const passwordField = upAuth?.passwordField ?? '';
    const isVerifiedField = upAuth?.isVerifiedField;
    const authModelConfig = models[model];
    if (!authModelConfig)
        return;
    const targets = getApiRouteTargets(config, 'auth', model, 'unknown', 'editMe');
    for (const { identifier, variant, policy } of targets) {
        registerEditMeEndpoint(app, config, model, authModelConfig, idField, usernameField, passwordField, isVerifiedField, variant, identifier, policy);
    }
}
function registerEditMeEndpoint(app, config, model, authModelConfig, idField, usernameField, passwordField, isVerifiedField, variant, apiIdentifier, policy) {
    const schema = generateSchema(authModelConfig, model, idField, usernameField, passwordField, isVerifiedField, policy);
    const path = `/${variant}/auth/user/me`;
    app.patch(path, {
        schema,
        config: { apiIdentifier },
        preValidation: buildPreValidation(app, config, true),
    }, async (request, reply) => {
        const userPayload = request.user;
        const userId = userPayload.id;
        if (!userId) {
            return reply
                .status(401)
                .send(app.buildResponse(401, 'User ID missing in token payload', null));
        }
        const body = request.body;
        const protectedFields = new Set([idField, usernameField, passwordField, isVerifiedField].filter(Boolean));
        const editableKeys = Object.keys(body).filter(k => !protectedFields.has(k) && !isManagedTimestampField(k));
        if (editableKeys.length === 0) {
            return reply
                .status(400)
                .send(app.buildResponse(400, 'No editable fields provided', null));
        }
        const updatedAtClause = buildUpdatedAtClause(authModelConfig, config.infrastructure.database.engine);
        const selectQuery = `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;
        let tx;
        try {
            tx = await app.db.beginTransaction();
            const res = await tx.query(selectQuery, [userId]);
            if (res.rows.length === 0) {
                throw Object.assign(new Error('User not found'), {
                    statusCode: 404,
                    body: app.buildResponse(404, 'User not found', null),
                });
            }
            const setClauses = [];
            const values = [];
            let paramIndex = 1;
            for (const key of editableKeys) {
                setClauses.push(`"${key}" = $${paramIndex++}`);
                values.push(body[key]);
            }
            if (updatedAtClause) {
                setClauses.push(updatedAtClause);
            }
            values.push(userId);
            const updateQuery = `UPDATE "${model}" SET ${setClauses.join(', ')} WHERE "${idField}" = $${paramIndex};`;
            await tx.query(updateQuery, values);
            await tx.commit();
            const updatedFields = {};
            for (const key of editableKeys) {
                updatedFields[key] = body[key];
            }
            return reply
                .status(200)
                .send(app.buildResponse(200, 'User profile updated successfully', updatedFields));
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
function generateSchema(authModelConfig, model, idField, usernameField, passwordField, isVerifiedField, policy) {
    const protectedFields = new Set([idField, usernameField, passwordField, isVerifiedField].filter(Boolean));
    const bodyProperties = {};
    for (const [fieldName, field] of Object.entries(authModelConfig.fields)) {
        if (!protectedFields.has(fieldName) &&
            !isManagedTimestampField(fieldName)) {
            bodyProperties[fieldName] = {
                ...mapDataTypeToJsonSchema(field.type),
                description: `New value for ${fieldName}`,
            };
        }
    }
    const bodySchema = {
        type: 'object',
        properties: bodyProperties,
        additionalProperties: false,
    };
    const responseSchema = getResponseStructureSchema([200], {
        type: 'object',
        properties: bodyProperties,
    });
    const schema = {
        summary: `Edit authenticated user profile for ${capitalizeFirstLetter(model)}`,
        description: `Updates the profile of the currently authenticated user in the "${model}" table. Cannot update ${idField}, ${usernameField}, ${passwordField}, or ${isVerifiedField}.`,
        tags: policy.tags,
        body: bodySchema,
        response: responseSchema,
        security: [{ bearerAuth: [] }],
    };
    return schema;
}
//# sourceMappingURL=edit-me.js.map