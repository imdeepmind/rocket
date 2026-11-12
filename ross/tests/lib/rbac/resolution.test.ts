import {describe, expect, it} from 'vitest';

import {
  buildRoleInclusionMap,
  expandWildcard,
  expandWildcards,
  isRoleAuthorized,
} from '@/lib/rbac';

import {RoleConfig} from '@/interfaces/config';

describe('RBAC Wildcard Expansion & Role Resolution', () => {
  const declaredRoles = [
    'admin',
    'lead_editor',
    'editor:senior',
    'editor:junior',
    'editor',
    'viewer',
    'billing:admin',
    'billing:viewer',
  ];

  describe('expandWildcard', () => {
    it('expands universal wildcard "*" to all declared roles', () => {
      const result = expandWildcard('*', declaredRoles);
      expect(result).toEqual(declaredRoles);
    });

    it('expands namespaced wildcard "editor:*" to all matching roles', () => {
      const result = expandWildcard('editor:*', declaredRoles);
      expect(result).toEqual(['editor:senior', 'editor:junior']);
      // "editor" without colon is not matched
      expect(result).not.toContain('editor');
    });

    it('expands namespaced wildcard "billing:*" to all matching roles', () => {
      const result = expandWildcard('billing:*', declaredRoles);
      expect(result).toEqual(['billing:admin', 'billing:viewer']);
    });

    it('throws when namespaced wildcard matches zero declared roles', () => {
      expect(() => expandWildcard('marketing:*', declaredRoles)).toThrow(
        'Wildcard pattern "marketing:*" does not match any declared role in rbac.roles',
      );
    });

    it('returns exact declared role as a single-element array', () => {
      expect(expandWildcard('viewer', declaredRoles)).toEqual(['viewer']);
      expect(expandWildcard('editor:senior', declaredRoles)).toEqual([
        'editor:senior',
      ]);
    });

    it('throws when exact role is not in declared roles', () => {
      expect(() => expandWildcard('nonexistent', declaredRoles)).toThrow(
        'Role "nonexistent" does not exist in rbac.roles',
      );
    });
  });

  describe('expandWildcards', () => {
    it('returns empty set when patterns array is empty', () => {
      const result = expandWildcards([], declaredRoles);
      expect(result).toEqual(new Set());
    });

    it('expands multiple concrete roles into a Set', () => {
      const result = expandWildcards(['viewer', 'editor'], declaredRoles);
      expect(result).toEqual(new Set(['viewer', 'editor']));
    });

    it('expands and deduplicates mixed exact roles and wildcards', () => {
      const result = expandWildcards(
        ['editor:*', 'editor:senior', 'viewer'],
        declaredRoles,
      );
      expect(result).toEqual(
        new Set(['editor:senior', 'editor:junior', 'viewer']),
      );
    });

    it('expands universal wildcard alongside specific roles', () => {
      const result = expandWildcards(['*', 'viewer'], declaredRoles);
      expect(result).toEqual(new Set(declaredRoles));
    });
  });

  describe('buildRoleInclusionMap', () => {
    it('reflexively includes each role when no includes are specified', () => {
      const roles: Record<string, RoleConfig> = {
        admin: {},
        viewer: {},
      };
      const map = buildRoleInclusionMap(roles);
      expect(map.get('admin')).toEqual(new Set(['admin']));
      expect(map.get('viewer')).toEqual(new Set(['viewer']));
    });

    it('computes linear transitive inclusions (A -> B -> C)', () => {
      const roles: Record<string, RoleConfig> = {
        admin: {includes: ['editor']},
        editor: {includes: ['viewer']},
        viewer: {},
      };
      const map = buildRoleInclusionMap(roles);
      expect(map.get('admin')).toEqual(new Set(['admin', 'editor', 'viewer']));
      expect(map.get('editor')).toEqual(new Set(['editor', 'viewer']));
      expect(map.get('viewer')).toEqual(new Set(['viewer']));
    });

    it('computes universal wildcard "*" inclusions', () => {
      const roles: Record<string, RoleConfig> = {
        admin: {includes: ['*']},
        editor: {includes: ['viewer']},
        viewer: {},
      };
      const map = buildRoleInclusionMap(roles);
      expect(map.get('admin')).toEqual(new Set(['admin', 'editor', 'viewer']));
      expect(map.get('editor')).toEqual(new Set(['editor', 'viewer']));
      expect(map.get('viewer')).toEqual(new Set(['viewer']));
    });

    it('computes namespaced wildcard "editor:*" inclusions transitively', () => {
      const roles: Record<string, RoleConfig> = {
        admin: {includes: ['*']},
        lead_editor: {includes: ['editor:*']},
        'editor:senior': {includes: ['editor:junior', 'viewer']},
        'editor:junior': {includes: ['viewer']},
        viewer: {},
      };
      const map = buildRoleInclusionMap(roles);

      expect(map.get('admin')).toEqual(
        new Set([
          'admin',
          'lead_editor',
          'editor:senior',
          'editor:junior',
          'viewer',
        ]),
      );
      expect(map.get('lead_editor')).toEqual(
        new Set(['lead_editor', 'editor:senior', 'editor:junior', 'viewer']),
      );
      expect(map.get('editor:senior')).toEqual(
        new Set(['editor:senior', 'editor:junior', 'viewer']),
      );
      expect(map.get('editor:junior')).toEqual(
        new Set(['editor:junior', 'viewer']),
      );
      expect(map.get('viewer')).toEqual(new Set(['viewer']));
    });

    it('handles diamond inheritance (A -> B, C; B, C -> D)', () => {
      const roles: Record<string, RoleConfig> = {
        super_editor: {includes: ['copy_editor', 'layout_editor']},
        copy_editor: {includes: ['reader']},
        layout_editor: {includes: ['reader']},
        reader: {},
      };
      const map = buildRoleInclusionMap(roles);
      expect(map.get('super_editor')).toEqual(
        new Set(['super_editor', 'copy_editor', 'layout_editor', 'reader']),
      );
      expect(map.get('copy_editor')).toEqual(
        new Set(['copy_editor', 'reader']),
      );
      expect(map.get('layout_editor')).toEqual(
        new Set(['layout_editor', 'reader']),
      );
      expect(map.get('reader')).toEqual(new Set(['reader']));
    });

    it('handles direct and complex circular inclusions without infinite recursion', () => {
      const roles: Record<string, RoleConfig> = {
        roleA: {includes: ['roleB']},
        roleB: {includes: ['roleC']},
        roleC: {includes: ['roleA', 'base']},
        base: {},
      };
      const map = buildRoleInclusionMap(roles);
      const expectedCycleSet = new Set(['roleA', 'roleB', 'roleC', 'base']);
      expect(map.get('roleA')).toEqual(expectedCycleSet);
      expect(map.get('roleB')).toEqual(expectedCycleSet);
      expect(map.get('roleC')).toEqual(expectedCycleSet);
      expect(map.get('base')).toEqual(new Set(['base']));
    });

    it('handles self-inclusion cleanly', () => {
      const roles: Record<string, RoleConfig> = {
        selfRole: {includes: ['selfRole']},
      };
      const map = buildRoleInclusionMap(roles);
      expect(map.get('selfRole')).toEqual(new Set(['selfRole']));
    });

    it('isolates disjoint role hierarchies', () => {
      const roles: Record<string, RoleConfig> = {
        'teamA:lead': {includes: ['teamA:member']},
        'teamA:member': {},
        'teamB:lead': {includes: ['teamB:member']},
        'teamB:member': {},
      };
      const map = buildRoleInclusionMap(roles);
      expect(map.get('teamA:lead')).toEqual(
        new Set(['teamA:lead', 'teamA:member']),
      );
      expect(map.get('teamA:member')).toEqual(new Set(['teamA:member']));
      expect(map.get('teamB:lead')).toEqual(
        new Set(['teamB:lead', 'teamB:member']),
      );
      expect(map.get('teamB:member')).toEqual(new Set(['teamB:member']));
    });
  });

  describe('isRoleAuthorized', () => {
    const roles: Record<string, RoleConfig> = {
      admin: {includes: ['*']},
      lead_editor: {includes: ['editor:*']},
      'editor:senior': {includes: ['editor:junior', 'viewer']},
      'editor:junior': {includes: ['viewer']},
      viewer: {},
      guest: {},
    };
    const inclusionMap = buildRoleInclusionMap(roles);

    it('permits access when allowedRoles is undefined or empty', () => {
      expect(isRoleAuthorized('viewer', undefined, inclusionMap)).toBe(true);
      expect(isRoleAuthorized('viewer', new Set(), inclusionMap)).toBe(true);
      expect(isRoleAuthorized(undefined, undefined, inclusionMap)).toBe(true);
      expect(isRoleAuthorized(null, new Set(), inclusionMap)).toBe(true);
    });

    it('denies access when user role is undefined, null, or empty', () => {
      const allowed = new Set(['viewer']);
      expect(isRoleAuthorized(undefined, allowed, inclusionMap)).toBe(false);
      expect(isRoleAuthorized(null, allowed, inclusionMap)).toBe(false);
      expect(isRoleAuthorized('', allowed, inclusionMap)).toBe(false);
      expect(isRoleAuthorized([], allowed, inclusionMap)).toBe(false);
    });

    it('permits access on direct role match', () => {
      const allowed = new Set(['viewer']);
      expect(isRoleAuthorized('viewer', allowed, inclusionMap)).toBe(true);
    });

    it('permits access when user role includes the required role', () => {
      const allowed = new Set(['viewer']);
      expect(isRoleAuthorized('admin', allowed, inclusionMap)).toBe(true);
      expect(isRoleAuthorized('lead_editor', allowed, inclusionMap)).toBe(true);
      expect(isRoleAuthorized('editor:senior', allowed, inclusionMap)).toBe(
        true,
      );
      expect(isRoleAuthorized('editor:junior', allowed, inclusionMap)).toBe(
        true,
      );
    });

    it('denies access when user role does not satisfy the required role', () => {
      const allowed = new Set(['editor:senior']);
      expect(isRoleAuthorized('editor:junior', allowed, inclusionMap)).toBe(
        false,
      );
      expect(isRoleAuthorized('viewer', allowed, inclusionMap)).toBe(false);
      expect(isRoleAuthorized('guest', allowed, inclusionMap)).toBe(false);
    });

    it('denies access when user role is unknown / not in inclusion map', () => {
      const allowed = new Set(['viewer']);
      expect(isRoleAuthorized('unknown_role', allowed, inclusionMap)).toBe(
        false,
      );
    });

    it('handles array of user roles', () => {
      const allowed = new Set(['editor:senior']);
      // One of the roles matches directly or transitively
      expect(isRoleAuthorized(['guest', 'admin'], allowed, inclusionMap)).toBe(
        true,
      );
      expect(
        isRoleAuthorized(
          ['guest', 'editor:junior', 'editor:senior'],
          allowed,
          inclusionMap,
        ),
      ).toBe(true);
      // None of the roles match
      expect(isRoleAuthorized(['guest', 'viewer'], allowed, inclusionMap)).toBe(
        false,
      );
    });
  });
});
