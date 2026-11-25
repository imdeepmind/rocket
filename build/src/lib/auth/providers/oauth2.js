import { randomToken } from '../state.js';
function isOAuth2(provider) {
    return provider.protocol === 'oauth2';
}
async function requestToken(provider, callbackUrl, code) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: provider.config.clientId,
        client_secret: provider.config.clientSecret,
    });
    const response = await fetch(provider.config.tokenUrl, {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    if (!response.ok) {
        throw new Error('Token endpoint rejected the authorization code');
    }
    const payload = (await response.json());
    if (!payload.access_token) {
        throw new Error('Token endpoint did not return an access token');
    }
    return payload.access_token;
}
async function requestClaims(provider, accessToken) {
    if (!provider.config.userInfoUrl) {
        return {};
    }
    const response = await fetch(provider.config.userInfoUrl, {
        headers: {
            accept: 'application/json',
            authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        throw new Error('Userinfo endpoint rejected the access token');
    }
    return (await response.json());
}
function extractSubject(provider, claims) {
    const candidates = provider.config.idClaim
        ? [provider.config.idClaim]
        : ['sub', 'id', 'user_id', 'login'];
    for (const candidate of candidates) {
        const value = claims[candidate];
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
        if (typeof value === 'number') {
            return String(value);
        }
    }
    return undefined;
}
export async function authorizeUrl(provider, callbackUrl, state) {
    if (!isOAuth2(provider)) {
        throw new Error(`Provider ${provider.name} is not an OAuth2 provider`);
    }
    state.nonce = randomToken();
    const url = new URL(provider.config.authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', provider.config.clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('state', state.state);
    if (provider.config.scopes.length > 0) {
        url.searchParams.set('scope', provider.config.scopes.join(' '));
    }
    return url.toString();
}
export async function handleCallback(provider, callbackUrl, _state, request) {
    if (!isOAuth2(provider)) {
        throw new Error(`Provider ${provider.name} is not an OAuth2 provider`);
    }
    const query = request.query;
    if (typeof query.error === 'string') {
        throw new Error('Identity provider returned an error');
    }
    const code = query.code;
    if (typeof code !== 'string' || code.length === 0) {
        throw new Error('Authorization response did not include a code');
    }
    const accessToken = await requestToken(provider, callbackUrl, code);
    const claims = await requestClaims(provider, accessToken);
    const subject = extractSubject(provider, claims);
    if (!subject) {
        throw new Error('Identity provider did not return a subject');
    }
    return {
        provider: provider.name,
        providerId: subject,
        claims,
    };
}
//# sourceMappingURL=oauth2.js.map