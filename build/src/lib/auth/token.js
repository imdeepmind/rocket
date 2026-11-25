import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { extractJwtRolePayload } from '../../lib/rbac/index.js';
import { SSO_EXCHANGE_AUDIENCE, SSO_EXCHANGE_CODE_TTL_SECONDS, SSO_EXCHANGE_INFO, SSO_EXCHANGE_ISSUER, } from './constants.js';
import { deriveKey } from './state.js';
function getSecret(config) {
    const { authentication } = config;
    if (!authentication.enabled || !authentication.jwtSecret) {
        throw new Error('Authentication is not enabled');
    }
    return authentication.jwtSecret;
}
/**
 * Issue the standard Rocket access token. Identical for every provider type -
 * this is the convergence point of the two authentication flows.
 */
export function issueAccessToken(signer, config, user, usernameField, roleUser = user, providerIdField) {
    const { authentication } = config;
    if (!authentication.enabled || !authentication.userModel) {
        throw new Error('Authentication is not enabled');
    }
    let email = null;
    if (usernameField && user[usernameField] !== undefined) {
        email = user[usernameField];
    }
    else if (user.email !== undefined) {
        email = user.email;
    }
    const payload = {
        id: user[authentication.userModel.idField],
        providerId: providerIdField && user[providerIdField] !== undefined
            ? user[providerIdField]
            : null,
        email: email ?? null,
        ...extractJwtRolePayload(roleUser, config.rbac),
    };
    if (usernameField) {
        payload[usernameField] = user[usernameField] ?? null;
    }
    return signer.sign(payload, {
        expiresIn: authentication.tokenExpiration,
    });
}
/**
 * Issue a short-lived, purpose-bound code that the browser carries back to the
 * frontend after an SSO callback. It is signed with a derived key, so it can
 * never be presented as an access token.
 */
export function issueExchangeCode(config, provider, subject) {
    return jwt.sign({ provider, sub: subject, jti: crypto.randomUUID() }, deriveKey(getSecret(config), SSO_EXCHANGE_INFO), {
        expiresIn: SSO_EXCHANGE_CODE_TTL_SECONDS,
        issuer: SSO_EXCHANGE_ISSUER,
        audience: SSO_EXCHANGE_AUDIENCE,
    });
}
export async function readExchangeCode(config, provider, code, cache) {
    const decoded = jwt.verify(code, deriveKey(getSecret(config), SSO_EXCHANGE_INFO), {
        issuer: SSO_EXCHANGE_ISSUER,
        audience: SSO_EXCHANGE_AUDIENCE,
    });
    if (typeof decoded !== 'object' ||
        decoded === null ||
        decoded.provider !== provider ||
        typeof decoded.sub !== 'string') {
        throw new Error('Invalid exchange code');
    }
    if (cache) {
        const jti = decoded.jti ||
            /* c8 ignore next - fallback when code lacks jti */
            crypto.createHash('sha256').update(code).digest('hex');
        const cacheKey = `sso:exchange:${provider}:${jti}`;
        const alreadyUsed = await cache.get(cacheKey);
        if (alreadyUsed) {
            throw new Error('Exchange code has already been used');
        }
        await cache.set(cacheKey, '1', SSO_EXCHANGE_CODE_TTL_SECONDS);
    }
    return String(decoded.sub);
}
//# sourceMappingURL=token.js.map