import { blockPasswordManagement } from '../../lib/auth/guards.js';
import { getUpAuth } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { buildUpdatedAtClause } from '../../lib/sql/timestamps.js';
import { compare, hash } from '../../utils/hash.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerChangePasswordRoute(app, config) {
    const { models } = config.data;
    const upAuth = getUpAuth(config);
    if (!upAuth) {
        return;
    }
    const { model, idField, passwordField } = upAuth;
    const authModelConfig = models[model];
    if (!authModelConfig)
        return;
    const targets = getApiRouteTargets(config, 'auth', model, 'unknown', 'changePassword');
    for (const { identifier, variant, policy } of targets) {
        registerChangePasswordEndpoint(app, config, model, idField, passwordField, variant, identifier, policy);
    }
}
function registerChangePasswordEndpoint(app, config, model, idField, passwordField, variant, apiIdentifier, policy) {
    const schema = generateSchema(model, policy);
    const path = `/${variant}/auth/change-password`;
    app.post(path, {
        schema,
        config: { apiIdentifier },
        preValidation: buildPreValidation(app, config, true),
    }, async (request, reply) => {
        const { existingPassword, newPassword } = request.body;
        const userPayload = request.user;
        const userId = userPayload.id;
        if (!userId) {
            return reply
                .status(401)
                .send(app.buildResponse(401, 'User ID missing in token payload', null));
        }
        const selectQuery = `SELECT * FROM "${model}" WHERE "${idField}" = $1 LIMIT 1;`;
        const res = await app.db.query(selectQuery, [userId]);
        if (res.rows.length === 0) {
            throw Object.assign(new Error('User not found'), {
                statusCode: 404,
                body: app.buildResponse(404, 'User not found', null),
            });
        }
        const user = res.rows[0];
        const blocked = blockPasswordManagement(reply, config, user, app.buildResponse);
        if (blocked) {
            return blocked;
        }
        const currentHashedPassword = user[passwordField];
        const isMatch = await compare(String(existingPassword), currentHashedPassword);
        if (!isMatch) {
            throw Object.assign(new Error('Invalid existing password'), {
                statusCode: 401,
                body: app.buildResponse(401, 'Invalid existing password', null),
            });
        }
        const newHashedPassword = await hash(String(newPassword));
        const updatedAtClause = buildUpdatedAtClause(config.data.models[model], config.infrastructure.database.engine);
        const updateQuery = `UPDATE "${model}" SET "${passwordField}" = $1${updatedAtClause ? `, ${updatedAtClause}` : ''} WHERE "${idField}" = $2;`;
        let tx;
        try {
            tx = await app.db.beginTransaction();
            await tx.query(updateQuery, [newHashedPassword, userId]);
            await tx.commit();
            return reply.status(200).send(app.buildResponse(200, 'Password changed successfully', {
                success: true,
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
function generateSchema(model, policy) {
    const bodySchema = {
        type: 'object',
        required: ['existingPassword', 'newPassword'],
        properties: {
            existingPassword: {
                type: 'string',
                description: 'The current user password',
            },
            newPassword: {
                type: 'string',
                description: 'The new user password to set',
            },
        },
        additionalProperties: false,
    };
    const responseSchema = getResponseStructureSchema([200], {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
        },
    });
    const schema = {
        summary: `Change password for ${capitalizeFirstLetter(model)}`,
        description: `Changes the password for an authenticated user in the "${model}" table.`,
        tags: policy.tags,
        body: bodySchema,
        response: responseSchema,
        security: [{ bearerAuth: [] }],
    };
    return schema;
}
//# sourceMappingURL=change-password.js.map