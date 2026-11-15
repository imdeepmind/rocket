import {describe, expect, test} from 'vitest';

import {buildRedirectUrl} from '@/lib/auth/redirect';

describe('buildRedirectUrl', () => {
  test('appends parameters', () => {
    expect(
      buildRedirectUrl('https://app.example.com/done', {code: 'abc'}),
    ).toBe('https://app.example.com/done?code=abc');
  });

  test('preserves existing parameters', () => {
    expect(
      buildRedirectUrl('https://app.example.com/done?lang=en', {error: 'x'}),
    ).toBe('https://app.example.com/done?lang=en&error=x');
  });

  test('skips undefined values', () => {
    expect(
      buildRedirectUrl('https://app.example.com/done', {
        code: 'abc',
        error: undefined,
      }),
    ).toBe('https://app.example.com/done?code=abc');
  });

  test('rejects an invalid target', () => {
    expect(() => buildRedirectUrl('not-a-url', {})).toThrow();
  });
});
