import {describe, expect, it} from 'vitest';

import {extractJwtRolePayload} from '@/lib/rbac';

import {RbacConfig} from '@/interfaces/config';

describe('extractJwtRolePayload', () => {
  const baseRbac: RbacConfig = {
    enabled: true,
    modelName: 'users',
    roleField: 'role',
    defaultRole: 'viewer',
    roles: {
      admin: {},
      editor: {},
      viewer: {},
    },
  };

  it('returns empty payload when rbac config is undefined', () => {
    const payload = extractJwtRolePayload({role: 'admin'}, undefined);
    expect(payload).toEqual({});
  });

  it('returns empty payload when rbac is disabled', () => {
    const payload = extractJwtRolePayload(
      {role: 'admin'},
      {...baseRbac, enabled: false},
    );
    expect(payload).toEqual({});
  });

  it('extracts a single string role', () => {
    const payload = extractJwtRolePayload({role: 'admin'}, baseRbac);
    expect(payload).toEqual({role: 'admin'});
  });

  it('extracts an array of string roles', () => {
    const payload = extractJwtRolePayload(
      {role: ['editor', 'viewer']},
      baseRbac,
    );
    expect(payload).toEqual({roles: ['editor', 'viewer']});
  });

  it('converts non-string items in array to strings', () => {
    const payload = extractJwtRolePayload(
      {role: [1, 2] as unknown[]},
      baseRbac,
    );
    expect(payload).toEqual({roles: ['1', '2']});
  });

  it('parses a JSON-encoded string array', () => {
    const payload = extractJwtRolePayload(
      {role: '["editor", "viewer"]'},
      baseRbac,
    );
    expect(payload).toEqual({roles: ['editor', 'viewer']});
  });

  it('treats invalid JSON starting/ending with brackets as a plain string', () => {
    const payload = extractJwtRolePayload({role: '[invalid-json'}, baseRbac);
    expect(payload).toEqual({role: '[invalid-json'});
  });

  it('falls back to defaultRole when user role is null', () => {
    const payload = extractJwtRolePayload({role: null}, baseRbac);
    expect(payload).toEqual({role: 'viewer'});
  });

  it('falls back to defaultRole when user role is undefined', () => {
    const payload = extractJwtRolePayload({role: undefined}, baseRbac);
    expect(payload).toEqual({role: 'viewer'});
  });

  it('falls back to defaultRole when user role is empty string', () => {
    const payload = extractJwtRolePayload({role: ''}, baseRbac);
    expect(payload).toEqual({role: 'viewer'});
  });

  it('falls back to defaultRole when user role is whitespace only', () => {
    const payload = extractJwtRolePayload({role: '   '}, baseRbac);
    expect(payload).toEqual({role: 'viewer'});
  });

  it('falls back to defaultRole when user object is undefined', () => {
    const payload = extractJwtRolePayload(undefined, baseRbac);
    expect(payload).toEqual({role: 'viewer'});
  });

  it('falls back to defaultRole when roleField is missing from user object', () => {
    const payload = extractJwtRolePayload(
      {id: 1, email: 'test@example.com'},
      baseRbac,
    );
    expect(payload).toEqual({role: 'viewer'});
  });

  it('falls back to defaultRole when user role is an empty array', () => {
    const payload = extractJwtRolePayload({role: []}, baseRbac);
    expect(payload).toEqual({role: 'viewer'});
  });

  it('falls back to defaultRole when user role is an empty JSON array', () => {
    const payload = extractJwtRolePayload({role: '[]'}, baseRbac);
    expect(payload).toEqual({role: 'viewer'});
  });

  it('returns empty array when user role is empty array and no defaultRole configured', () => {
    const noDefaultRbac: RbacConfig = {
      ...baseRbac,
      defaultRole: undefined,
    };
    const payload = extractJwtRolePayload({role: []}, noDefaultRbac);
    expect(payload).toEqual({roles: []});
  });

  it('returns empty array when user role is JSON empty array and no defaultRole configured', () => {
    const noDefaultRbac: RbacConfig = {
      ...baseRbac,
      defaultRole: undefined,
    };
    const payload = extractJwtRolePayload({role: '[]'}, noDefaultRbac);
    expect(payload).toEqual({roles: []});
  });

  it('returns empty object when user has no role and no defaultRole configured', () => {
    const noDefaultRbac: RbacConfig = {
      ...baseRbac,
      defaultRole: undefined,
    };
    const payload = extractJwtRolePayload({role: null}, noDefaultRbac);
    expect(payload).toEqual({});
  });

  it('uses custom roleField when specified', () => {
    const customRoleRbac: RbacConfig = {
      ...baseRbac,
      roleField: 'user_role',
    };
    const payload = extractJwtRolePayload({user_role: 'admin'}, customRoleRbac);
    expect(payload).toEqual({role: 'admin'});
  });
});
