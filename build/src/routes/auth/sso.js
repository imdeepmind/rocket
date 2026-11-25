import { resolveCallbackUrl } from '../../lib/auth/callback-url.js';
import { SSO_STATE_INFO } from '../../lib/auth/constants.js';
import { clearStateCookie, readStateCookie, setStateCookie, } from '../../lib/auth/cookie.js';
import { getAdapter } from '../../lib/auth/providers/index.js';
import { buildRedirectUrl } from '../../lib/auth/redirect.js';
import { openState, randomToken, safeEqual, sealState, } from '../../lib/auth/state.js';
import { issueAccessToken, issueExchangeCode, readExchangeCode, } from '../../lib/auth/token.js';
import { getSsoProviders } from '../../lib/auth/up-auth.js';
import { resolveUserByIdentity } from '../../lib/auth/user.js';
import { getApiRouteTargets } from '../../lib/config/api.js';
import { getResponseStructureSchema } from '../../lib/schema/response.js';
export function registerSsoRoutes(app, config) {
    const providers = getSsoProviders(config);
    if (providers.length === 0) {
        return;
    }
    const { authentication } = config;
    /* c8 ignore start - a non-empty SSO list implies enabled authentication */
    if (!authentication.enabled) {
        return;
    }
    const authModel = authentication.userModel?.modelName;
    if (!authModel) {
        return;
    }
    /* c8 ignore stop */
    const operations = [
        'ssoLogin',
        'ssoCallback',
        'ssoToken',
        'ssoMetadata',
    ];
    for (const operation of operations) {
        const targets = getApiRouteTargets(config, 'auth', authModel, 'unknown', operation);
        if (targets.length === 0) {
            continue;
        }
        for (const { identifier, variant, policy } of targets) {
            for (const provider of providers) {
                registerProviderOperation(app, config, provider, operation, variant, identifier, policy);
            }
        }
    }
}
function registerProviderOperation(app, config, provider, operation, variant, apiIdentifier, policy) {
    const base = `/${variant}/auth/sso/${provider.name}`;
    switch (operation) {
        case 'ssoLogin':
            app.get(`${base}/login`, {
                schema: buildSchema('Start an SSO login', policy),
                config: { apiIdentifier },
            }, async (request, reply) => startLogin(app, config, provider, request, reply));
            return;
        case 'ssoCallback':
            if (provider.protocol === 'saml') {
                app.post(`${base}/callback`, {
                    schema: buildSchema('SAML assertion consumer service', policy),
                    config: { apiIdentifier },
                }, async (request, reply) => completeLogin(app, config, provider, request, reply));
                return;
            }
            app.get(`${base}/callback`, {
                schema: buildSchema('Complete an SSO login', policy),
                config: { apiIdentifier },
            }, async (request, reply) => completeLogin(app, config, provider, request, reply));
            return;
        case 'ssoToken':
            if (!provider.config.redirectUrl) {
                return;
            }
            app.post(`${base}/token`, {
                schema: buildTokenSchema(policy),
                config: { apiIdentifier },
            }, async (request, reply) => exchange(app, config, provider, request, reply));
            return;
        case 'ssoMetadata':
            if (provider.protocol !== 'saml') {
                return;
            }
            app.get(`${base}/metadata`, {
                schema: buildSchema('SAML service provider metadata', policy),
                config: { apiIdentifier },
            }, async (request, reply) => {
                const callbackUrl = resolveCallbackUrl(request, provider);
                const metadata = getAdapter(provider).metadata?.(provider, callbackUrl);
                if (!metadata) {
                    return reply
                        .status(404)
                        .send(app.buildResponse(404, 'Metadata is not available', null));
                }
                return reply.type('application/xml').send(metadata);
            });
    }
}
async function startLogin(app, config, provider, request, reply) {
    const secret = jwtSecret(config);
    if (!secret) {
        return reply
            .status(500)
            .send(app.buildResponse(500, 'Authentication is not configured', null));
    }
    const callbackUrl = resolveCallbackUrl(request, provider);
    const state = {
        state: randomToken(),
        nonce: randomToken(),
        provider: provider.name,
        issuedAt: Date.now(),
    };
    const url = await getAdapter(provider).authorizeUrl(provider, callbackUrl, state, app.cache);
    // The adapter may have attached a PKCE verifier; seal only after that.
    setStateCookie(reply, provider.name, sealState(secret, SSO_STATE_INFO, state));
    return reply.redirect(url, 302);
}
function extractUsername(claims, field) {
    if (!field || !claims) {
        return undefined;
    }
    const candidateKeys = [
        field,
        'email',
        'preferred_username',
        'upn',
        'username',
    ];
    for (const key of candidateKeys) {
        const val = claims[key];
        if (typeof val === 'string' && val.length > 0) {
            return val;
        }
    }
    return undefined;
}
async function completeLogin(app, config, provider, request, reply) {
    const secret = jwtSecret(config);
    const fail = (reason, description) => failure(app, provider, reply, reason, description);
    if (!secret) {
        return reply
            .status(500)
            .send(app.buildResponse(500, 'Authentication is not configured', null));
    }
    let state;
    if (provider.protocol === 'saml') {
        // The SAML ACS is a cross-site POST, so `SameSite=Lax` cookies are not
        // sent. Correlation is handled by node-saml through the cache-backed
        // `InResponseTo` check instead of the state cookie.
        const relayState = request.body
            ?.RelayState;
        state = {
            state: relayState ?? '',
            nonce: '',
            provider: provider.name,
            issuedAt: Date.now(),
        };
    }
    else {
        const sealed = readStateCookie(request, provider.name);
        clearStateCookie(reply, provider.name);
        if (!sealed) {
            return fail('missing_state');
        }
        try {
            state = openState(secret, SSO_STATE_INFO, sealed);
        }
        catch {
            return fail('invalid_state');
        }
        /* c8 ignore start - the state cookie is provider scoped */
        if (state.provider !== provider.name) {
            return fail('invalid_state');
        }
        /* c8 ignore stop */
        const queryState = request.query.state;
        if (typeof queryState !== 'string' || !safeEqual(queryState, state.state)) {
            return fail('invalid_state');
        }
    }
    const { authentication } = config;
    /* c8 ignore start - a registered SSO route implies a user model */
    if (!authentication.enabled || !authentication.userModel) {
        return fail('not_configured');
    }
    /* c8 ignore stop */
    const callbackUrl = resolveCallbackUrl(request, provider);
    let identity;
    try {
        identity = await getAdapter(provider).handleCallback(provider, callbackUrl, state, request, app.cache);
    }
    catch (err) {
        const query = request.query;
        const idpError = typeof query.error === 'string' ? query.error : 'provider_error';
        const idpDesc = typeof query.error_description === 'string'
            ? query.error_description
            : err.message;
        return fail(idpError, idpDesc);
    }
    try {
        const usernameField = provider.config.fields.usernameField;
        const username = extractUsername(identity.claims, usernameField);
        const user = await resolveUserByIdentity(app.db, {
            model: authentication.userModel.modelName,
            providerField: authentication.userModel.providerField,
            providerName: provider.name,
            providerIdField: provider.config.fields.providerIdField,
            providerId: identity.providerId,
            usernameField,
            username,
            attributeMapping: provider.config.attributeMapping,
            claims: identity.claims,
        });
        if (provider.config.redirectUrl) {
            const subject = String(user[authentication.userModel.idField]);
            const code = issueExchangeCode(config, provider.name, subject);
            return reply.redirect(buildRedirectUrl(provider.config.redirectUrl, { code }), 302);
        }
        const accessToken = issueAccessToken(app.jwt, config, user, provider.config.fields.usernameField, user, provider.config.fields.providerIdField);
        return reply
            .status(200)
            .send(app.buildResponse(200, 'SSO authentication successful', { accessToken }));
    }
    catch (err) {
        if (err.code === 'ACCOUNT_COLLISION') {
            return fail('account_already_exists', 'An account with this email/username already exists');
        }
        return fail('user_resolution_failed');
    }
}
async function exchange(app, config, provider, request, reply) {
    const { code } = request.body;
    let subject;
    try {
        subject = await readExchangeCode(config, provider.name, code, app.cache);
    }
    catch {
        return reply
            .status(401)
            .send(app.buildResponse(401, 'Invalid or expired code', null));
    }
    const { authentication } = config;
    /* c8 ignore start - a registered SSO route implies a user model */
    if (!authentication.enabled || !authentication.userModel) {
        return reply
            .status(500)
            .send(app.buildResponse(500, 'Authentication is not configured', null));
    }
    /* c8 ignore stop */
    const { modelName, idField } = authentication.userModel;
    const result = await app.db.query(`SELECT * FROM "${modelName}" WHERE "${idField}" = $1 LIMIT 1;`, [subject]);
    const user = result.rows[0];
    if (!user) {
        return reply
            .status(401)
            .send(app.buildResponse(401, 'Invalid or expired code', null));
    }
    const accessToken = issueAccessToken(app.jwt, config, user, provider.config.fields.usernameField, user, provider.config.fields.providerIdField);
    return reply
        .status(200)
        .send(app.buildResponse(200, 'SSO authentication successful', { accessToken }));
}
function failure(app, provider, reply, reason, description) {
    if (provider.config.redirectUrl) {
        const target = provider.config.failureRedirectUrl ?? provider.config.redirectUrl;
        return reply.redirect(buildRedirectUrl(target, {
            error: reason,
            error_description: description,
        }), 302);
    }
    const message = description
        ? `SSO authentication failed: ${description}`
        : 'SSO authentication failed';
    return reply.status(400).send(app.buildResponse(400, message, null));
}
function jwtSecret(config) {
    const { authentication } = config;
    /* c8 ignore next - SSO routes only exist when authentication is enabled */
    if (!authentication.enabled) {
        return undefined;
    }
    return authentication.jwtSecret;
}
function buildSchema(summary, policy) {
    return {
        summary,
        tags: policy.tags,
    };
}
function buildTokenSchema(policy) {
    return {
        summary: 'Exchange a one-time code for an access token',
        tags: policy.tags,
        body: {
            type: 'object',
            required: ['code'],
            additionalProperties: false,
            properties: {
                code: { type: 'string', description: 'One-time SSO exchange code' },
            },
        },
        response: getResponseStructureSchema([200], {
            type: 'object',
            properties: {
                accessToken: { type: 'string', description: 'JWT access token' },
            },
        }),
    };
}
//# sourceMappingURL=sso.js.map