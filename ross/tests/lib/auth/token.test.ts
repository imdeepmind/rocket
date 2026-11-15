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
      {id: 7, email: 'user@example.com'},
      {expiresIn: '1d'},
    );
  });

  test('omits the username claim when it is absent', () => {
    const app = buildApp();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    issueAccessToken(app as never, config, {id: 7}, 'email');

    expect(app.jwt.sign).toHaveBeenCalledWith({id: 7}, {expiresIn: '1d'});
  });

  test('uses the role user when provided', () => {
    const app = buildApp();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]], {
      rbac: {enabled: true, roleField: 'role', defaultRole: 'viewer'},
    });

    issueAccessToken(app as never, config, {id: 7}, undefined, {role: 'admin'});

    expect(app.jwt.sign).toHaveBeenCalledWith(
      {id: 7, role: 'admin'},
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

  test('round-trips the subject for the issuing provider', () => {
    const code = issueExchangeCode(config, 'google', '42');

    expect(readExchangeCode(config, 'google', code)).toBe('42');
  });

  test('rejects a code issued for another provider', () => {
    const code = issueExchangeCode(config, 'google', '42');

    expect(() => readExchangeCode(config, 'github', code)).toThrow(
      'Invalid exchange code',
    );
  });

  test('rejects a tampered code', () => {
    expect(() => readExchangeCode(config, 'google', 'not-a-jwt')).toThrow();
  });

  test('cannot be used as an access token', () => {
    const code = issueExchangeCode(config, 'google', '42');

    expect(() => jwt.verify(code, upAuthAuthentication.jwtSecret)).toThrow();
  });

  test('throws when authentication is disabled', () => {
    expect(() =>
      issueExchangeCode(buildEnabledAuth([]), 'google', '42'),
    ).toThrow('Authentication is not enabled');
  });
});
