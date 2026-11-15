import {afterEach, describe, expect, test, vi} from 'vitest';

import {ResolvedSsoProvider} from '@/interfaces/config';

import {
  buildEnabledAuth,
  oauth2Provider,
  oidcProvider,
} from '@tests/helpers/auth-config';

vi.mock('openid-client', () => ({
  discovery: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
}));

const auth = buildEnabledAuth([oidcProvider]).authentication;

if (!auth.enabled) {
  throw new Error('expected enabled authentication');
}

const oidc = auth.providers[0] as ResolvedSsoProvider;

const [oauth2] = (() => {
  const other = buildEnabledAuth([oauth2Provider]).authentication;

  if (!other.enabled) {
    throw new Error('expected enabled authentication');
  }

  return other.providers as ResolvedSsoProvider[];
})();

const app = {} as never;
const callbackUrl = 'https://api.example.com/api/v1/auth/sso/google/callback';

const buildState = (): {
  state: string;
  nonce: string;
  provider: string;
  issuedAt: number;
  verifier?: string;
} => ({
  state: 'state-value',
  nonce: 'nonce-value',
  provider: 'google',
  issuedAt: Date.now(),
});

const load = async () => {
  vi.resetModules();
  const client = await import('openid-client');
  const adapter = await import('@/lib/auth/providers/oidc');

  return {
    client: vi.mocked(client),
    adapter,
  };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('oidc authorizeUrl', () => {
  test('builds a PKCE authorization redirect', async () => {
    const {client, adapter} = await load();
    const configuration = {issuer: 'https://accounts.google.com'};

    client.discovery.mockResolvedValue(configuration as never);
    client.buildAuthorizationUrl.mockReturnValue(
      new URL('https://accounts.google.com/authorize?x=1'),
    );

    const state = buildState();
    const url = await adapter.authorizeUrl(app, oidc, callbackUrl, state);

    expect(url).toBe('https://accounts.google.com/authorize?x=1');
    expect(state.verifier).toBeDefined();
    expect(client.discovery).toHaveBeenCalledWith(
      new URL('https://accounts.google.com'),
      'client-id',
      'client-secret',
    );
    expect(client.buildAuthorizationUrl).toHaveBeenCalledWith(
      configuration,
      expect.objectContaining({
        redirect_uri: callbackUrl,
        state: 'state-value',
        nonce: 'nonce-value',
        code_challenge_method: 'S256',
      }),
    );
  });

  test('caches the discovered configuration', async () => {
    const {client, adapter} = await load();

    client.discovery.mockResolvedValue({} as never);
    client.buildAuthorizationUrl.mockReturnValue(new URL('https://idp/a'));

    await adapter.authorizeUrl(app, oidc, callbackUrl, buildState());
    await adapter.authorizeUrl(app, oidc, callbackUrl, buildState());

    expect(client.discovery).toHaveBeenCalledTimes(1);
  });

  test('drops a failed discovery so the next attempt retries', async () => {
    const {client, adapter} = await load();

    client.discovery
      .mockRejectedValueOnce(new Error('discovery failed'))
      .mockResolvedValueOnce({} as never);
    client.buildAuthorizationUrl.mockReturnValue(new URL('https://idp/a'));

    await expect(
      adapter.authorizeUrl(app, oidc, callbackUrl, buildState()),
    ).rejects.toThrow('discovery failed');

    await adapter.authorizeUrl(app, oidc, callbackUrl, buildState());

    expect(client.discovery).toHaveBeenCalledTimes(2);
  });

  test('rejects a non-oidc provider', async () => {
    const {adapter} = await load();

    await expect(
      adapter.authorizeUrl(app, oauth2, callbackUrl, buildState()),
    ).rejects.toThrow('is not an OIDC provider');
  });
});

describe('oidc handleCallback', () => {
  const request = (query: Record<string, string>) => ({query}) as never;

  test('returns the subject from the ID token', async () => {
    const {client, adapter} = await load();
    const claims = {sub: 'subject-1', email: 'user@example.com'};

    client.discovery.mockResolvedValue({} as never);
    client.authorizationCodeGrant.mockResolvedValue({
      claims: () => claims,
    } as never);

    const identity = await adapter.handleCallback(
      app,
      oidc,
      callbackUrl,
      {...buildState(), verifier: 'verifier'},
      request({code: 'abc', state: 'state-value'}),
    );

    expect(identity).toEqual({
      provider: 'google',
      providerId: 'subject-1',
      claims,
    });
    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      {},
      expect.any(URL),
      expect.objectContaining({
        pkceCodeVerifier: 'verifier',
        expectedState: 'state-value',
        expectedNonce: 'nonce-value',
      }),
    );
  });

  test('skips PKCE when no verifier was issued', async () => {
    const {client, adapter} = await load();

    client.discovery.mockResolvedValue({} as never);
    client.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({sub: 'subject-1'}),
    } as never);

    const state = buildState();

    await adapter.handleCallback(
      app,
      oidc,
      callbackUrl,
      state,
      request({code: 'abc'}),
    );

    const checks = client.authorizationCodeGrant.mock.calls[0][2] as Record<
      string,
      unknown
    >;

    expect(checks.pkceCodeVerifier).toBeUndefined();
  });

  test('rejects a token response without a subject', async () => {
    const {client, adapter} = await load();

    client.discovery.mockResolvedValue({} as never);
    client.authorizationCodeGrant.mockResolvedValue({
      claims: () => undefined,
    } as never);

    await expect(
      adapter.handleCallback(
        app,
        oidc,
        callbackUrl,
        buildState(),
        request({code: 'abc'}),
      ),
    ).rejects.toThrow('did not return a subject');
  });

  test('rejects a non-oidc provider', async () => {
    const {adapter} = await load();

    await expect(
      adapter.handleCallback(
        app,
        oauth2,
        callbackUrl,
        buildState(),
        request({code: 'abc'}),
      ),
    ).rejects.toThrow('is not an OIDC provider');
  });
});
