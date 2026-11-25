import { getUpAuth } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
function registerResendOtpBase(app, config, path, action) {
    const { models } = config.data;
    const upAuth = getUpAuth(config);
    if (!upAuth) {
        return;
    }
    const { model, usernameField } = upAuth;
    const authModelConfig = models[model];
    if (!authModelConfig)
        return;
    const operation = `resendOtp${capitalizeFirstLetter(action)}`;
    const targets = getApiRouteTargets(config, 'auth', model, 'unknown', operation);
    for (const { identifier, variant, policy } of targets) {
        registerResendOtpEndpoint(app, config, model, usernameField, action, path, variant, identifier, policy);
    }
}
function registerResendOtpEndpoint(app, config, model, usernameField, action, path, variant, apiIdentifier, policy) {
    const schema = generateSchema(usernameField, model, action, policy);
    const routePath = `/${variant}${path}`;
    app.post(routePath, {
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
        const userEmail = String(user[usernameField]);
        const ulid = await app.otp.sendOTPForVerification(userEmail);
        return reply.status(200).send(app.buildResponse(200, 'OTP resent to your email.', {
            requiresMfa: true,
            ulid,
        }));
    });
}
export function registerLoginResendOtpRoute(app, config) {
    registerResendOtpBase(app, config, '/auth/login/resend/otp', 'login');
}
export function registerRegistrationResendOtpRoute(app, config) {
    registerResendOtpBase(app, config, '/auth/register/resend/otp', 'register');
}
export function registerForgotPasswordResendOtpRoute(app, config) {
    registerResendOtpBase(app, config, '/auth/forgot-password/resend/otp', 'forgotPassword');
}
function generateSchema(usernameField, model, action, policy) {
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
        summary: `Resend OTP for ${capitalizeFirstLetter(model)} ${action}`,
        description: `Resends an OTP to the user's email for ${action}.`,
        tags: policy.tags,
        body: bodySchema,
        response: responseSchema,
    };
    return schema;
}
//# sourceMappingURL=resend-otp.js.map