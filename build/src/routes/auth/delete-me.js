import { getActiveUserModel } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerDeleteMeRoute(app, config) {
    const { models } = config.data;
    const userModel = getActiveUserModel(config);
    if (!userModel) {
        return;
    }
    const { modelName: model, idField } = userModel;
    const authModelConfig = models[model];
    if (!authModelConfig)
        return;
    const targets = getApiRouteTargets(config, 'auth', model, 'unknown', 'deleteMe');
    for (const { identifier, variant, policy } of targets) {
        registerDeleteMeEndpoint(app, config, model, idField, variant, identifier, policy);
    }
}
function registerDeleteMeEndpoint(app, config, model, idField, variant, apiIdentifier, policy) {
    const schema = generateSchema(model, policy);
    const path = `/${variant}/auth/user/me`;
    app.delete(path, {
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
            const deleteQuery = `DELETE FROM "${model}" WHERE "${idField}" = $1;`;
            await tx.query(deleteQuery, [userId]);
            await tx.commit();
            return reply.status(200).send(app.buildResponse(200, 'User profile deleted successfully', {
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
    const responseSchema = getResponseStructureSchema([200], {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
        },
    });
    const schema = {
        summary: `Delete authenticated user profile for ${capitalizeFirstLetter(model)}`,
        description: `Permanently deletes the currently authenticated user from the "${model}" table.`,
        tags: policy.tags,
        response: responseSchema,
        security: [{ bearerAuth: [] }],
    };
    return schema;
}
//# sourceMappingURL=delete-me.js.map