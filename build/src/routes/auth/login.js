import { blockPasswordManagement } from '../../lib/auth/guards.js';
import { issueAccessToken } from '../../lib/auth/token.js';
import { getUpAuth } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
import { compare } from '../../utils/hash.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
import { DUMMY_PASSWORD_HASH } from '../../constants.js';
export function registerLoginRoute(app, config) {
    const { models } = config.data;
    const upAuth = getUpAuth(config);
    if (!upAuth) {
        return;
    }
    const { model, usernameField, passwordField } = upAuth;
    const authModelConfig = models[model];
    if (!authModelConfig)
        return;
    const targets = getApiRouteTargets(config, 'auth', model, 'unknown', 'login');
    for (const { identifier, variant, policy } of targets) {
        registerLoginEndpoint(app, config, model, usernameField, passwordField, upAuth, variant, identifier, policy);
    }
}
function registerLoginEndpoint(app, config, model, usernameField, passwordField, upAuth, variant, apiIdentifier, policy) {
    const schema = generateSchema(usernameField, passwordField, model, upAuth.mfaRequired ?? false, policy);
    const path = `/${variant}/auth/login`;
    app.post(path, {
        schema,
        config: { apiIdentifier },
    }, async (request, reply) => {
        const { [usernameField]: username, [passwordField]: password } = request.body;
        const query = `SELECT * FROM "${model}" WHERE "${usernameField}" = $1 LIMIT 1;`;
        const res = await app.db.query(query, [username]);
        const user = res.rows[0];
        if (user) {
            const blocked = blockPasswordManagement(reply, config, user, app.buildResponse);
            if (blocked) {
                return blocked;
            }
        }
        const hashedPassword = user?.[passwordField] || DUMMY_PASSWORD_HASH;
        const isMatch = await compare(String(password), hashedPassword);
        if (!user || !isMatch) {
            return reply
                .status(401)
                .send(app.buildResponse(401, 'Invalid username or password', null));
        }
        const { isVerifiedField } = upAuth;
        if (isVerifiedField && Boolean(user[isVerifiedField]) !== true) {
            return reply
                .status(401)
                .send(app.buildResponse(401, 'User is not verified', null));
        }
        if (upAuth.mfaRequired) {
            const userEmail = String(user[usernameField]);
            const ulid = await app.otp.sendOTPForVerification(userEmail);
            return reply.status(200).send(app.buildResponse(200, 'Login successful. OTP sent to your email.', {
                requiresMfa: true,
                ulid,
            }));
        }
        let rbacUser = user;
        if (config.rbac?.enabled &&
            config.rbac.modelName &&
            config.rbac.modelName !== model) {
            const rbacQuery = `SELECT * FROM "${config.rbac.modelName}" WHERE "${upAuth.idField}" = $1 LIMIT 1;`;
            const rbacRes = await app.db.query(rbacQuery, [user[upAuth.idField]]);
            rbacUser = rbacRes.rows[0] ?? user;
        }
        const token = issueAccessToken(app.jwt, config, user, usernameField, rbacUser);
        return reply.status(200).send(app.buildResponse(200, 'Login successful', {
            accessToken: token,
        }));
    });
}
function generateSchema(usernameField, passwordField, model, mfaRequired, policy) {
    const bodySchema = {
        type: 'object',
        required: [usernameField, passwordField],
        properties: {
            [usernameField]: { type: 'string', description: 'The user identifier' },
            [passwordField]: { type: 'string', description: 'The user password' },
        },
        additionalProperties: false,
    };
    const dataSchema = {
        type: 'object',
        properties: mfaRequired
            ? {
                requiresMfa: {
                    type: 'boolean',
                    description: 'Indicates MFA is required',
                },
                ulid: { type: 'string', description: 'OTP verification ULID' },
            }
            : {
                accessToken: { type: 'string', description: 'JWT access token' },
            },
    };
    const responseSchema = getResponseStructureSchema([200], dataSchema);
    const schema = {
        summary: `Login for ${capitalizeFirstLetter(model)}`,
        description: `Authenticates a user from the "${model}" table and returns a JWT access token.`,
        tags: policy.tags,
        body: bodySchema,
        response: responseSchema,
    };
    return schema;
}
//# sourceMappingURL=login.js.map