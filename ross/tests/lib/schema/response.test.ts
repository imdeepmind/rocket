import {expect, test} from 'vitest';

import {
  buildSecurityArray,
  getResponseStructureSchema,
} from '@/lib/schema/response';

import {ResolvedAppConfig} from '@/interfaces/config';

// test cases for getResponseStructureSchema
test('should get response structure schema', () => {
  const codes = [200, 201, 204];
  const dataSchema = {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        description: 'Value for id',
      },
      name: {
        type: 'string',
        description: 'Value for name',
      },
      email: {
        type: 'string',
        description: 'Value for email',
      },
      age: {
        type: 'integer',
        description: 'Value for age',
      },
    },
    required: ['id', 'name', 'email'],
  };
  const expectedSchema = {
    200: {
      type: 'object',
      properties: {
        code: {type: 'integer'},
        message: {type: 'string'},
        data: dataSchema,
      },
    },
    201: {
      type: 'object',
      properties: {
        code: {type: 'integer'},
        message: {type: 'string'},
        data: dataSchema,
      },
    },
    204: {
      type: 'null',
      description: 'Successfully deleted the entry',
    },
  };
  expect(getResponseStructureSchema(codes, dataSchema)).toEqual(expectedSchema);
});

test('should throw error for unsupported HTTP status code', () => {
  const codes = [999];
  const dataSchema = {};
  expect(() => getResponseStructureSchema(codes, dataSchema)).toThrow(
    'Unsupported HTTP status code: 999',
  );
});

test('getResponseStructureSchema does not include raw_data', () => {
  const codes = [200, 201];
  const dataSchema = {type: 'object', properties: {test: {type: 'string'}}};
  const schema = getResponseStructureSchema(codes, dataSchema) as Record<
    number,
    {type: string; properties?: Record<string, unknown>}
  >;
  expect(schema[200].properties).not.toHaveProperty('raw_data');
  expect(schema[201].properties).not.toHaveProperty('raw_data');
});

// test cases for buildSecurityArray
const baseConfig = {
  application: {name: 'test', logLevel: 'info'},
  docs: {
    openapi: {
      enabled: false,
      path: '/docs',
      info: {title: 'Test', version: '1.0.0'},
    },
  },
  infrastructure: {
    database: {
      engine: 'postgres',
      connection: {url: 'postgresql://localhost:5432/test'},
    },
  },
  data: {models: {}},
} as unknown as ResolvedAppConfig;

const upAuthUserModel = {
  model: 'user',
  idField: 'id',
  usernameField: 'email',
  passwordField: 'password',
};

test('should return empty array when authentication is disabled', () => {
  const config = {
    ...baseConfig,
    authentication: {
      enabled: false,
      provider: {type: 'up-auth', config: {userModel: upAuthUserModel}},
    },
  } as unknown as ResolvedAppConfig;
  expect(buildSecurityArray(config, true)).toEqual([]);
});

test('should return empty array when authentication is disabled and authorization is false', () => {
  const config = {
    ...baseConfig,
    authentication: {
      enabled: false,
      provider: {type: 'up-auth', config: {userModel: upAuthUserModel}},
    },
  } as unknown as ResolvedAppConfig;
  expect(buildSecurityArray(config, false)).toEqual([]);
});

test('should return bearerAuth when provider is up-auth and authorization is true', () => {
  const config = {
    ...baseConfig,
    authentication: {
      enabled: true,
      provider: {type: 'up-auth', config: {userModel: upAuthUserModel}},
    },
  } as unknown as ResolvedAppConfig;
  expect(buildSecurityArray(config, true)).toEqual([{bearerAuth: []}]);
});

test('should return apiKeyAuth when provider is api-key and authorization is true', () => {
  const config = {
    ...baseConfig,
    authentication: {
      enabled: true,
      provider: {type: 'api-key', config: {key: 'test-key'}},
    },
  } as unknown as ResolvedAppConfig;
  expect(buildSecurityArray(config, true)).toEqual([{apiKeyAuth: []}]);
});

test('should return empty array when authorization is false even if auth is enabled', () => {
  const config = {
    ...baseConfig,
    authentication: {
      enabled: true,
      provider: {type: 'up-auth', config: {userModel: upAuthUserModel}},
    },
  } as unknown as ResolvedAppConfig;
  expect(buildSecurityArray(config, false)).toEqual([]);
});

test('should return empty array when authorization is false with api-key provider', () => {
  const config = {
    ...baseConfig,
    authentication: {
      enabled: true,
      provider: {type: 'api-key', config: {key: 'test-key'}},
    },
  } as unknown as ResolvedAppConfig;
  expect(buildSecurityArray(config, false)).toEqual([]);
});
