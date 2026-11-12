import {describe, expect, test} from 'vitest';

import {deriveApiTags} from '@/lib/config/tags';

describe('deriveApiTags', () => {
  test.each([
    ['model.v1.users.id.index', ['Users', 'Read']],
    ['model.admin.users.email.search', ['Users', 'Read']],
    ['model.v1.users.unknown.getAll', ['Users', 'Read']],
    ['model.v1.users.unknown.insert', ['Users', 'Insert']],
    ['model.v1.users.email.edit', ['Users', 'Update']],
    ['model.v1.users.id.delete', ['Users', 'Delete']],
  ])('model operation %s → %j', (identifier, expected) => {
    expect(deriveApiTags(identifier)).toEqual(expected);
  });

  test('aggregate APIs are tagged Model + Read', () => {
    expect(deriveApiTags('aggregate.v1.sales.amount.getAggregation')).toEqual([
      'Sales',
      'Read',
    ]);
  });

  test.each([
    ['auth.v1.users.unknown.login', 'Login'],
    ['auth.v1.users.unknown.registration', 'Register'],
    ['auth.v1.users.unknown.changePassword', 'Password'],
    ['auth.v1.users.unknown.forgotPassword', 'Password'],
    ['auth.v1.users.unknown.otpVerifyLogin', 'OTP'],
    ['auth.v1.users.unknown.resendOtpRegister', 'OTP'],
    ['auth.v1.users.unknown.me', 'Profile'],
    ['auth.v1.users.unknown.editMe', 'Profile'],
    ['auth.v1.users.unknown.deleteMe', 'Profile'],
    ['auth.v1.users.unknown.emailChange', 'Profile'],
  ])('auth operation %s → %s', (identifier, operationTag) => {
    expect(deriveApiTags(identifier)).toEqual(['Users', 'Auth', operationTag]);
  });

  test('custom endpoints use the fixed tag', () => {
    expect(deriveApiTags('custom.v1.all.unknown.searchUsers')).toEqual([
      'Custom Endpoints',
    ]);
  });

  test('capitalizes multi-word model names consistently', () => {
    expect(deriveApiTags('model.v1.blog_posts.id.index')).toEqual([
      'Blog_posts',
      'Read',
    ]);
  });

  test('unknown modules fall back to the model tag only', () => {
    expect(deriveApiTags('webhook.v1.users.id.fire')).toEqual(['Users']);
  });

  test('malformed identifiers return no tags', () => {
    expect(deriveApiTags('not-an-identifier')).toEqual([]);
  });
});
