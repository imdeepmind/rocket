import {describe, expect, it} from 'vitest';

import {AppConfig} from '@/interfaces/config';

import {getAPIFromUniqueIdentifier, resolveEnvVars} from '@/utils/config';

describe('Config Utilities', () => {
  describe('resolveEnvVars', () => {
    it('should resolve environment variables in a string', () => {
      process.env.TEST_VAR = 'resolved_value';
      expect(resolveEnvVars('env:TEST_VAR')).toBe('resolved_value');
    });

    it('should throw if env var is not found', () => {
      expect(() => resolveEnvVars('env:NON_EXISTENT')).toThrow(
        'environment variable "NON_EXISTENT"',
      );
    });

    it('should throw if env var name is empty', () => {
      expect(() => resolveEnvVars('env:')).toThrow(
        'has an empty environment variable name',
      );
    });

    it('should not change string if it does not start with env:', () => {
      expect(resolveEnvVars('normal_string')).toBe('normal_string');
    });

    it('should recursively resolve environment variables in an object', () => {
      process.env.VAR1 = 'val1';
      process.env.VAR2 = 'val2';
      const config = {
        a: 'env:VAR1',
        b: {
          c: 'env:VAR2',
          d: 'plain',
        },
        e: ['env:VAR1', 'plain'],
      };
      const expected = {
        a: 'val1',
        b: {
          c: 'val2',
          d: 'plain',
        },
        e: ['val1', 'plain'],
      };
      expect(resolveEnvVars(config)).toEqual(expected);
    });

    it('should handle null and non-object types', () => {
      expect(resolveEnvVars(null)).toBe(null);
      expect(resolveEnvVars(123)).toBe(123);
      expect(resolveEnvVars(true)).toBe(true);
    });
  });

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
        'customEndpoints.get_users',
      );
      expect(result).toEqual(mockConfig.customEndpoints?.get_users);
    });

    it('should return null if the first part is not customEndpoints', () => {
      const result = getAPIFromUniqueIdentifier(
        mockConfig as AppConfig,
        'modelAPIs.users.all.getAll',
      );
      expect(result).toBeNull();
    });

    it('should return null if the second part is not all', () => {
      const result = getAPIFromUniqueIdentifier(
        mockConfig as AppConfig,
        'customEndpoints.somethingElse.get_users',
      );
      expect(result).toBeNull();
    });

    it('should return null if the custom endpoint name is not found', () => {
      const result = getAPIFromUniqueIdentifier(
        mockConfig as AppConfig,
        'customEndpoints.non_existent',
      );
      expect(result).toBeNull();
    });

    it('should return null if customEndpoints is missing in config', () => {
      const result = getAPIFromUniqueIdentifier(
        {} as AppConfig,
        'customEndpoints.get_users',
      );
      expect(result).toBeNull();
    });

    it('should handle empty identifier', () => {
      const result = getAPIFromUniqueIdentifier(mockConfig as AppConfig, '');
      expect(result).toBeNull();
    });
  });
});
