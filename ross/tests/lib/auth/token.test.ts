import jwt from 'jsonwebtoken';
import {describe, expect, test, vi} from 'vitest';

import {
  issueAccessToken,
  issueExchangeCode,
  readExchangeCode,
} from '@/lib/auth/token';

import {
  buildEnabledAuth,
  upAuthAuthentication,
} from '@tests/helpers/auth-config';

const buildApp = () => ({
  jwt: {
    sign: vi.fn().mockReturnValue('signed-token'),
  },
});

describe('issueAccessToken', () => {
  test('signs the standard payload', () => {
    const app = buildApp();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    const token = issueAccessToken(
      app as never,
      config,
      {id: 7, email: 'user@example.com'},
      'email',
    );

    expect(token).toBe('signed-token');
    expect(app.jwt.sign).toHaveBeenCalledWith(
      {id: 7, email: 'user@example.com', providerId: null},
      {expiresIn: '1d'},
    );
  });

  test('sets email to null when it is absent', () => {
    const app = buildApp();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    issueAccessToken(app as never, config, {id: 7}, 'email');

    expect(app.jwt.sign).toHaveBeenCalledWith(
      {id: 7, email: null, providerId: null},
      {expiresIn: '1d'},
    );
  });

  test('uses the role user when provided', () => {
    const app = buildApp();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]], {
      rbac: {enabled: true, roleField: 'role', defaultRole: 'viewer'},
    });

    issueAccessToken(app as never, config, {id: 7}, undefined, {role: 'admin'});

    expect(app.jwt.sign).toHaveBeenCalledWith(
      {id: 7, email: null, providerId: null, role: 'admin'},
      {expiresIn: '1d'},
    );
  });

  test('includes providerId and email for SSO when configured', () => {
    const app = buildApp();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    issueAccessToken(
      app as never,
      config,
      {id: 7, email: 'sso@example.com', provider_id: 'sub-123'},
      'email',
      undefined,
      'provider_id',
    );

    expect(app.jwt.sign).toHaveBeenCalledWith(
      {id: 7, email: 'sso@example.com', providerId: 'sub-123'},
      {expiresIn: '1d'},
    );
  });

  test('includes custom usernameField in payload alongside email', () => {
    const app = buildApp();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    issueAccessToken(
      app as never,
      config,
      {id: 7, username: 'alice'},
      'username',
    );

    expect(app.jwt.sign).toHaveBeenCalledWith(
      {id: 7, username: 'alice', email: 'alice', providerId: null},
      {expiresIn: '1d'},
    );
  });

  test('falls back to user.email when usernameField is omitted', () => {
    const app = buildApp();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    issueAccessToken(app as never, config, {
      id: 7,
      email: 'fallback@example.com',
    });

    expect(app.jwt.sign).toHaveBeenCalledWith(
      {id: 7, email: 'fallback@example.com', providerId: null},
      {expiresIn: '1d'},
    );
  });

  test('throws when authentication is disabled', () => {
    expect(() =>
      issueAccessToken(buildApp() as never, buildEnabledAuth([]), {id: 1}),
    ).toThrow('Authentication is not enabled');
  });
});

describe('issueExchangeCode / readExchangeCode', () => {
  const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

  test('round-trips the subject for the issuing provider', async () => {
    const code = issueExchangeCode(config, 'google', '42');

    await expect(readExchangeCode(config, 'google', code)).resolves.toBe('42');
  });

  test('rejects a code issued for another provider', async () => {
    const code = issueExchangeCode(config, 'google', '42');

    await expect(readExchangeCode(config, 'github', code)).rejects.toThrow(
      'Invalid exchange code',
    );
  });

  test('rejects a tampered code', async () => {
    await expect(
      readExchangeCode(config, 'google', 'not-a-jwt'),
    ).rejects.toThrow();
  });

  test('cannot be used as an access token', () => {
    const code = issueExchangeCode(config, 'google', '42');

    expect(() => jwt.verify(code, upAuthAuthentication.jwtSecret)).toThrow();
  });

  test('cannot be replayed when cache is provided', async () => {
    const store = new Map<string, unknown>();
    const mockCache = {
      get: vi.fn(async (key: string) => store.get(key)),
      set: vi.fn(async (key: string, val: unknown) => {
        store.set(key, val);
      }),
      delete: vi.fn(),
      clear: vi.fn(),
    };

    const code = issueExchangeCode(config, 'google', '42');

    await expect(
      readExchangeCode(config, 'google', code, mockCache as never),
    ).resolves.toBe('42');

    await expect(
      readExchangeCode(config, 'google', code, mockCache as never),
    ).rejects.toThrow('Exchange code has already been used');
  });

  test('throws when authentication is disabled', () => {
    expect(() =>
      issueExchangeCode(buildEnabledAuth([]), 'google', '42'),
    ).toThrow('Authentication is not enabled');
  });
});
