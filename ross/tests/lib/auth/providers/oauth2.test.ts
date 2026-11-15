import {afterEach, describe, expect, test, vi} from 'vitest';

import {authorizeUrl, handleCallback} from '@/lib/auth/providers/oauth2';
import {randomToken} from '@/lib/auth/state';

import {ResolvedSsoProvider} from '@/interfaces/config';

import {
  buildEnabledAuth,
  oauth2Provider,
  oidcProvider,
} from '@tests/helpers/auth-config';

const providersOf = (providers: unknown[]): ResolvedSsoProvider[] => {
  const auth = buildEnabledAuth(providers).authentication;

  if (!auth.enabled) {
    throw new Error('expected enabled authentication');
  }

  return auth.providers as ResolvedSsoProvider[];
};

const [oauth2] = providersOf([oauth2Provider]);
const callbackUrl = 'https://api.example.com/api/v1/auth/sso/github/callback';

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
});

const buildState = () => ({
  state: randomToken(),
  nonce: randomToken(),
  provider: 'github',
  issuedAt: Date.now(),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('oauth2 authorizeUrl', () => {
  test('builds the authorization redirect', async () => {
    const state = buildState();

    const url = new URL(await authorizeUrl(oauth2, callbackUrl, state));

    expect(url.origin + url.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(callbackUrl);
    expect(url.searchParams.get('state')).toBe(state.state);
    expect(url.searchParams.get('scope')).toBe('read:user');
    expect(state.nonce).not.toBe('');
  });

  test('omits the scope parameter when none are configured', async () => {
    const provider = {
      ...oauth2,
      config: {...oauth2.config, scopes: []},
    } as ResolvedSsoProvider;

    const url = new URL(
      await authorizeUrl(provider, callbackUrl, buildState()),
    );

    expect(url.searchParams.has('scope')).toBe(false);
  });

  test('rejects a non-oauth2 provider', async () => {
    const [oidc] = providersOf([oidcProvider]);

    await expect(authorizeUrl(oidc, callbackUrl, buildState())).rejects.toThrow(
      'is not an OAuth2 provider',
    );
  });
});

describe('oauth2 handleCallback', () => {
  const request = (query: Record<string, unknown>) => ({query}) as never;

  test('exchanges the code and returns the subject', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
      .mockResolvedValueOnce(jsonResponse({id: 7, login: 'octocat'}));
    vi.stubGlobal('fetch', fetchMock);

    const identity = await handleCallback(
      oauth2,
      callbackUrl,
      buildState(),
      request({code: 'abc'}),
    );

    expect(identity).toEqual({
      provider: 'github',
      providerId: '7',
      claims: {id: 7, login: 'octocat'},
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('uses the configured idClaim', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({sub: 's-1', id: 7})),
    );

    const provider = {
      ...oauth2,
      config: {...oauth2.config, idClaim: 'sub'},
    } as ResolvedSsoProvider;

    const identity = await handleCallback(
      provider,
      callbackUrl,
      buildState(),
      request({code: 'abc'}),
    );

    expect(identity.providerId).toBe('s-1');
  });

  test('falls back to user_id then login', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({user_id: 'u-1'}))
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({login: 'octocat'})),
    );

    const first = await handleCallback(
      oauth2,
      callbackUrl,
      buildState(),
      request({code: 'abc'}),
    );
    const second = await handleCallback(
      oauth2,
      callbackUrl,
      buildState(),
      request({code: 'abc'}),
    );

    expect(first.providerId).toBe('u-1');
    expect(second.providerId).toBe('octocat');
  });

  test('requires an authorization code', async () => {
    await expect(
      handleCallback(oauth2, callbackUrl, buildState(), request({})),
    ).rejects.toThrow('did not include a code');
  });

  test('rejects when provider returns an error', async () => {
    await expect(
      handleCallback(
        oauth2,
        callbackUrl,
        buildState(),
        request({error: 'access_denied'}),
      ),
    ).rejects.toThrow('Identity provider returned an error');
  });

  test('rejects a non-oauth2 provider', async () => {
    const [oidc] = providersOf([oidcProvider]);

    await expect(
      handleCallback(oidc, callbackUrl, buildState(), request({code: 'a'})),
    ).rejects.toThrow('is not an OAuth2 provider');
  });

  test('rejects a failed token response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)));

    await expect(
      handleCallback(oauth2, callbackUrl, buildState(), request({code: 'abc'})),
    ).rejects.toThrow('Token endpoint rejected');
  });

  test('rejects a token response without an access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));

    await expect(
      handleCallback(oauth2, callbackUrl, buildState(), request({code: 'abc'})),
    ).rejects.toThrow('did not return an access token');
  });

  test('rejects a failed userinfo response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({access_token: 'token'}))
        .mockResolvedValueOnce(jsonResponse({}, false)),
    );

    await expect(
      handleCallback(oauth2, callbackUrl, buildState(), request({code: 'abc'})),
    ).rejects.toThrow('Userinfo endpoint rejected');
  });

  test('rejects a response without any subject claim', async () => {
    const provider = {
      ...oauth2,
      config: {...oauth2.config, userInfoUrl: undefined},
    } as ResolvedSsoProvider;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({access_token: 'token'})),
    );

    await expect(
      handleCallback(
        provider,
        callbackUrl,
        buildState(),
        request({code: 'abc'}),
      ),
    ).rejects.toThrow('did not return a subject');
  });
});
