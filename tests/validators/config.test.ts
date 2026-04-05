import { describe, expect, it } from 'vitest';
import { validateConfig } from '../../src/validators/config';
import { AppConfig, DatabaseConfig, ModelConfig } from '../../src/schema/config';

const getDefaultDatabaseConfig = (): DatabaseConfig => {
  return {
    engine: 'sqlite',
    connection: {
      urlOrPath: './test.db',
    },
  };
};

const getDefaultModelConfig = (): ModelConfig[] => {
  return [
    {
      name: 'User',
      fields: [
        {
          name: 'id',
          type: 'integer',
          primaryKey: true,
          unique: true,
          nullable: false,
        },
        {
          name: 'name',
          type: 'string',
        },
      ],
    },
  ];
};

const validBaseConfig: AppConfig = {
  swagger: {
    enabled: true,
    basePath: '/api',
    info: {
      title: 'Test API',
      description: 'Test API description for testing',
      version: '1.0.0',
    },
  },
  database: getDefaultDatabaseConfig(),
  models: getDefaultModelConfig(),
};

describe('validateInvalidSwaggerConfig', () => {
  it.each([
    {
      name: 'enabled as invalid',
      patch: { enabled: 'wrong' },
      expected: '/swagger/enabled must be boolean',
    },
    {
      name: 'enabled as undefined',
      patch: { enabled: undefined },
      expected: "/swagger must have required property 'enabled'",
    },
    {
      name: 'invalid base path',
      patch: { basePath: 'wrong' },
      expected: '/swagger/basePath must match pattern "^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$"',
    },
    {
      name: 'invalid base path',
      patch: { basePath: 'api/docs' },
      expected: '/swagger/basePath must match pattern "^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$"',
    },
    {
      name: 'swagger title undefined',
      patch: { info: { title: undefined } },
      expected: "/swagger/info must have required property 'title'",
    },
    {
      name: 'swagger title too small',
      patch: { info: { title: '1234' } },
      expected: '/swagger/info/title must NOT have fewer than 5 characters',
    },
    {
      name: 'swagger description too small',
      patch: { info: { title: validBaseConfig.swagger.info.title, description: '1234' } },
      expected: '/swagger/info/description must NOT have fewer than 25 characters',
    },
    {
      name: 'swagger termsOfService not valid url',
      patch: { info: { title: validBaseConfig.swagger.info.title, termsOfService: '1234' } },
      expected: '/swagger/info/termsOfService must match format "uri"',
    },
    {
      name: 'swagger termsOfService not valid url',
      patch: { info: { title: validBaseConfig.swagger.info.title, termsOfService: '/api/base' } },
      expected: '/swagger/info/termsOfService must match format "uri"',
    },
    {
      name: 'swagger contact name too small',
      patch: { info: { title: validBaseConfig.swagger.info.title, contact: { name: '1234' } } },
      expected: '/swagger/info/contact/name must NOT have fewer than 5 characters',
    },
    {
      name: 'swagger contact url is not valid url',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: { name: '1234', url: '/api/base' },
        },
      },
      expected: '/swagger/info/contact/url must match format "uri"',
    },
    {
      name: 'swagger contact email is not valid email',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: { name: '1234', email: '1234' },
        },
      },
      expected: '/swagger/info/contact/email must match format "email"',
    },
    {
      name: 'swagger contact license name too small',
      patch: { info: { title: validBaseConfig.swagger.info.title, license: { name: '' } } },
      expected: '/swagger/info/license/name must NOT have fewer than 1 characters',
    },
    {
      name: 'swagger contact license uri is not valid url',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          license: { name: 'MIT', url: '/api/base' },
        },
      },
      expected: '/swagger/info/license/url must match format "uri"',
    },
  ])('Scenario: $name -> should throw: "$expectedError"', ({ patch, expected }) => {
    const config = {
      ...validBaseConfig,
      swagger: {
        ...validBaseConfig.swagger,
        ...patch,
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrowError(expected);
  });
});

describe('validateValidSwaggerConfig', () => {
  it.each([
    {
      name: 'enabled as true',
      patch: { enabled: true },
    },
    {
      name: 'enabled as false',
      patch: { enabled: false },
    },
    {
      name: 'valid base path',
      patch: { basePath: '/api/docs' },
    },
    {
      name: 'swagger title',
      patch: { info: { title: 'Valid docs title' } },
    },
    {
      name: 'swagger description',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          description: 'This is 25 chars long valid api description',
        },
      },
    },
    {
      name: 'swagger termsOfService',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          termsOfService: 'https://imdeepmind.com/terms',
        },
      },
    },
    {
      name: 'swagger contact name',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: { name: 'Abhishek Chatterjee' },
        },
      },
    },
    {
      name: 'swagger contact url',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: { name: 'Abhishek Chatterjee', url: 'https://imdeepmind.com' },
        },
      },
    },
    {
      name: 'swagger contact email',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: { name: 'Abhishek Chatterjee', email: 'abhishek@imdeepmind.com' },
        },
      },
    },
    {
      name: 'swagger contact license name',
      patch: { info: { title: validBaseConfig.swagger.info.title, license: { name: 'MIT' } } },
    },
    {
      name: 'swagger contact license uri',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
        },
      },
    },
  ])('Scenario: $name -> should return', ({ patch }) => {
    const config = {
      ...validBaseConfig,
      swagger: {
        ...validBaseConfig.swagger,
        ...patch,
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});
