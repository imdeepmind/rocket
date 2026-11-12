import {describe, expect, it} from 'vitest';

import {
  buildApiIdentifier,
  getAPIFromUniqueIdentifier,
  parseApiIdentifier,
} from '@/lib/config/identifier';

import {AppConfig} from '@/interfaces/config';

describe('getAPIFromUniqueIdentifier', () => {
  const mockConfig: Partial<AppConfig> = {
    customEndpoints: {
      get_users: {
        method: 'GET',
        path: '/users',
        description: 'Get all users',
        validation: {},
        handler: {
          type: 'sql',
          sql: 'SELECT * FROM users',
        },
      },
      create_user: {
        method: 'POST',
        path: '/users',
        description: 'Create a user',
        validation: {},
        handler: {
          type: 'sql',
          sql: 'INSERT INTO users ...',
        },
      },
    },
  };

  it('should return the correct custom endpoint config for a valid identifier', () => {
    const result = getAPIFromUniqueIdentifier(
      mockConfig as AppConfig,
      'custom.v1.all.unknown.get_users',
    );
    expect(result).toEqual(mockConfig.customEndpoints?.get_users);
  });

  it('should return null if the first part is not customEndpoints', () => {
    const result = getAPIFromUniqueIdentifier(
      mockConfig as AppConfig,
      'model.v1.users.unknown.getAll',
    );
    expect(result).toBeNull();
  });

  it('should return null if the second part is not all', () => {
    const result = getAPIFromUniqueIdentifier(
      mockConfig as AppConfig,
      'custom.v1.all.unknown.somethingElse.get_users',
    );
    expect(result).toBeNull();
  });

  it('should return null if the custom endpoint name is not found', () => {
    const result = getAPIFromUniqueIdentifier(
      mockConfig as AppConfig,
      'custom.v1.all.unknown.non_existent',
    );
    expect(result).toBeNull();
  });

  it('should return null if customEndpoints is missing in config', () => {
    const result = getAPIFromUniqueIdentifier(
      {} as AppConfig,
      'custom.v1.all.unknown.get_users',
    );
    expect(result).toBeNull();
  });

  it('should handle empty identifier', () => {
    const result = getAPIFromUniqueIdentifier(mockConfig as AppConfig, '');
    expect(result).toBeNull();
  });
});

describe('parseApiIdentifier', () => {
  it('should parse a valid 5-part identifier', () => {
    const result = parseApiIdentifier('aggregate.v1.users.id.getAggregation');
    expect(result).toEqual({
      module: 'aggregate',
      variant: 'v1',
      model: 'users',
      field: 'id',
      operation: 'getAggregation',
    });
  });

  it('should parse identifier with different components', () => {
    const result = parseApiIdentifier('model.admin.posts.title.search');
    expect(result).toEqual({
      module: 'model',
      variant: 'admin',
      model: 'posts',
      field: 'title',
      operation: 'search',
    });
  });

  it('should parse identifier with "default" variant', () => {
    const result = parseApiIdentifier(
      'aggregate.default.users.id.getAggregation',
    );
    expect(result).toEqual({
      module: 'aggregate',
      variant: 'default',
      model: 'users',
      field: 'id',
      operation: 'getAggregation',
    });
  });

  it('should return null for identifier with less than 5 parts', () => {
    expect(parseApiIdentifier('aggregate.v1.users.id')).toBeNull();
    expect(parseApiIdentifier('aggregate.v1.users')).toBeNull();
    expect(parseApiIdentifier('aggregate.v1')).toBeNull();
    expect(parseApiIdentifier('aggregate')).toBeNull();
  });

  it('should return null for identifier with more than 5 parts', () => {
    expect(
      parseApiIdentifier('aggregate.v1.users.id.getAggregation.extra'),
    ).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseApiIdentifier('')).toBeNull();
  });

  it('should handle identifiers with special field names', () => {
    expect(parseApiIdentifier('model.v1.users.unknown.getAll')).toEqual({
      module: 'model',
      variant: 'v1',
      model: 'users',
      field: 'unknown',
      operation: 'getAll',
    });

    expect(parseApiIdentifier('custom.v1.all.unknown.myEndpoint')).toEqual({
      module: 'custom',
      variant: 'v1',
      model: 'all',
      field: 'unknown',
      operation: 'myEndpoint',
    });
  });
});

describe('buildApiIdentifier', () => {
  it('should build a valid identifier from components', () => {
    const result = buildApiIdentifier(
      'aggregate',
      'v1',
      'users',
      'id',
      'getAggregation',
    );
    expect(result).toBe('aggregate.v1.users.id.getAggregation');
  });

  it('should build identifier with admin variant', () => {
    const result = buildApiIdentifier(
      'aggregate',
      'admin',
      'users',
      'id',
      'getAggregation',
    );
    expect(result).toBe('aggregate.admin.users.id.getAggregation');
  });

  it('should build identifier with default variant', () => {
    const result = buildApiIdentifier(
      'aggregate',
      'default',
      'posts',
      'views',
      'getAggregation',
    );
    expect(result).toBe('aggregate.default.posts.views.getAggregation');
  });

  it('should build identifier for model module', () => {
    const result = buildApiIdentifier(
      'model',
      'v1',
      'users',
      'unknown',
      'getAll',
    );
    expect(result).toBe('model.v1.users.unknown.getAll');
  });

  it('should build identifier for custom endpoints', () => {
    const result = buildApiIdentifier(
      'custom',
      'v1',
      'all',
      'unknown',
      'myEndpoint',
    );
    expect(result).toBe('custom.v1.all.unknown.myEndpoint');
  });

  it('should build identifier for auth module', () => {
    const result = buildApiIdentifier(
      'auth',
      'v1',
      'users',
      'unknown',
      'login',
    );
    expect(result).toBe('auth.v1.users.unknown.login');
  });

  it('should handle empty strings in components', () => {
    const result = buildApiIdentifier('', '', '', '', '');
    expect(result).toBe('....');
  });

  it('should build correct format regardless of component values', () => {
    const result = buildApiIdentifier(
      'module123',
      'variant-name',
      'model_name',
      'field.name',
      'operation_1',
    );
    expect(result).toBe(
      'module123.variant-name.model_name.field.name.operation_1',
    );
  });
});
