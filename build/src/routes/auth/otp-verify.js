import { issueAccessToken } from '../../lib/auth/token.js';
import { getUpAuth } from '../../lib/auth/up-auth.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
import { buildUpdatedAtClause } from '../../lib/sql/timestamps.js';
import { hash } from '../../utils/hash.js';
import { capitalizeFirstLetter } from '../../utils/string.js';
function registerOtpVerifyBase(app, config, path, action) {
    const { models } = config.data;
    const upAuth = getUpAuth(config);
    if (!upAuth) {
        return;
    }
    const { model, usernameField } = upAuth;
    const authModelConfig = models[model];
    if (!authModelConfig)
        return;
    const operation = `otpVerify${capitalizeFirstLetter(action)}`;
    const targets = getApiRouteTargets(config, 'auth', model, 'unknown', operation);
    for (const { identifier, variant, policy } of targets) {
        registerOtpVerifyEndpoint(app, config, model, usernameField, upAuth, action, path, variant, identifier, policy);
    }
}
function registerOtpVerifyEndpoint(app, config, model, usernameField, upAuth, action, path, variant, apiIdentifier, policy) {
    const schema = generateSchema(usernameField, model, action, policy);
    const routePath = `/${variant}${path}`;
    app.post(routePath, {
        schema,
        config: { apiIdentifier },
    }, async (request, reply) => {
        const { ulid, otp, [usernameField]: username } = request.body;
        /* c8 ignore start */
        if (!ulid || !otp || !username) {
            return reply
                .status(400)
                .send(app.buildResponse(400, 'ulid, otp, and username are required', null));
        }
        /* c8 ignore stop */
        const isValid = await app.otp.verify(String(username), String(otp), String(ulid));
        if (!isValid) {
            return reply
                .status(401)
                .send(app.buildResponse(401, 'Invalid or expired OTP', null));
        }
        let hashedPassword;
        if (action === 'forgotPassword') {
            const newPassword = request.body
                .newPassword;
            /* c8 ignore start */
            if (!newPassword) {
                throw Object.assign(new Error('newPassword is required'), {
                    statusCode: 400,
                    body: app.buildResponse(400, 'newPassword is required', null),
                });
            }
            /* c8 ignore stop */
            hashedPassword = await hash(String(newPassword));
        }
        const selectQuery = `SELECT * FROM "${model}" WHERE "${usernameField}" = $1 LIMIT 1;`;
        let tx;
        try {
            tx = await app.db.beginTransaction();
            const res = await tx.query(selectQuery, [String(username)]);
            if (res.rows.length === 0) {
                throw Object.assign(new Error('User not found'), {
                    statusCode: 401,
                    body: app.buildResponse(401, 'User not found', null),
                });
            }
            if (action === 'register') {
                const isVerifiedField = upAuth.isVerifiedField;
                if (isVerifiedField) {
                    const updatedAtClause = buildUpdatedAtClause(config.data.models[model], config.infrastructure.database.engine);
                    const updateQuery = `UPDATE "${model}" SET "${isVerifiedField}" = true${updatedAtClause ? `, ${updatedAtClause}` : ''} WHERE "${usernameField}" = $1;`;
                    await tx.query(updateQuery, [String(username)]);
                }
                await tx.commit();
                return reply
                    .status(200)
                    .send(app.buildResponse(200, 'OTP verification successful', null));
            }
            if (action === 'forgotPassword') {
                const { passwordField } = upAuth;
                const updatedAtClause = buildUpdatedAtClause(config.data.models[model], config.infrastructure.database.engine);
                const updateQuery = `UPDATE "${model}" SET "${passwordField}" = $1${updatedAtClause ? `, ${updatedAtClause}` : ''} WHERE "${usernameField}" = $2;`;
                await tx.query(updateQuery, [hashedPassword, String(username)]);
                await tx.commit();
                return reply.status(200).send(app.buildResponse(200, 'OTP verification successful', {
                    success: true,
                }));
            }
            const user = res.rows[0];
            let rbacUser = user;
            if (config.rbac?.enabled &&
                config.rbac.modelName &&
                config.rbac.modelName !== model) {
                const rbacQuery = `SELECT * FROM "${config.rbac.modelName}" WHERE "${upAuth.idField}" = $1 LIMIT 1;`;
                const rbacRes = await tx.query(rbacQuery, [user[upAuth.idField]]);
                rbacUser = rbacRes.rows[0] ?? user;
            }
            const token = issueAccessToken(app.jwt, config, user, usernameField, rbacUser);
            await tx.commit();
            return reply.status(200).send(app.buildResponse(200, 'OTP verification successful', {
                accessToken: token,
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
export function registerLoginOtpVerifyRoute(app, config) {
    registerOtpVerifyBase(app, config, '/auth/login/verify/otp', 'login');
}
export function registerRegistrationOtpVerifyRoute(app, config) {
    registerOtpVerifyBase(app, config, '/auth/register/verify/otp', 'register');
}
function generateSchema(usernameField, model, action, policy) {
    const isForgotPassword = action === 'forgotPassword';
    const bodySchema = {
        type: 'object',
        required: isForgotPassword
            ? ['ulid', 'otp', usernameField, 'newPassword']
            : ['ulid', 'otp', usernameField],
        properties: {
            ulid: {
                type: 'string',
                description: 'The ULID from the OTP send response',
            },
            otp: { type: 'string', description: 'The OTP sent to the user email' },
            [usernameField]: { type: 'string', description: 'The user identifier' },
            ...(isForgotPassword
                ? {
                    newPassword: {
                        type: 'string',
                        description: 'The new password to set',
                    },
                }
                : {}),
        },
        additionalProperties: false,
    };
    const dataSchema = action === 'login'
        ? {
            type: 'object',
            properties: {
                accessToken: { type: 'string', description: 'JWT access token' },
            },
        }
        : action === 'forgotPassword'
            ? {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                },
            }
            : {
                type: 'object',
                properties: {},
                nullable: true,
            };
    const responseSchema = getResponseStructureSchema([200], dataSchema);
    const schema = {
        summary: `Verify OTP for ${capitalizeFirstLetter(model)} ${action}`,
        description: `Verifies the OTP sent to the user's email during ${action}.`,
        tags: policy.tags,
        body: bodySchema,
        response: responseSchema,
    };
    return schema;
}
export function registerForgotPasswordOtpVerifyRoute(app, config) {
    registerOtpVerifyBase(app, config, '/auth/forgot-password/verify/otp', 'forgotPassword');
}
//# sourceMappingURL=otp-verify.js.map