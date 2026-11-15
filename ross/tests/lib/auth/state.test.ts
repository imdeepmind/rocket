import {afterEach, describe, expect, test, vi} from 'vitest';

import {
  deriveKey,
  generatePkcePair,
  openState,
  randomToken,
  safeEqual,
  sealState,
} from '@/lib/auth/state';

const secret = 'a-very-long-secret-used-for-testing-purposes';

const payload = {
  state: 'state-value',
  nonce: 'nonce-value',
  verifier: 'verifier-value',
  provider: 'google',
  returnTo: 'https://app.example.com/done',
  issuedAt: Date.now(),
};

afterEach(() => {
  vi.useRealTimers();
});

describe('deriveKey', () => {
  test('is deterministic and purpose bound', () => {
    const first = deriveKey(secret, 'a');
    const second = deriveKey(secret, 'a');

    expect(first).toEqual(second);
    expect(first).not.toEqual(deriveKey(secret, 'b'));
    expect(first).toHaveLength(32);
  });
});

describe('sealState / openState', () => {
  test('round-trips the payload', () => {
    const sealed = sealState(secret, 'info', payload);

    expect(openState(secret, 'info', sealed)).toEqual(payload);
  });

  test('produces a different ciphertext each time', () => {
    expect(sealState(secret, 'info', payload)).not.toEqual(
      sealState(secret, 'info', payload),
    );
  });

  test('rejects a tampered payload', () => {
    const sealed = sealState(secret, 'info', payload);
    const bytes = Buffer.from(sealed, 'base64url');
    bytes[bytes.length - 1] ^= 0xff;

    expect(() =>
      openState(secret, 'info', bytes.toString('base64url')),
    ).toThrow();
  });

  test('rejects a different secret or domain', () => {
    const sealed = sealState(secret, 'info', payload);

    expect(() => openState(`${secret}-other`, 'info', sealed)).toThrow();
    expect(() => openState(secret, 'other', sealed)).toThrow();
  });

  test('rejects a payload that is too short', () => {
    expect(() =>
      openState(secret, 'info', Buffer.from('short').toString('base64url')),
    ).toThrow('Invalid SSO state');
  });

  test('rejects an expired payload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const sealed = sealState(secret, 'info', {
      ...payload,
      issuedAt: Date.now(),
    });

    vi.setSystemTime(new Date('2026-01-01T00:20:00Z'));

    expect(() => openState(secret, 'info', sealed)).toThrow(
      'SSO state expired',
    );
  });

  test('rejects a payload from the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const sealed = sealState(secret, 'info', {
      ...payload,
      issuedAt: Date.now() + 60_000,
    });

    expect(() => openState(secret, 'info', sealed)).toThrow(
      'SSO state expired',
    );
  });
});

describe('safeEqual', () => {
  test('compares equal strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });

  test('rejects different strings', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  test('rejects different lengths without throwing', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('randomToken', () => {
  test('returns a unique url-safe value', () => {
    const first = randomToken();
    const second = randomToken();

    expect(first).not.toEqual(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('generatePkcePair', () => {
  test('derives an S256 challenge from the verifier', () => {
    const {verifier, challenge} = generatePkcePair();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toEqual(verifier);
  });
});
