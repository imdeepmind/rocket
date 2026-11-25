import { generateServiceProviderMetadata, SAML, ValidateInResponseTo, } from '@node-saml/node-saml';
import { SSO_STATE_TTL_SECONDS } from '../constants.js';
function isSaml(provider) {
    return provider.protocol === 'saml';
}
function cacheKey(providerName, key) {
    return `saml:${providerName}:${key}`;
}
/**
 * SAML's `InResponseTo` check requires remembering which request IDs were
 * issued, and the ACS arrives as a cross-site POST where `SameSite=Lax`
 * cookies are not sent. The cache is therefore the only correct store here.
 */
function cacheProvider(cache, providerName) {
    return {
        async saveAsync(key, value) {
            if (cache) {
                await cache.set(cacheKey(providerName, key), value, SSO_STATE_TTL_SECONDS);
            }
            return { value, createdAt: Date.now() };
        },
        async getAsync(key) {
            return cache ? cache.get(cacheKey(providerName, key)) : null;
        },
        async removeAsync(key) {
            if (!key || !cache) {
                return null;
            }
            const existing = await cache.get(cacheKey(providerName, key));
            await cache.delete(cacheKey(providerName, key));
            return existing;
        },
    };
}
function createClient(cache, provider, callbackUrl) {
    return new SAML({
        callbackUrl,
        entryPoint: provider.config.entryPoint,
        issuer: provider.config.issuer,
        idpCert: provider.config.cert,
        audience: provider.config.issuer,
        wantAssertionsSigned: true,
        validateInResponseTo: ValidateInResponseTo.always,
        cacheProvider: cacheProvider(cache, provider.name),
    });
}
export async function authorizeUrl(provider, callbackUrl, state, cache) {
    if (!isSaml(provider)) {
        throw new Error(`Provider ${provider.name} is not a SAML provider`);
    }
    const client = createClient(cache, provider, callbackUrl);
    return client.getAuthorizeUrlAsync(state.state, {});
}
export async function handleCallback(provider, callbackUrl, _state, request, cache) {
    if (!isSaml(provider)) {
        throw new Error(`Provider ${provider.name} is not a SAML provider`);
    }
    const body = (request.body ?? {});
    if (!body.SAMLResponse) {
        throw new Error('SAML response is missing');
    }
    const client = createClient(cache, provider, callbackUrl);
    const { profile, loggedOut } = await client.validatePostResponseAsync({
        SAMLResponse: body.SAMLResponse,
        ...(body.RelayState ? { RelayState: body.RelayState } : {}),
    });
    if (loggedOut || !profile?.nameID) {
        throw new Error('SAML response did not include a subject');
    }
    return {
        provider: provider.name,
        providerId: String(profile.nameID),
        claims: { ...profile },
    };
}
export function metadata(provider, callbackUrl) {
    if (!isSaml(provider)) {
        throw new Error(`Provider ${provider.name} is not a SAML provider`);
    }
    return generateServiceProviderMetadata({
        issuer: provider.config.issuer,
        callbackUrl,
    });
}
//# sourceMappingURL=saml.js.map