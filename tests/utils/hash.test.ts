import {describe, expect, test} from 'vitest';

import {compare, hash} from '@/utils/hash';

describe('hash utility', () => {
  test('should successfully hash a plain text string', async () => {
    const plainText = 'my-secret-password';
    const hashed = await hash(plainText);

    expect(hashed).toBeDefined();
    expect(typeof hashed).toBe('string');
    expect(hashed).not.toBe(plainText);
    expect(hashed.length).toBeGreaterThan(0);
    // bcrypt hash format: starts with $2a$, $2b$, or $2y$ followed by cost parameters and hash
    expect(hashed).toMatch(/^\$2[aby]\$\d+\$/);
  });

  test('should correctly compare matching data', async () => {
    const plainText = 'another-secure-password';
    const hashed = await hash(plainText);

    const isMatch = await compare(plainText, hashed);
    expect(isMatch).toBe(true);
  });

  test('should return false when comparing non-matching data', async () => {
    const plainText = 'correct-password';
    const wrongText = 'wrong-password';
    const hashed = await hash(plainText);

    const isMatch = await compare(wrongText, hashed);
    expect(isMatch).toBe(false);
  });

  test('should handle empty strings correctly', async () => {
    const emptyString = '';
    const hashed = await hash(emptyString);

    expect(hashed).toMatch(/^\$2[aby]\$\d+\$/);
    const isMatch = await compare(emptyString, hashed);
    expect(isMatch).toBe(true);

    const isNotMatch = await compare('some-text', hashed);
    expect(isNotMatch).toBe(false);
  });

  test('should respect custom salt rounds', async () => {
    const plainText = 'custom-salt-rounds';
    const lowSaltHashed = await hash(plainText, 4);

    expect(lowSaltHashed).toMatch(/^\$2[aby]\$04\$/);
    const isMatch = await compare(plainText, lowSaltHashed);
    expect(isMatch).toBe(true);
  });
});
