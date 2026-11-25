import {describe, expect, test, vi} from 'vitest';

import {
  assertPasswordAccount,
  blockPasswordManagement,
  isPasswordAccount,
  passwordManagementMessage,
} from '@/lib/auth/guards';

import {
  buildEnabledAuth,
  upAuthAuthentication,
} from '@tests/helpers/auth-config';

const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

const buildReply = () => ({
  status: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
});

describe('isPasswordAccount', () => {
  test('is true for up-auth rows', () => {
    expect(isPasswordAccount(config, {provider: 'up-auth'})).toBe(true);
  });

  test('is true for legacy rows without a provider', () => {
    expect(isPasswordAccount(config, {})).toBe(true);
    expect(isPasswordAccount(config, {provider: null})).toBe(true);
  });

  test('is false for SSO rows', () => {
    expect(isPasswordAccount(config, {provider: 'google'})).toBe(false);
  });

  test('is true when auth is disabled or the user is missing', () => {
    expect(isPasswordAccount(buildEnabledAuth([]), {provider: 'google'})).toBe(
      true,
    );
    expect(isPasswordAccount(config, undefined)).toBe(true);
  });

  test('is true when the resolved config has no user model', () => {
    expect(
      isPasswordAccount(
        {
          authentication: {
            enabled: true,
            accessTokenExpiration: '15m',
            refreshTokenExpiration: '7d',
            sessionStorage: 'db',
            providers: [{type: 'api-key', config: {key: 'k'}}],
          },
        } as never,
        {provider: 'google'},
      ),
    ).toBe(true);
  });
});

describe('passwordManagementMessage', () => {
  test('names the provider', () => {
    expect(passwordManagementMessage('google')).toContain(
      'authenticated via google',
    );
  });

  test('falls back when the provider is unknown', () => {
    expect(passwordManagementMessage(undefined)).toContain(
      'an external identity',
    );
  });
});

describe('blockPasswordManagement', () => {
  test('returns null for password accounts', () => {
    expect(
      blockPasswordManagement(buildReply() as never, config, {
        provider: 'up-auth',
      }),
    ).toBeNull();
  });

  test('sends a 400 for SSO accounts', () => {
    const reply = buildReply();
    const buildResponse = vi.fn(
      (code: number, message: string, data: unknown) => ({
        code,
        message,
        data,
      }),
    );

    const result = blockPasswordManagement(
      reply as never,
      config,
      {provider: 'google'},
      buildResponse,
    );

    expect(result).toBe(reply);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(buildResponse).toHaveBeenCalledWith(
      400,
      expect.stringContaining('authenticated via google'),
      null,
    );
  });

  test('uses default buildResponse when omitted', () => {
    const reply = buildReply();

    const result = blockPasswordManagement(reply as never, config, {
      provider: 'google',
    });

    expect(result).toBe(reply);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 400,
        message: expect.stringContaining('authenticated via google'),
        data: null,
      }),
    );
  });
});

describe('assertPasswordAccount', () => {
  test('does nothing for password accounts', () => {
    expect(() =>
      assertPasswordAccount(config, {provider: 'up-auth'}),
    ).not.toThrow();
  });

  test('throws a 400 error for SSO accounts', () => {
    const buildResponse = vi.fn(
      (code: number, message: string, data: unknown) => ({
        code,
        message,
        data,
      }),
    );

    expect(() =>
      assertPasswordAccount(config, {provider: 'google'}, buildResponse),
    ).toThrow('authenticated via google');

    expect(buildResponse).toHaveBeenCalled();
  });

  test('uses default buildResponse when omitted', () => {
    expect(() => assertPasswordAccount(config, {provider: 'google'})).toThrow(
      'authenticated via google',
    );
  });
});
