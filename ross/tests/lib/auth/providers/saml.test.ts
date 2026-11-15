import {afterEach, describe, expect, test, vi} from 'vitest';

import {ResolvedSsoProvider} from '@/interfaces/config';

import {
  buildEnabledAuth,
  oauth2Provider,
  samlProvider,
} from '@tests/helpers/auth-config';

const mocks = vi.hoisted(() => ({
  getAuthorizeUrlAsync: vi.fn(),
  validatePostResponseAsync: vi.fn(),
  generateServiceProviderMetadata: vi.fn(),
  options: [] as Array<Record<string, unknown>>,
}));

vi.mock('@node-saml/node-saml', () => {
  class SAML {
    getAuthorizeUrlAsync = mocks.getAuthorizeUrlAsync;
    validatePostResponseAsync = mocks.validatePostResponseAsync;

    constructor(options: Record<string, unknown>) {
      mocks.options.push(options);
    }
  }

  return {
    SAML,
    ValidateInResponseTo: {always: 'always'},
    generateServiceProviderMetadata: mocks.generateServiceProviderMetadata,
  };
});

const auth = buildEnabledAuth([samlProvider]).authentication;

if (!auth.enabled) {
  throw new Error('expected enabled authentication');
}

const saml = auth.providers[0] as ResolvedSsoProvider;
const [oauth2] = (() => {
  const other = buildEnabledAuth([oauth2Provider]).authentication;

  if (!other.enabled) {
    throw new Error('expected enabled authentication');
  }

  return other.providers as ResolvedSsoProvider[];
})();

const callbackUrl = 'https://api.example.com/api/v1/auth/sso/corp/callback';

const buildApp = () => {
  const store = new Map<string, unknown>();

  return {
    app: {
      cache: {
        set: vi.fn(async (key: string, value: unknown) => {
          store.set(key, value);
        }),
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        delete: vi.fn(async (key: string) => {
          store.delete(key);
        }),
      },
    },
    store,
  };
};

const buildState = () => ({
  state: 'relay-state',
  nonce: 'nonce',
  provider: 'corp',
  issuedAt: Date.now(),
});

const load = async () => {
  vi.resetModules();
  const adapter = await import('@/lib/auth/providers/saml');

  return {adapter};
};

afterEach(() => {
  vi.clearAllMocks();
  mocks.options.length = 0;
});

describe('saml authorizeUrl', () => {
  test('creates a signed request through a cache-backed provider', async () => {
    const {adapter} = await load();
    const {app} = buildApp();

    mocks.getAuthorizeUrlAsync.mockResolvedValue('https://idp/login');

    const url = await adapter.authorizeUrl(
      app as never,
      saml,
      callbackUrl,
      buildState(),
    );

    expect(url).toBe('https://idp/login');
    expect(mocks.getAuthorizeUrlAsync).toHaveBeenCalledWith('relay-state', {});
    expect(mocks.options[0]).toMatchObject({
      callbackUrl,
      entryPoint: 'https://idp.example.com/saml',
      issuer: 'ross',
      idpCert: 'certificate',
      audience: 'ross',
      wantAssertionsSigned: true,
      validateInResponseTo: 'always',
    });
    expect(mocks.options[0].cacheProvider).toBeTypeOf('object');
  });

  test('persists request IDs through the cache provider', async () => {
    const {adapter} = await load();
    const {app, store} = buildApp();

    mocks.getAuthorizeUrlAsync.mockResolvedValue('https://idp/login');

    await adapter.authorizeUrl(app as never, saml, callbackUrl, buildState());

    const provider = mocks.options[0].cacheProvider as {
      saveAsync: (key: string, value: string) => Promise<unknown>;
      getAsync: (key: string) => Promise<string | null>;
      removeAsync: (key: string | null) => Promise<string | null>;
    };

    const saved = await provider.saveAsync('request-id', 'value');

    expect(saved).toMatchObject({value: 'value'});
    expect(store.get('saml:corp:request-id')).toBe('value');
    expect(await provider.getAsync('request-id')).toBe('value');
    expect(await provider.removeAsync('request-id')).toBe('value');
    expect(store.has('saml:corp:request-id')).toBe(false);
    expect(await provider.removeAsync(null)).toBeNull();
  });

  test('rejects a non-saml provider', async () => {
    const {adapter} = await load();
    const {app} = buildApp();

    await expect(
      adapter.authorizeUrl(app as never, oauth2, callbackUrl, buildState()),
    ).rejects.toThrow('is not a SAML provider');
  });
});

describe('saml handleCallback', () => {
  test('returns the NameID from the assertion', async () => {
    const {adapter} = await load();
    const {app} = buildApp();

    mocks.validatePostResponseAsync.mockResolvedValue({
      profile: {nameID: 'user-1', email: 'user@example.com'},
      loggedOut: false,
    });

    const identity = await adapter.handleCallback(
      app as never,
      saml,
      callbackUrl,
      buildState(),
      {body: {SAMLResponse: 'response', RelayState: 'relay'}} as never,
    );

    expect(identity).toMatchObject({provider: 'corp', providerId: 'user-1'});
    expect(mocks.validatePostResponseAsync).toHaveBeenCalledWith({
      SAMLResponse: 'response',
      RelayState: 'relay',
    });
  });

  test('omits RelayState when it is absent', async () => {
    const {adapter} = await load();
    const {app} = buildApp();

    mocks.validatePostResponseAsync.mockResolvedValue({
      profile: {nameID: 'user-1'},
      loggedOut: false,
    });

    await adapter.handleCallback(
      app as never,
      saml,
      callbackUrl,
      buildState(),
      {body: {SAMLResponse: 'response'}} as never,
    );

    expect(mocks.validatePostResponseAsync).toHaveBeenCalledWith({
      SAMLResponse: 'response',
    });
  });

  test('requires a SAML response', async () => {
    const {adapter} = await load();
    const {app} = buildApp();

    await expect(
      adapter.handleCallback(app as never, saml, callbackUrl, buildState(), {
        body: {},
      } as never),
    ).rejects.toThrow('SAML response is missing');
  });

  test('rejects a logged out or subject-less response', async () => {
    const {adapter} = await load();
    const {app} = buildApp();

    mocks.validatePostResponseAsync.mockResolvedValue({
      profile: null,
      loggedOut: true,
    });

    await expect(
      adapter.handleCallback(app as never, saml, callbackUrl, buildState(), {
        body: {SAMLResponse: 'response'},
      } as never),
    ).rejects.toThrow('did not include a subject');
  });

  test('rejects a non-saml provider', async () => {
    const {adapter} = await load();
    const {app} = buildApp();

    await expect(
      adapter.handleCallback(app as never, oauth2, callbackUrl, buildState(), {
        body: {SAMLResponse: 'x'},
      } as never),
    ).rejects.toThrow('is not a SAML provider');
  });
});

describe('saml metadata', () => {
  test('generates service provider metadata', async () => {
    const {adapter} = await load();

    mocks.generateServiceProviderMetadata.mockReturnValue('<xml/>');

    expect(adapter.metadata?.(saml, callbackUrl)).toBe('<xml/>');
    expect(mocks.generateServiceProviderMetadata).toHaveBeenCalledWith({
      issuer: 'ross',
      callbackUrl,
    });
  });

  test('rejects a non-saml provider', async () => {
    const {adapter} = await load();

    expect(() => adapter.metadata?.(oauth2, callbackUrl)).toThrow(
      'is not a SAML provider',
    );
  });
});
