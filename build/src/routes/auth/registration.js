import { getUpAuth } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { generateJSONValidationSchema, stripAdditionalPostFields, } from '../../lib/schema/body.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
import { hash } from '../../utils/hash.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
export function registerRegistrationRoute(app, config) {
    const { models } = config.data;
    const upAuth = getUpAuth(config);
    if (!upAuth) {
        return;
    }
    const { model, passwordField } = upAuth;
    const requiresOtp = !!upAuth.isVerifiedField;
    const isVerifiedField = upAuth.isVerifiedField;
    const authModelConfig = models[model];
    if (!authModelConfig)
        return;
    const targets = getApiRouteTargets(config, 'auth', model, 'unknown', 'registration');
    for (const { identifier, variant, policy } of targets) {
        registerRegistrationEndpoint(app, config, model, authModelConfig, passwordField, isVerifiedField, requiresOtp, upAuth, variant, identifier, policy);
    }
}
function registerRegistrationEndpoint(app, config, model, authModelConfig, passwordField, isVerifiedField, requiresOtp, upAuth, variant, apiIdentifier, policy) {
    const schema = generateSchema(authModelConfig, passwordField, model, requiresOtp, isVerifiedField, policy);
    const path = `/${variant}/auth/register`;
    app.post(path, {
        schema,
        config: { apiIdentifier },
    }, async (request, reply) => {
        const incomingBody = request.body;
        const body = stripAdditionalPostFields(authModelConfig, incomingBody, {
            ignorePrimaryKey: true,
        });
        // Every identity row records which provider owns it. Without this the
        // password guardrails cannot distinguish SSO accounts.
        if (body[upAuth.providerField] === undefined) {
            body[upAuth.providerField] = 'up-auth';
        }
        /* c8 ignore start */
        if (body[passwordField] !== undefined && body[passwordField] !== null) {
            const rawPassword = String(body[passwordField]);
            body[passwordField] = await hash(rawPassword);
        }
        /* c8 ignore stop */
        if (isVerifiedField) {
            body[isVerifiedField] = false;
        }
        const keys = Object.keys(body);
        const values = Object.values(body);
        const columns = keys.map(key => `"${key}"`).join(', ');
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO "${model}" (${columns}) VALUES (${placeholders});`;
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
        if (requiresOtp) {
            const usernameField = upAuth.usernameField;
            const userEmail = String(incomingBody[usernameField]);
            const ulid = await app.otp.sendOTPForVerification(userEmail);
            return reply
                .status(201)
                .send(app.buildResponse(201, 'Registration successful. OTP sent to your email.', { requiresMfa: true, ulid }));
        }
        const responseData = {};
        for (const [k, v] of Object.entries(body)) {
            if (k !== passwordField) {
                responseData[k] = v;
            }
        }
        return reply
            .status(201)
            .send(app.buildResponse(201, `Successfully registered a new user in the ${model} table`, responseData));
    });
}
function generateSchema(authModelConfig, passwordField, model, requiresOtp, isVerifiedField, policy) {
    const bodyModelConfig = requiresOtp && isVerifiedField
        ? {
            ...authModelConfig,
            fields: Object.fromEntries(Object.entries(authModelConfig.fields).filter(([name]) => name !== isVerifiedField)),
        }
        : authModelConfig;
    const bodySchema = generateJSONValidationSchema(bodyModelConfig, {
        ignorePrimaryKey: true,
        additionalProperties: false,
        excludeTimestamps: true,
    });
    const responseData = requiresOtp
        ? {
            type: 'object',
            properties: { requiresMfa: { type: 'boolean' }, ulid: { type: 'string' } },
        }
        : generateJSONValidationSchema({
            ...authModelConfig,
            fields: Object.fromEntries(Object.entries(authModelConfig.fields).filter(([name]) => name !== passwordField)),
        }, {
            ignorePrimaryKey: true,
            additionalProperties: false,
            excludeTimestamps: true,
        });
    const responseSchema = getResponseStructureSchema([201], responseData);
    const schema = {
        summary: `Register a new ${capitalizeFirstLetter(model)} user`,
        description: `Creates a new user record in the "${model}" table. The password is hashed with bcrypt before being persisted.`,
        tags: policy.tags,
        body: bodySchema,
        response: responseSchema,
    };
    return schema;
}
//# sourceMappingURL=registration.js.map