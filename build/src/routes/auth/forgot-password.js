import { blockPasswordManagement } from '../../lib/auth/guards.js';
import { getUpAuth } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerForgotPasswordRoute(app, config) {
    const { models } = config.data;
    const upAuth = getUpAuth(config);
    if (!upAuth) {
        return;
    }
    const { model, usernameField } = upAuth;
    const authModelConfig = models[model];
    if (!authModelConfig)
        return;
    const targets = getApiRouteTargets(config, 'auth', model, 'unknown', 'forgotPassword');
    for (const { identifier, variant, policy } of targets) {
        registerForgotPasswordEndpoint(app, config, model, usernameField, variant, identifier, policy);
    }
}
function registerForgotPasswordEndpoint(app, config, model, usernameField, variant, apiIdentifier, policy) {
    const schema = generateSchema(usernameField, model, policy);
    const path = `/${variant}/auth/forgot-password`;
    app.post(path, {
        schema,
        config: { apiIdentifier },
    }, async (request, reply) => {
        const { [usernameField]: username } = request.body;
        /* c8 ignore start */
        if (!username) {
            return reply
                .status(400)
                .send(app.buildResponse(400, `${usernameField} is required`, null));
        }
        /* c8 ignore stop */
        const query = `SELECT * FROM "${model}" WHERE "${usernameField}" = $1 LIMIT 1;`;
        const res = await app.db.query(query, [String(username)]);
        if (res.rows.length === 0) {
            return reply
                .status(404)
                .send(app.buildResponse(404, 'User not found', null));
        }
        const user = res.rows[0];
        const blocked = blockPasswordManagement(reply, config, user, app.buildResponse);
        if (blocked) {
            return blocked;
        }
        const userEmail = String(user[usernameField]);
        const ulid = await app.otp.sendOTPForVerification(userEmail);
        return reply.status(200).send(app.buildResponse(200, 'OTP sent to your email.', {
            requiresMfa: true,
            ulid,
        }));
    });
}
function generateSchema(usernameField, model, policy) {
    const bodySchema = {
        type: 'object',
        required: [usernameField],
        properties: {
            [usernameField]: { type: 'string', description: 'The user identifier' },
        },
        additionalProperties: false,
    };
    const dataSchema = {
        type: 'object',
        properties: {
            requiresMfa: {
                type: 'boolean',
                description: 'Indicates MFA is required',
            },
            ulid: { type: 'string', description: 'OTP verification ULID' },
        },
    };
    const responseSchema = getResponseStructureSchema([200], dataSchema);
    const schema = {
        summary: `Forgot password for ${capitalizeFirstLetter(model)}`,
        description: "Sends an OTP to the user's email for password reset.",
        tags: policy.tags,
        body: bodySchema,
        response: responseSchema,
    };
    return schema;
}
//# sourceMappingURL=forgot-password.js.map