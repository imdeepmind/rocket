import {describe, expect, it} from 'vitest';

import {resolveConfig} from '@/lib/config/resolve';

import {
  AppConfig,
  CustomEndpointConfig,
  DatabaseConfig,
  ModelConfig,
  ResolvedAppConfig,
} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';

const getDefaultDatabaseConfig = (): DatabaseConfig => ({
  engine: 'sqlite',
  connection: {
    url: './test.db',
  },
});

const getDefaultModelConfig = (): Record<string, ModelConfig> => ({
  users: {
    fields: {
      id: {type: 'integer', primaryKey: true, unique: true, nullable: false},
      email: {type: 'string', unique: true, nullable: false},
      name: {type: 'string', nullable: false},
    },
  },
});

const rawBaseConfig: AppConfig = {
  application: {
    name: 'Test App',
    logLevel: 'info',
  },
  docs: {
    openapi: {
      enabled: false,
      path: '/api',
      info: {
        title: 'Test API',
        description: 'Test API description',
        version: '1.0.0',
      },
    },
  },
  infrastructure: {database: getDefaultDatabaseConfig()},
  data: {models: getDefaultModelConfig()},
};

const createConfigWithEndpoints = (
  customEndpoints: Record<string, CustomEndpointConfig>,
): ResolvedAppConfig => {
  return {
    ...resolveConfig(rawBaseConfig, {mode: 'dev'}),
    customEndpoints,
  };
};

describe('custom endpoints validation', () => {
  describe('SQL handler path parameter consistency', () => {
    it('passes when explicit path parameter matches SQL query placeholder', () => {
      const config = createConfigWithEndpoints({
        getUser: {
          method: 'GET',
          path: '/users/:id',
          description: 'Get user by id',
          handler: {
            type: 'sql',
            sql: 'SELECT * FROM users WHERE id = [[path.id:integer]];',
          },
        },
      });

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('passes with nested parameterized path matching multiple placeholders', () => {
      const config = createConfigWithEndpoints({
        getUserPost: {
          method: 'GET',
          path: '/users/:userId/posts/:postId',
          description: 'Get post for user',
          handler: {
            type: 'sql',
            sql: 'SELECT * FROM posts WHERE user_id = [[path.userId:integer]] AND id = [[path.postId:integer]];',
          },
        },
      });

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('throws when SQL has path placeholder but path lacks the parameter', () => {
      const config = createConfigWithEndpoints({
        getUser: {
          method: 'GET',
          path: '/users',
          description: 'Get user by id',
          handler: {
            type: 'sql',
            sql: 'SELECT * FROM users WHERE id = [[path.id:integer]];',
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/getUser/handler/sql: path placeholder "id" does not exist in path "/users"',
      );
    });

    it('throws when path has parameter but SQL lacks the placeholder', () => {
      const config = createConfigWithEndpoints({
        getUser: {
          method: 'GET',
          path: '/users/:id',
          description: 'Get user by id',
          handler: {
            type: 'sql',
            sql: 'SELECT * FROM users;',
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/getUser/handler/sql: path parameter "id" from path "/users/:id" is missing placeholder in SQL query',
      );
    });
  });

  describe('Function handler validation', () => {
    it('passes with valid function handler configuration and input mapping', () => {
      const config = createConfigWithEndpoints({
        createUser: {
          method: 'POST',
          path: '/users/:id',
          description: 'Create user with custom handler',
          validation: {
            type: 'object',
            required: ['id', 'name', 'filter'],
            properties: {
              id: {type: 'integer'},
              name: {type: 'string'},
              filter: {type: 'string'},
            },
          },
          handler: {
            type: 'function',
            file: './functions/user.ts',
            exportName: 'createUserHandler',
            inputs: {
              path: ['id'],
              body: ['name'],
              query: ['filter'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('passes with function handler with no inputs', () => {
      const config = createConfigWithEndpoints({
        ping: {
          method: 'GET',
          path: '/ping',
          description: 'Ping endpoint',
          handler: {
            type: 'function',
            file: './functions/ping.ts',
            exportName: 'pingHandler',
          },
        },
      });

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('throws when required fields file or exportName are missing', () => {
      const config = createConfigWithEndpoints({
        broken: {
          method: 'GET',
          path: '/broken',
          description: 'Broken endpoint',
          // @ts-expect-error missing file & exportName
          handler: {
            type: 'function',
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/broken/handler',
      );
    });

    it('throws when inputs are defined but validation schema has no properties', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'POST',
          path: '/test/:id',
          description: 'Test fn',
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              path: ['id'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs: validation schema properties must be defined when inputs are specified',
      );
    });

    it('throws when path parameter is not in validation.properties', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'GET',
          path: '/test/:id',
          description: 'Test fn',
          validation: {
            type: 'object',
            properties: {},
          },
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              path: ['id'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs/path: parameter "id" not declared in validation schema properties',
      );
    });

    it('throws when query parameter is not in validation.properties', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'GET',
          path: '/test',
          description: 'Test fn',
          validation: {
            type: 'object',
            properties: {},
          },
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              query: ['search'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs/query: parameter "search" not declared in validation schema properties',
      );
    });

    it('throws when body parameter is not in validation.properties', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'POST',
          path: '/test',
          description: 'Test fn',
          validation: {
            type: 'object',
            properties: {},
          },
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              body: ['name'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs/body: parameter "name" not declared in validation schema properties',
      );
    });

    it('throws when body inputs are specified for GET method', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'GET',
          path: '/test',
          description: 'Test fn',
          validation: {
            type: 'object',
            properties: {
              name: {type: 'string'},
            },
          },
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              body: ['name'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs: body inputs are not allowed for GET method',
      );
    });

    it('throws when body inputs are specified for DELETE method', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'DELETE',
          path: '/test',
          description: 'Test fn',
          validation: {
            type: 'object',
            properties: {
              name: {type: 'string'},
            },
          },
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              body: ['name'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs: body inputs are not allowed for DELETE method',
      );
    });

    it('throws when path parameter in URL is not declared in inputs.path', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'GET',
          path: '/users/:id',
          description: 'Test fn',
          validation: {
            type: 'object',
            properties: {
              id: {type: 'integer'},
            },
          },
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              path: [],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs/path: path parameter "id" must be declared in handler.inputs.path',
      );
    });

    it('throws when parameter in inputs.path is not in URL path', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'GET',
          path: '/users',
          description: 'Test fn',
          validation: {
            type: 'object',
            properties: {
              id: {type: 'integer'},
            },
          },
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              path: ['id'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs/path: parameter "id" does not exist in path "/users"',
      );
    });

    it('throws when parameter is duplicated across input sources', () => {
      const config = createConfigWithEndpoints({
        testFn: {
          method: 'POST',
          path: '/users',
          description: 'Test fn',
          validation: {
            type: 'object',
            properties: {
              status: {type: 'string'},
            },
          },
          handler: {
            type: 'function',
            file: './functions/test.ts',
            exportName: 'test',
            inputs: {
              query: ['status'],
              body: ['status'],
            },
          },
        },
      });

      expect(() => validateConfig(config)).toThrow(
        '/customEndpoints/testFn/handler/inputs: parameter "status" cannot be declared in multiple input sources',
      );
    });
  });
});
