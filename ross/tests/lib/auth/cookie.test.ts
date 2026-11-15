import {describe, expect, test, vi} from 'vitest';

import {
  clearStateCookie,
  readStateCookie,
  setStateCookie,
  stateCookieName,
} from '@/lib/auth/cookie';

const buildReply = () => ({
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
});

describe('stateCookieName', () => {
  test('is __Host- prefixed and provider scoped', () => {
    expect(stateCookieName('google')).toBe('__Host-ross_sso_google');
  });
});

describe('setStateCookie', () => {
  test('sets a hardened host-scoped cookie', () => {
    const reply = buildReply();

    setStateCookie(reply as never, 'google', 'sealed');

    expect(reply.setCookie).toHaveBeenCalledWith(
      '__Host-ross_sso_google',
      'sealed',
      {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 600,
      },
    );
  });
});

describe('clearStateCookie', () => {
  test('clears the cookie at the root path', () => {
    const reply = buildReply();

    clearStateCookie(reply as never, 'google');

    expect(reply.clearCookie).toHaveBeenCalledWith('__Host-ross_sso_google', {
      path: '/',
    });
  });
});

describe('readStateCookie', () => {
  test('reads the provider cookie', () => {
    expect(
      readStateCookie(
        {cookies: {'__Host-ross_sso_google': 'sealed'}},
        'google',
      ),
    ).toBe('sealed');
  });

  test('returns undefined without cookies', () => {
    expect(readStateCookie({}, 'google')).toBeUndefined();
  });
});
