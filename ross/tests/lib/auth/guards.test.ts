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

const buildApp = () => ({
  buildResponse: vi.fn((code: number, message: string, data: unknown) => ({
    code,
    message,
    data,
  })),
});

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
            tokenExpiration: '1d',
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
      blockPasswordManagement(
        buildApp() as never,
        buildReply() as never,
        config,
        {provider: 'up-auth'},
      ),
    ).toBeNull();
  });

  test('sends a 400 for SSO accounts', () => {
    const app = buildApp();
    const reply = buildReply();

    const result = blockPasswordManagement(
      app as never,
      reply as never,
      config,
      {provider: 'google'},
    );

    expect(result).toBe(reply);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(app.buildResponse).toHaveBeenCalledWith(
      400,
      expect.stringContaining('authenticated via google'),
      null,
    );
  });
});

describe('assertPasswordAccount', () => {
  test('does nothing for password accounts', () => {
    expect(() =>
      assertPasswordAccount(buildApp() as never, config, {provider: 'up-auth'}),
    ).not.toThrow();
  });

  test('throws a 400 error for SSO accounts', () => {
    const app = buildApp();

    expect(() =>
      assertPasswordAccount(app as never, config, {provider: 'google'}),
    ).toThrow('authenticated via google');

    expect(app.buildResponse).toHaveBeenCalled();
  });
});
