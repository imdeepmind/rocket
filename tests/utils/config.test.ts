import {describe, expect, it} from 'vitest';

import {AppConfig} from '@/interfaces/config';

import {getAPIFromUniqueIdentifier, resolveEnvVars} from '@/utils/config';

describe('Config Utilities', () => {
  describe('resolveEnvVars', () => {
    it('should resolve environment variables in a string', () => {
      process.env.TEST_VAR = 'resolved_value';
      expect(resolveEnvVars('env:TEST_VAR')).toBe('resolved_value');
    });

    it('should return original string if env var not found', () => {
      expect(resolveEnvVars('env:NON_EXISTENT')).toBe('env:NON_EXISTENT');
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
      customAPIs: {
        customQueries: [
          {
            name: 'get_users',
            method: 'GET',
            path: '/users',
            query: 'SELECT * FROM users',
          },
          {
            name: 'create_user',
            method: 'POST',
            path: '/users',
            query: 'INSERT INTO users ...',
          },
        ],
      },
    };

    it('should return the correct custom query config for a valid identifier', () => {
      const result = getAPIFromUniqueIdentifier(
        mockConfig as AppConfig,
        'customAPIs->customQueries->get_users',
      );
      expect(result).toEqual(mockConfig.customAPIs?.customQueries?.[0]);
    });

    it('should return null if the first part is not customAPIs', () => {
      const result = getAPIFromUniqueIdentifier(
        mockConfig as AppConfig,
        'modelAPIs->get-all->users',
      );
      expect(result).toBeNull();
    });

    it('should return null if the second part is not customQueries', () => {
      const result = getAPIFromUniqueIdentifier(
        mockConfig as AppConfig,
        'customAPIs->somethingElse->get_users',
      );
      expect(result).toBeNull();
    });

    it('should return null if the custom query name is not found', () => {
      const result = getAPIFromUniqueIdentifier(
        mockConfig as AppConfig,
        'customAPIs->customQueries->non_existent',
      );
      expect(result).toBeNull();
    });

    it('should return null if customQueries is missing in config', () => {
      const result = getAPIFromUniqueIdentifier(
        {} as AppConfig,
        'customAPIs->customQueries->get_users',
      );
      expect(result).toBeNull();
    });

    it('should handle empty identifier', () => {
      const result = getAPIFromUniqueIdentifier(mockConfig as AppConfig, '');
      expect(result).toBeNull();
    });
  });
});
