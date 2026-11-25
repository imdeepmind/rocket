import { getApiRouteTargets } from '../../lib/config/api.js';
import { generateJSONValidationSchema, stripAdditionalPostFields, } from '../../lib/schema/body.js';
import { buildSecurityArray, getResponseStructureSchema, } from '../../lib/schema/response.js';
import { getPublicFields } from '../../lib/schema/types.js';
import { buildPreValidation } from '../../lib/server/prevalidation.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerPostRoutes(app, config) {
    const { models } = config.data;
    for (const [modelName, model] of Object.entries(models)) {
        const targets = getApiRouteTargets(config, 'model', modelName, 'unknown', 'insert');
        for (const { identifier, variant, policy } of targets) {
            registerPostEndpoint(app, config, modelName, model, variant, identifier, policy);
        }
    }
}
function registerPostEndpoint(app, config, modelName, model, variant, apiIdentifier, policy) {
    const schema = generateSchema(model, modelName, config, policy);
    const path = `/${variant}/${modelName}/`;
    app.post(path, {
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
        const tableName = modelName;
        const incomingBody = request.body;
        const body = stripAdditionalPostFields(model, incomingBody, {
            ignorePrimaryKey: true,
        });
        const publicFieldNames = new Set(getPublicFields(model, policy.bypassSecret).map(([name]) => name));
        const responseBody = {};
        for (const [key, value] of Object.entries(body)) {
            if (publicFieldNames.has(key)) {
                responseBody[key] = value;
            }
        }
        const keys = Object.keys(body);
        const values = Object.values(body);
        const columns = keys.map(key => `"${key}"`).join(', ');
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders});`;
        let tx;
        try {
            tx = await app.db.beginTransaction();
            await tx.query(query, values);
            await tx.commit();
            return reply
                .status(201)
                .send(app.buildResponse(201, `Successfully added the new entry to the ${tableName} table`, responseBody));
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
    const bodySchema = generateJSONValidationSchema(model, {
        ignorePrimaryKey: true,
        additionalProperties: false,
        excludeTimestamps: true,
    });
    const responseSchema = generateJSONValidationSchema(model, {
        ignorePrimaryKey: true,
        additionalProperties: false,
        excludeSecretFields: !policy.bypassSecret,
        excludeTimestamps: true,
    });
    const schema = {
        summary: `Create a new ${capitalizeFirstLetter(modelName)} record`,
        description: `Create a new ${capitalizeFirstLetter(modelName)} record in the database`,
        tags: policy.tags,
        body: bodySchema,
        response: getResponseStructureSchema([201], responseSchema),
    };
    const security = buildSecurityArray(config, policy.authorization);
    if (security.length > 0) {
        schema.security = security;
    }
    return schema;
}
//# sourceMappingURL=post.js.map