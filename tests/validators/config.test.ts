import {describe, expect, it} from 'vitest';

import {
  ApisConfig,
  AppConfig,
  CustomEndpointConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';
import validateAuthConstraints from '@/validators/config/validate-auth';

const getDefaultDatabaseConfig = (): DatabaseConfig => {
  return {
    engine: 'sqlite',
    connection: {
      url: './test.db',
    },
  };
};

const getDefaultModelConfig = (): Record<string, ModelConfig> => {
  return {
    users: {
      table: 'users',
      fields: {
        id: {type: 'integer', primaryKey: true, unique: true, nullable: false},
        name: {type: 'string'},
        is_active: {type: 'boolean'},
        updated_at: {type: 'datetime'},
      },
    },
    posts: {
      table: 'posts',
      fields: {
        title: {
          type: 'string',
          nullable: false,
          operations: ['search', 'sort'],
          aggregations: ['count'],
        },
        body: {type: 'text', nullable: true},
        user_id: {
          type: 'integer',
          nullable: false,
          operations: ['eq', 'in'],
          aggregations: ['count'],
        },
        created_at: {type: 'datetime', operations: ['lt', 'gt', 'sort']},
      },
    },
  };
};

const validBaseConfig: AppConfig = {
  application: {
    name: 'Test App',
    logLevel: 'info',
  },
  docs: {
    openapi: {
      enabled: true,
      path: '/api',
      info: {
        title: 'Test API',
        description: 'Test API description for testing',
        version: '1.0.0',
      },
    },
  },
  infrastructure: {primaryDatabase: getDefaultDatabaseConfig()},
  data: {models: getDefaultModelConfig()},
};

describe('validateInvalidDocsConfig', () => {
  it.each([
    {
      name: 'enabled as invalid',
      patch: {enabled: 'wrong'},
      expected: '/docs/openapi/enabled must be boolean',
    },
    {
      name: 'enabled as undefined',
      patch: {enabled: undefined},
      expected: "/docs/openapi must have required property 'enabled'",
    },
    {
      name: 'invalid path',
      patch: {path: 'wrong'},
      expected:
        '/docs/openapi/path must match pattern "^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$"',
    },
    {
      name: 'invalid path missing leading slash',
      patch: {path: 'api/docs'},
      expected:
        '/docs/openapi/path must match pattern "^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$"',
    },
    {
      name: 'openapi title undefined',
      patch: {info: {title: undefined, version: '1.0.0'}},
      expected: "/docs/openapi/info must have required property 'title'",
    },
    {
      name: 'openapi title too small',
      patch: {info: {title: '1234', version: '1.0.0'}},
      expected:
        '/docs/openapi/info/title must NOT have fewer than 5 characters',
    },
    {
      name: 'openapi description too small',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          description: '',
        },
      },
      expected:
        '/docs/openapi/info/description must NOT have fewer than 1 characters',
    },
    {
      name: 'openapi version missing',
      patch: {info: {title: validBaseConfig.docs.openapi.info.title}},
      expected: "/docs/openapi/info must have required property 'version'",
    },
    {
      name: 'openapi termsOfService not valid url',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          termsOfService: '1234',
        },
      },
      expected: '/docs/openapi/info/termsOfService must match format "uri"',
    },
    {
      name: 'openapi termsOfService not valid url',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          termsOfService: '/api/base',
        },
      },
      expected: '/docs/openapi/info/termsOfService must match format "uri"',
    },
    {
      name: 'openapi contact name too small',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          contact: {name: '1234'},
        },
      },
      expected:
        '/docs/openapi/info/contact/name must NOT have fewer than 5 characters',
    },
    {
      name: 'openapi contact url is not valid url',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          contact: {name: '1234', url: '/api/base'},
        },
      },
      expected: '/docs/openapi/info/contact/url must match format "uri"',
    },
    {
      name: 'openapi contact email is not valid email',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          contact: {name: '1234', email: '1234'},
        },
      },
      expected: '/docs/openapi/info/contact/email must match format "email"',
    },
    {
      name: 'openapi license name too small',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          license: {name: ''},
        },
      },
      expected:
        '/docs/openapi/info/license/name must NOT have fewer than 1 characters',
    },
    {
      name: 'openapi license uri is not valid url',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          license: {name: 'MIT', url: '/api/base'},
        },
      },
      expected: '/docs/openapi/info/license/url must match format "uri"',
    },
  ])('Scenario: $name . should throw: "$expected"', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      docs: {
        openapi: {
          ...validBaseConfig.docs.openapi,
          ...patch,
        } as typeof validBaseConfig.docs.openapi,
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });

  it('should throw when openapi property is missing from docs', () => {
    const config = {
      ...validBaseConfig,
      docs: {} as typeof validBaseConfig.docs,
    };
    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      "/docs must have required property 'openapi'",
    );
  });
});

describe('validateValidDocsConfig', () => {
  it.each([
    {
      name: 'enabled as true',
      patch: {enabled: true},
    },
    {
      name: 'enabled as false',
      patch: {enabled: false},
    },
    {
      name: 'valid path',
      patch: {path: '/api/docs'},
    },
    {
      name: 'openapi title',
      patch: {info: {title: 'Valid docs title', version: '1.0.0'}},
    },
    {
      name: 'openapi description',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          description: 'This is 25 chars long valid api description',
        },
      },
    },
    {
      name: 'openapi termsOfService',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          termsOfService: 'https://imdeepmind.com/terms',
        },
      },
    },
    {
      name: 'openapi contact name',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          contact: {name: 'Abhishek Chatterjee'},
        },
      },
    },
    {
      name: 'openapi contact url',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          contact: {name: 'Abhishek Chatterjee', url: 'https://imdeepmind.com'},
        },
      },
    },
    {
      name: 'openapi contact email',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          contact: {
            name: 'Abhishek Chatterjee',
            email: 'abhishek@imdeepmind.com',
          },
        },
      },
    },
    {
      name: 'openapi license name',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          license: {name: 'MIT'},
        },
      },
    },
    {
      name: 'openapi license uri',
      patch: {
        info: {
          title: validBaseConfig.docs.openapi.info.title,
          version: '1.0.0',
          license: {name: 'MIT', url: 'https://opensource.org/licenses/MIT'},
        },
      },
    },
  ])('Scenario: $name . should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      docs: {
        openapi: {
          ...validBaseConfig.docs.openapi,
          ...patch,
        } as typeof validBaseConfig.docs.openapi,
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

describe('validateInvalidDatabaseConfig', () => {
  it.each([
    {
      name: 'engine as invalid',
      patch: {engine: 'wrong', connection: {url: './database.db'}},
      expected:
        '/infrastructure/primaryDatabase/engine must be equal to constant',
    },
    {
      name: 'engine as undefined',
      patch: {engine: undefined, connection: {url: './database.db'}},
      expected:
        "/infrastructure/primaryDatabase must have required property 'engine'",
    },
    {
      name: 'connection.url as empty string',
      patch: {engine: 'postgres', connection: {url: ''}},
      expected:
        '/infrastructure/primaryDatabase/connection/url must match pattern "^postgres(ql)?:\\/\\/"',
    },
    {
      name: 'connection.url wrong pg connection string',
      patch: {engine: 'postgres', connection: {url: './database.db'}},
      expected:
        '/infrastructure/primaryDatabase/connection/url must match pattern "^postgres(ql)?:\\/\\/"',
    },
    {
      name: 'connection.url wrong sqlite connection string',
      patch: {
        engine: 'sqlite',
        connection: {
          url: '.postgres://devuser:devpassword@db:5432/rocketdb',
        },
      },
      expected:
        '/infrastructure/primaryDatabase/connection/url must match pattern "^(.\\/|\\/)?([\\w\\-. ]+\\/)*[\\w\\-. ]+\\.(db|sqlite)$"',
    },
  ])('Scenario: $name . should throw: "$expected"', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      infrastructure: {
        primaryDatabase: {
          ...validBaseConfig.infrastructure.primaryDatabase,
          ...patch,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidDatabaseConfig', () => {
  it.each([
    {
      name: 'engine as postgres',
      patch: {
        engine: 'postgres',
        connection: {
          url: 'postgres://devuser:devpassword@db:5432/rocketdb',
        },
      },
    },
    {
      name: 'engine as sqlite',
      patch: {engine: 'sqlite', connection: {url: './database.db'}},
    },
  ])('Scenario: $name . should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      infrastructure: {
        primaryDatabase: {
          ...validBaseConfig.infrastructure.primaryDatabase,
          ...patch,
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

describe('validateInvalidModelFieldsConfig', () => {
  it.each([
    // ============== invalid name tests ==============
    {
      name: 'invalid name',
      patch: {table: '132234asd'},
      expected:
        'Entity name "132234asd" is not valid, must start with a letter or underscore and contain only letters, numbers, hyphens and underscores',
    },
    {
      name: 'invalid name',
      patch: {table: 'sad asdas'},
      expected:
        'Entity name "sad asdas" is not valid, must start with a letter or underscore and contain only letters, numbers, hyphens and underscores',
    },
    {
      name: 'table as undefined',
      patch: {table: undefined},
      expected: "/data/models/test must have required property 'table'",
    },
    // ============== end of invalid name tests ===============
    // ============== invalid fields tests ==============
    {
      name: 'empty field',
      patch: {fields: {}},
      expected:
        '/data/models/test/fields must NOT have fewer than 1 properties',
    },
    {
      name: 'invalid field.type',
      patch: {fields: {test: {type: undefined}}},
      expected:
        "/data/models/test/fields/test must have required property 'type'",
    },
    {
      name: 'invalid field.type',
      patch: {fields: {test: {type: 'invalid'}}},
      expected:
        '/data/models/test/fields/test/type must be equal to one of the allowed values',
    },
    {
      name: 'invalid field.primaryKey',
      patch: {
        fields: {test: {type: 'integer', primaryKey: 'invalid'}},
      },
      expected: '/data/models/test/fields/test/primaryKey must be boolean',
    },
    {
      name: 'invalid field.primaryKey',
      patch: {
        fields: {test: {type: 'boolean', primaryKey: true}},
      },
      expected:
        '/data/models/test/fields/test: primaryKey field must be of type integer or string (found boolean)',
    },
    {
      name: 'invalid field.primaryKey',
      patch: {
        fields: {test: {type: 'text', primaryKey: true}},
      },
      expected:
        '/data/models/test/fields/test: primaryKey field must be of type integer or string (found text)',
    },
    {
      name: 'invalid field.primaryKey',
      patch: {
        fields: {test: {type: 'datetime', primaryKey: true}},
      },
      expected:
        '/data/models/test/fields/test: primaryKey field must be of type integer or string (found datetime)',
    },
    {
      name: 'invalid field.unique',
      patch: {
        fields: {test: {type: 'string', unique: 'invalid'}},
      },
      expected: '/data/models/test/fields/test/unique must be boolean',
    },
    {
      name: 'invalid field.autoIncrement',
      patch: {
        fields: {test: {type: 'integer', autoIncrement: 'invalid'}},
      },
      expected: '/data/models/test/fields/test/autoIncrement must be boolean',
    },
    {
      name: 'autoIncrement on non-primaryKey field',
      patch: {
        fields: {test: {type: 'integer', autoIncrement: true}},
      },
      expected:
        '/data/models/test/fields/test: autoIncrement is only allowed on primaryKey fields',
    },
    {
      name: 'autoIncrement on non-integer primaryKey',
      patch: {
        fields: {test: {type: 'string', primaryKey: true, autoIncrement: true}},
      },
      expected:
        '/data/models/test/fields/test: autoIncrement is only allowed on integer primaryKey fields',
    },
    {
      name: 'invalid field.nullable',
      patch: {
        fields: {test: {type: 'string', nullable: 'invalid'}},
      },
      expected: '/data/models/test/fields/test/nullable must be boolean',
    },
    {
      name: 'field.operations is not array',
      patch: {
        fields: {test: {type: 'string', operations: 'invalid'}},
      },
      expected: '/data/models/test/fields/test/operations must be array',
    },
    {
      name: 'field.operations contains invalid value',
      patch: {
        fields: {test: {type: 'string', operations: ['invalid']}},
      },
      expected:
        '/data/models/test/fields/test/operations/0 must be equal to one of the allowed values',
    },
    {
      name: 'field.operations contains invalid value for type=integer',
      patch: {
        fields: {test: {type: 'integer', operations: ['search']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "search" is not allowed for type "integer"',
    },
    {
      name: 'field.operations contains invalid value for type=decimal',
      patch: {
        fields: {test: {type: 'decimal', operations: ['search']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "search" is not allowed for type "decimal"',
    },
    {
      name: 'field.operations contains invalid value for type=date',
      patch: {
        fields: {test: {type: 'date', operations: ['search']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "search" is not allowed for type "date"',
    },
    {
      name: 'field.operations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', operations: ['lt']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "lt" is not allowed for type "string"',
    },
    {
      name: 'field.operations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', operations: ['lte']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "lte" is not allowed for type "string"',
    },
    {
      name: 'field.operations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', operations: ['gt']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "gt" is not allowed for type "string"',
    },
    {
      name: 'field.operations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', operations: ['gte']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "gte" is not allowed for type "string"',
    },
    {
      name: 'field.operations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', operations: ['search']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "search" is not allowed for type "boolean"',
    },
    {
      name: 'field.operations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', operations: ['sort']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "sort" is not allowed for type "boolean"',
    },
    {
      name: 'field.operations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', operations: ['edit']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "edit" is not allowed for type "boolean"',
    },
    {
      name: 'field.operations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', operations: ['delete']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "delete" is not allowed for type "boolean"',
    },
    {
      name: 'field.operations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', operations: ['lt']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "lt" is not allowed for type "boolean"',
    },
    {
      name: 'field.operations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', operations: ['lte']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "lte" is not allowed for type "boolean"',
    },
    {
      name: 'field.operations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', operations: ['gt']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "gt" is not allowed for type "boolean"',
    },
    {
      name: 'field.operations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', operations: ['gte']}},
      },
      expected:
        '/data/models/test/fields/test/operations: "gte" is not allowed for type "boolean"',
    },
    {
      name: 'field.aggregations is not array',
      patch: {
        fields: {test: {type: 'string', aggregations: 'invalid'}},
      },
      expected: '/data/models/test/fields/test/aggregations must be array',
    },
    {
      name: 'field.aggregations contains invalid value',
      patch: {
        fields: {test: {type: 'string', aggregations: ['invalid']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations/0 must be equal to one of the allowed values',
    },
    {
      name: 'field.aggregations contains invalid value for type=integer',
      patch: {
        fields: {test: {type: 'integer', aggregations: ['frequency']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "frequency" is not allowed for type "integer"',
    },
    {
      name: 'field.aggregations contains invalid value for type=decimal',
      patch: {
        fields: {test: {type: 'decimal', aggregations: ['frequency']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "frequency" is not allowed for type "decimal"',
    },
    {
      name: 'field.aggregations contains invalid value for type=date',
      patch: {
        fields: {test: {type: 'date', aggregations: ['frequency']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "frequency" is not allowed for type "date"',
    },
    {
      name: 'field.aggregations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', aggregations: ['avg']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "avg" is not allowed for type "string"',
    },
    {
      name: 'field.aggregations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', aggregations: ['max']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "max" is not allowed for type "string"',
    },
    {
      name: 'field.aggregations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', aggregations: ['min']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "min" is not allowed for type "string"',
    },
    {
      name: 'field.aggregations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', aggregations: ['sum']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "sum" is not allowed for type "string"',
    },
    {
      name: 'field.aggregations contains invalid value for type=string',
      patch: {
        fields: {test: {type: 'string', aggregations: ['frequency']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "frequency" is not allowed for type "string"',
    },
    {
      name: 'field.aggregations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', aggregations: ['avg']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "avg" is not allowed for type "boolean"',
    },
    {
      name: 'field.aggregations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', aggregations: ['max']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "max" is not allowed for type "boolean"',
    },
    {
      name: 'field.aggregations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', aggregations: ['min']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "min" is not allowed for type "boolean"',
    },
    {
      name: 'field.aggregations contains invalid value for type=boolean',
      patch: {
        fields: {test: {type: 'boolean', aggregations: ['sum']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "sum" is not allowed for type "boolean"',
    },
    {
      name: 'field.aggregations contains invalid value for type=text',
      patch: {
        fields: {test: {type: 'text', aggregations: ['avg']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "avg" is not allowed for type "text"',
    },
    {
      name: 'field.aggregations contains invalid value for type=text',
      patch: {
        fields: {test: {type: 'text', aggregations: ['max']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "max" is not allowed for type "text"',
    },
    {
      name: 'field.aggregations contains invalid value for type=text',
      patch: {
        fields: {test: {type: 'text', aggregations: ['min']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "min" is not allowed for type "text"',
    },
    {
      name: 'field.aggregations contains invalid value for type=text',
      patch: {
        fields: {test: {type: 'text', aggregations: ['sum']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "sum" is not allowed for type "text"',
    },
    {
      name: 'field.aggregations contains invalid value for type=text',
      patch: {
        fields: {test: {type: 'text', aggregations: ['count']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "count" is not allowed for type "text"',
    },
    {
      name: 'field.aggregations contains invalid value for type=text',
      patch: {
        fields: {test: {type: 'text', aggregations: ['frequency']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "frequency" is not allowed for type "text"',
    },
    {
      name: 'field.aggregations contains invalid value for type=datetime',
      patch: {
        fields: {test: {type: 'datetime', aggregations: ['sum']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "sum" is not allowed for type "datetime"',
    },
    {
      name: 'field.aggregations contains invalid value for type=datetime',
      patch: {
        fields: {test: {type: 'datetime', aggregations: ['frequency']}},
      },
      expected:
        '/data/models/test/fields/test/aggregations: "frequency" is not allowed for type "datetime"',
    },
  ])('Scenario: $name . should throw: "$expected"', ({patch, expected}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      data: {
        models: {
          test: {
            table: 'test',
            fields: {test: {type: 'string'}},
            ...(patch as Record<string, unknown>),
          } as ModelConfig,
        },
      },
    };

    expect(() => validateConfig(config)).toThrow(expected);
  });
});

describe('validateValidModelFieldsConfig', () => {
  it.each([
    {
      name: 'valid model',
      patch: {
        table: 'test',
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            unique: true,
            nullable: false,
          },
        },
      },
    },
    {
      name: 'valid model',
      patch: {
        table: 'test',
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            unique: true,
            nullable: false,
            operations: ['index', 'sort'],
          },
        },
      },
    },
    {
      name: 'valid model',
      patch: {
        table: 'test',
        fields: {
          id: {
            type: 'integer',
            primaryKey: true,
            unique: true,
            nullable: false,
            operations: ['index', 'sort'],
            aggregations: ['avg', 'max', 'min', 'count', 'sum'],
          },
        },
      },
    },
  ])('Scenario: $name . should return the same config', ({patch}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      data: {
        models: {
          test: patch as unknown as ModelConfig,
        },
      },
    };

    expect(validateConfig(config)).toEqual(config);
  });
});

describe('validateInvalidModelIndexesConfig', () => {
  it.each([
    {
      name: 'index.fields is not array',
      patch: {
        indexes: {test_index: {fields: 'test'}},
      },
      expected: '/data/models/test/indexes/test_index/fields must be array',
    },
    {
      name: 'index.field is pointing to wrong field',
      patch: {
        indexes: {test_index: {fields: ['age']}},
      },
      expected:
        '/data/models/test/indexes/test_index/fields: field "age" does not exist in model fields',
    },
    {
      name: 'index.field is empty',
      patch: {
        indexes: {test_index: {fields: ['']}},
      },
      expected:
        'Entity name "" is not valid, must start with a letter or underscore and contain only letters, numbers, hyphens and underscores',
    },
    {
      name: 'index.unique is not boolean',
      patch: {
        indexes: {test_index: {fields: ['id'], unique: 'test'}},
      },
      expected: '/data/models/test/indexes/test_index/unique must be boolean',
    },
    {
      name: 'index.unique is not boolean',
      patch: {
        indexes: {test_index: {fields: ['id'], unique: 123}},
      },
      expected: '/data/models/test/indexes/test_index/unique must be boolean',
    },
  ])('Scenario: $name . should throw: "$expected"', ({patch, expected}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      data: {
        models: {
          test: {
            table: 'test',
            fields: {test: {type: 'string'}},
            ...(patch as Record<string, unknown>),
          } as ModelConfig,
        },
      },
    };

    expect(() => validateConfig(config)).toThrow(expected);
  });
});

describe('validateValidModelIndexesConfig', () => {
  it.each([
    {
      name: 'valid model',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}, name: {type: 'string'}},
        indexes: {
          valid_index: {
            fields: ['id'],
            unique: true,
          },
        },
      },
    },
    {
      name: 'valid model',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}, name: {type: 'string'}},
        indexes: {
          valid_index: {
            fields: ['id', 'name'],
            unique: false,
          },
        },
      },
    },
    {
      name: 'not passing index',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}, name: {type: 'string'}},
      },
    },
  ])('Scenario: $name . should return the same config', ({patch}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      data: {
        models: {
          test: patch as unknown as ModelConfig,
        },
      },
    };

    expect(validateConfig(config)).toEqual(config);
  });
});

describe('validateInvalidModelValidationConfig', () => {
  it.each([
    {
      name: 'validation.type is not object',
      patch: {
        table: 'test',
        fields: {test: {type: 'string'}},
        validation: 13,
      },
      expected: '/data/models/test/validation must be object',
    },
    {
      name: 'validation property column does not exist',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}},
        validation: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {type: 'integer', minimum: 1},
            age: {type: 'integer', minimum: 1},
          },
        },
      },
      expected:
        '/data/models/test/validation/properties/age: field does not exist in model',
    },
    {
      name: 'validation required is not array',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}, age: {type: 'integer'}},
        validation: {
          type: 'object',
          required: 'wrong type',
          properties: {
            id: {type: 'integer', minimum: 1},
            age: {type: 'integer', minimum: 1},
          },
        },
      },
      expected: '/data/models/test/validation/required: must be an array',
    },
    {
      name: 'validation required is not array',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}},
        validation: {
          type: 'object',
          required: ['wrong type'],
          properties: {
            id: {type: 'integer', minimum: 1},
            age: {type: 'integer', minimum: 1},
          },
        },
      },
      expected:
        '/data/models/test/validation/required/0: field "wrong type" does not exist in model',
    },
    {
      name: 'validation property column data type does not match',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}},
        validation: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {type: 'string'},
          },
        },
      },
      expected:
        '/data/models/test/validation/properties/id: type mismatch (model=integer, schema=string)',
    },
    {
      name: 'date field with mismatched schema type',
      patch: {
        table: 'test',
        fields: {eventDate: {type: 'date'}},
        validation: {
          type: 'object',
          required: ['eventDate'],
          properties: {
            eventDate: {type: 'string'},
          },
        },
      },
      expected:
        '/data/models/test/validation/properties/eventDate: type mismatch (model=date, schema=string)',
    },
  ])('Scenario: $name . should throw: "$expected"', ({patch, expected}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      data: {
        models: {
          test: {
            table: 'test',
            ...(patch as Record<string, unknown>),
          } as ModelConfig,
        },
      },
    };

    expect(() => validateConfig(config)).toThrow(expected);
  });
});

describe('validateValidModelValidationConfig', () => {
  it.each([
    {
      name: 'valid model',
      patch: {
        table: 'test',
        fields: {
          id: {type: 'integer'},
          name: {type: 'string'},
          is_active: {type: 'boolean'},
          updated_at: {type: 'datetime'},
        },
        validation: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {type: 'integer'},
            name: {type: 'string'},
            is_active: {type: 'boolean'},
            updated_at: {type: 'date-time'},
          },
        },
      },
    },
    {
      name: 'valid model',
      patch: {
        table: 'test',
        fields: {
          id: {type: 'integer'},
          name: {type: 'string'},
          is_active: {type: 'boolean'},
          updated_at: {type: 'datetime'},
        },
        validation: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {type: 'integer'},
            name: {type: 'string'},
            is_active: {type: 'boolean'},
            updated_at: {type: 'datetime'},
          },
        },
      },
    },
    {
      name: 'not passing validation',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}},
      },
    },
    {
      name: 'valid model with decimal and date fields',
      patch: {
        table: 'test',
        fields: {
          id: {type: 'integer'},
          price: {type: 'decimal'},
          eventDate: {type: 'date'},
        },
        validation: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {type: 'integer'},
            price: {type: 'number'},
            eventDate: {type: 'date'},
          },
        },
      },
    },
    {
      name: 'valid model without validation required',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}},
        validation: {
          type: 'object',
          properties: {
            id: {type: 'integer'},
          },
        },
      },
    },
    {
      name: 'valid model with validation but no properties',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}},
        validation: {
          type: 'object',
        },
      },
    },
    {
      name: 'valid model with boolean schema property',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}},
        validation: {
          type: 'object',
          properties: {
            id: true,
          },
        },
      },
    },
    {
      name: 'valid model with schema property without type',
      patch: {
        table: 'test',
        fields: {id: {type: 'integer'}},
        validation: {
          type: 'object',
          properties: {
            id: {minimum: 1},
          },
        },
      },
    },
  ])('Scenario: $name . should return the same config', ({patch}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      data: {
        models: {
          test: patch as unknown as ModelConfig,
        },
      },
    };

    expect(validateConfig(config)).toEqual(config);
  });
});

describe('validateInvalidModelForeignKeyConfig', () => {
  it.each([
    {
      name: 'foreignKey.type is missing',
      patch: {
        relations: {
          fk_rel: {
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
          },
        },
      },
      expected:
        "/data/models/fk_test/relations/fk_rel must have required property 'type'",
    },
    {
      name: 'foreignKey.localField is not string',
      patch: {
        relations: {
          fk_rel: {
            type: 'belongsTo',
            model: 'users',
            localField: 123 as unknown as string,
            foreignField: 'id',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_rel/localField must be string',
    },
    {
      name: 'foreignKey.localField does not exist',
      patch: {
        relations: {
          fk_id_id: {
            type: 'belongsTo',
            model: 'users',
            localField: 'does_not_exist',
            foreignField: 'id',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_id_id/localField: field "does_not_exist" does not exist in model "fk_test"',
    },
    {
      name: 'foreignKey.fields is not array',
      patch: {
        relations: {
          fk_id_id: {
            type: 'belongsTo',
            model: 'users',
            localField: 'id',
            foreignField: ['id'] as unknown as string,
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_id_id/foreignField must be string',
    },
    {
      name: 'foreignKey.referenceTable is not string',
      patch: {
        relations: {
          fk_id_id: {
            type: 'belongsTo',
            model: 123,
            localField: 'id',
            foreignField: 'id',
          },
        },
      },
      expected: '/data/models/fk_test/relations/fk_id_id/model must be string',
    },
    {
      name: 'foreignKey.referenceTable is empty string',
      patch: {
        relations: {
          fk_id_id: {
            type: 'belongsTo',
            model: '',
            localField: 'id',
            foreignField: 'id',
          },
        },
      },
      expected:
        'Entity name "" is not valid, must start with a letter or underscore and contain only letters, numbers, hyphens and underscores',
    },
    {
      name: 'foreignKey.referenceTable references non-existent model',
      patch: {
        relations: {
          fk_id_id: {
            type: 'belongsTo',
            model: 'does_not_exist',
            localField: 'id',
            foreignField: 'id',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_id_id/model: model "does_not_exist" does not exist',
    },
    {
      name: 'foreignKey.foreignField is not string',
      patch: {
        relations: {
          fk_id_id: {
            type: 'belongsTo',
            model: 'users',
            localField: 'id',
            foreignField: 123 as unknown as string,
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_id_id/foreignField must be string',
    },
    {
      name: 'foreignKey.fields is empty array',
      patch: {
        relations: {
          fk_id_id: {
            type: 'belongsTo',
            model: 'users',
            localField: '',
            foreignField: 'id',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_id_id/localField must NOT have fewer than 1 characters',
    },
    {
      name: 'foreignKey.localField array passed as string',
      patch: {
        relations: {
          fk_test_a: {
            type: 'belongsTo',
            model: 'users',
            localField: [] as unknown as string,
            foreignField: 'id',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_test_a/localField must be string',
    },
    {
      name: 'foreignKey.localField invalid entity name starting with digit',
      patch: {
        relations: {
          fk_test_b: {
            type: 'belongsTo',
            model: 'users',
            localField: '1321asdas',
            foreignField: 'id',
          },
        },
      },
      expected:
        'Entity name "1321asdas" is not valid, must start with a letter or underscore and contain only letters, numbers, hyphens and underscores',
    },
    {
      name: 'foreignKey.localField invalid entity name with spaces',
      patch: {
        relations: {
          fk_test_c: {
            type: 'belongsTo',
            model: 'users',
            localField: 'cat dog',
            foreignField: 'id',
          },
        },
      },
      expected:
        'Entity name "cat dog" is not valid, must start with a letter or underscore and contain only letters, numbers, hyphens and underscores',
    },
    {
      name: 'foreignKey.foreignField does not exist in referenced model',
      patch: {
        relations: {
          fk_test_d: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'nonexistent',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_test_d/foreignField: field "nonexistent" does not exist in model "users"',
    },
    {
      name: 'foreignKey.foreignField is not string',
      patch: {
        relations: {
          fk_test_e: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 123 as unknown as string,
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_test_e/foreignField must be string',
    },
    {
      name: 'foreignKey.foreignField is empty string',
      patch: {
        relations: {
          fk_test_f: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: '',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_test_f/foreignField must NOT have fewer than 1 characters',
    },
    {
      name: 'foreignKey.model does not exist',
      patch: {
        relations: {
          fk_test_g: {
            type: 'belongsTo',
            model: 'nonexistent_model',
            localField: 'user_id',
            foreignField: 'id',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_test_g/model: model "nonexistent_model" does not exist',
    },
    {
      name: 'foreignKey.type is invalid enum value',
      patch: {
        relations: {
          fk_test_h: {
            type: 'hasMany',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_test_h/type must be equal to one of the allowed values',
    },
    {
      name: 'foreignKey.onDelete is not one of allowed values',
      patch: {
        relations: {
          fk_test_i: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
            onDelete: 'INVALID',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_test_i/onDelete must be equal to one of the allowed values',
    },
    {
      name: 'foreignKey.onUpdate is not one of allowed values',
      patch: {
        relations: {
          fk_test_j: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
            onUpdate: 'INVALID',
          },
        },
      },
      expected:
        '/data/models/fk_test/relations/fk_test_j/onUpdate must be equal to one of the allowed values',
    },
  ])('Scenario: $name . should throw: "$expected"', ({patch, expected}) => {
    const fkTable = Object.values(validBaseConfig.data.models)[1];
    const config: AppConfig = {
      ...validBaseConfig,
      data: {
        models: {
          ...validBaseConfig.data.models,
          fk_test: {
            ...fkTable,
            ...(patch as Record<string, unknown>),
          } as ModelConfig,
        },
      },
    };

    expect(() => validateConfig(config)).toThrow(expected);
  });
});

describe('validateValidModelForeignKeyConfig', () => {
  it.each([
    {
      name: 'valid model',
      patch: {
        relations: {
          fk_id_id: {
            type: 'belongsTo',
            model: 'users',
            localField: 'user_id',
            foreignField: 'id',
          },
        },
      },
    },
    {
      name: 'valid model',
      patch: {},
    },
  ])('Scenario: $name . should return the same config', ({patch}) => {
    const fkTable = Object.values(validBaseConfig.data.models)[1];
    const config: AppConfig = {
      ...validBaseConfig,
      data: {
        models: {
          ...validBaseConfig.data.models,
          fk_test: {
            ...fkTable,
            ...(patch as Record<string, unknown>),
          } as ModelConfig,
        },
      },
    };

    expect(validateConfig(config)).toEqual(config);
  });
});

describe('validateInvalidApplicationConfig', () => {
  it.each([
    {
      name: 'logLevel as invalid string',
      patch: {logLevel: 'verbose'},
      expected:
        '/application/logLevel must be equal to one of the allowed values',
    },
    {
      name: 'logLevel as number',
      patch: {logLevel: 1},
      expected:
        '/application/logLevel must be equal to one of the allowed values',
    },
    {
      name: 'logLevel as boolean',
      patch: {logLevel: true},
      expected:
        '/application/logLevel must be equal to one of the allowed values',
    },
  ])('Scenario: $name . should throw: "$expected"', ({patch, expected}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      application: {
        ...validBaseConfig.application,
        ...patch,
      } as AppConfig['application'],
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });

  it('should throw when application is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configWithoutApp = {...validBaseConfig} as any;
    delete configWithoutApp.application;
    expect(() =>
      validateConfig(configWithoutApp as unknown as AppConfig),
    ).toThrow("must have required property 'application'");
  });
});

describe('validateValidApplicationConfig', () => {
  it.each([
    {name: 'logLevel trace', patch: {name: 'Test App', logLevel: 'trace'}},
    {name: 'logLevel debug', patch: {name: 'Test App', logLevel: 'debug'}},
    {name: 'logLevel info', patch: {name: 'Test App', logLevel: 'info'}},
    {name: 'logLevel warn', patch: {name: 'Test App', logLevel: 'warn'}},
    {name: 'logLevel error', patch: {name: 'Test App', logLevel: 'error'}},
    {name: 'logLevel fatal', patch: {name: 'Test App', logLevel: 'fatal'}},
    {name: 'logLevel silent', patch: {name: 'Test App', logLevel: 'silent'}},
  ])('Scenario: $name . should return', ({patch}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      application: patch as AppConfig['application'],
    };

    expect(validateConfig(config as unknown as AppConfig)).toMatchObject({
      application: patch,
    });
  });
});

describe('validateInvalidCustomEndpointsConfig', () => {
  it.each([
    {
      name: 'method as invalid',
      patch: {
        customEndpoints: {
          test: {
            method: 'OPTIONS' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'SELECT 1;'},
          },
        },
      },
      expected:
        '/customEndpoints/test/method must be equal to one of the allowed values',
    },
    {
      name: 'path without slash',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: 'test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'SELECT 1;'},
          },
        },
      },
      expected:
        '/customEndpoints/test/path must match pattern "^\\/[a-zA-Z0-9_-]+$"',
    },
    {
      name: 'path with space',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test api',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'SELECT 1;'},
          },
        },
      },
      expected:
        '/customEndpoints/test/path must match pattern "^\\/[a-zA-Z0-9_-]+$"',
    },
    {
      name: 'empty description',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: '',
            validation: {},
            handler: {type: 'sql', sql: 'SELECT 1;'},
          },
        },
      },
      expected:
        '/customEndpoints/test/description must NOT have fewer than 1 characters',
    },
    {
      name: 'empty handler.sql',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: ''},
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql must NOT have fewer than 1 characters',
    },
    {
      name: 'DDL query',
      patch: {
        customEndpoints: {
          test: {
            method: 'POST' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'CREATE TABLE x (id INTEGER);'},
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: DDL queries are not allowed',
    },
    {
      name: 'GET method with DML query',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'INSERT INTO x (id) VALUES (1);'},
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: only DQL queries are allowed for GET method',
    },
    {
      name: 'POST method with invalid SQL starting word',
      patch: {
        customEndpoints: {
          test: {
            method: 'POST' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'RANDOM COMMAND;'},
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: only DQL and DML queries are allowed',
    },
    {
      name: 'GET method with body magic variables (@@)',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = @@id:integer@@;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: body magic variables (@@) are not allowed for GET method',
    },
    {
      name: 'Invalid body variable name',
      patch: {
        customEndpoints: {
          test: {
            method: 'POST' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'UPDATE users SET name = @@first name:string@@;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: invalid magic variable name "first name" for body (@@) parameter',
    },
    {
      name: 'Invalid path variable name',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = $$id!:integer$$;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: invalid magic variable name "id!" for path ($$) parameter',
    },
    {
      name: 'Invalid query variable name',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE country = &&country space:string&&;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: invalid magic variable name "country space" for query (&&) parameter',
    },
    {
      name: 'Mixed delimiters ($$id&&)',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = $$id:integer&&;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: mixed magic variable delimiters "$$" and "&&"',
    },
    {
      name: 'Unclosed delimiter (@@id@)',
      patch: {
        customEndpoints: {
          test: {
            method: 'POST' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'UPDATE users SET name = @@id@;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: unclosed magic variable delimiter "@@"',
    },
    {
      name: 'Multiple datatype declarations',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = $$id:integer:string$$;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: invalid magic variable format "id:integer:string", multiple types provided',
    },
    {
      name: 'Invalid datatype in variable',
      patch: {
        customEndpoints: {
          test: {
            method: 'POST' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'UPDATE users SET name = @@name:varchar@@;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: invalid magic variable type "varchar" for body (@@) parameter',
    },
    {
      name: 'Missing datatype in variable',
      patch: {
        customEndpoints: {
          test: {
            method: 'POST' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'UPDATE users SET name = @@name@@;',
            },
          },
        },
      },
      expected:
        '/customEndpoints/test/handler/sql: missing data type for magic variable "name" in body (@@) parameter',
    },
    {
      name: 'invalid webhook url',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = &&id:integer&&;',
            },
          },
        },
        apis: {
          'customEndpoints.test': {
            webhooks: [
              {
                url: 'invalid',
                data: ['query'],
                triggerOnRequest: true,
              },
            ],
          },
        },
      },
      expected:
        '/apis/customEndpoints.test/webhooks/0/url must match pattern "^https?:\\/\\/"',
    },
    {
      name: 'data field type is not array',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = &&id:integer&&;',
            },
          },
        },
        apis: {
          'customEndpoints.test': {
            webhooks: [
              {
                url: 'https://example.com',
                data: 'query' as unknown as string[],
                triggerOnRequest: true,
              },
            ],
          },
        },
      },
      expected: '/apis/customEndpoints.test/webhooks/0/data must be array',
    },
    {
      name: 'data field is empty array',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = &&id:integer&&;',
            },
          },
        },
        apis: {
          'customEndpoints.test': {
            webhooks: [
              {
                url: 'https://example.com',
                data: [],
                triggerOnRequest: true,
              },
            ],
          },
        },
      },
      expected:
        '/apis/customEndpoints.test/webhooks/0/data must NOT have fewer than 1 items',
    },
    {
      name: 'data field contains invalid value',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = &&id:integer&&;',
            },
          },
        },
        apis: {
          'customEndpoints.test': {
            webhooks: [
              {
                url: 'https://example.com',
                data: ['query', 'invalid'],
                triggerOnRequest: true,
              },
            ],
          },
        },
      },
      expected:
        '/apis/customEndpoints.test/webhooks/0/data/1 must be equal to one of the allowed values',
    },
    {
      name: 'triggerOnRequest is not a boolean',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = &&id:integer&&;',
            },
          },
        },
        apis: {
          'customEndpoints.test': {
            webhooks: [
              {
                url: 'https://example.com',
                data: ['query'],
                triggerOnRequest: 'asdasd',
              },
            ],
          },
        },
      },
      expected:
        '/apis/customEndpoints.test/webhooks/0/triggerOnRequest must be boolean',
    },
    {
      name: 'triggerOnResponse is not a boolean',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = &&id:integer&&;',
            },
          },
        },
        apis: {
          'customEndpoints.test': {
            webhooks: [
              {
                url: 'https://example.com',
                data: ['query'],
                triggerOnResponse: 'trfghdue',
                triggerOnRequest: true,
              },
            ],
          },
        },
      },
      expected:
        '/apis/customEndpoints.test/webhooks/0/triggerOnResponse must be boolean',
    },
    {
      name: 'triggerOnResponse or triggerOnRequest needs to be true, both cannot be false',
      patch: {
        customEndpoints: {
          test: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = &&id:integer&&;',
            },
          },
        },
        apis: {
          'customEndpoints.test': {
            webhooks: [
              {
                url: 'https://example.com',
                data: ['query'],
                triggerOnRequest: false,
                triggerOnResponse: false,
              },
            ],
          },
        },
      },
      expected:
        'apis/customEndpoints.test/webhooks/0: webhook must have at least one of triggerOnRequest or triggerOnResponse',
    },
  ])('Scenario: $name . should throw: "$expected"', ({patch, expected}) => {
    const patchObj = patch as Record<string, unknown>;
    const config = {
      ...validBaseConfig,
      customEndpoints: patchObj.customEndpoints as Record<
        string,
        CustomEndpointConfig
      >,
      apis: patchObj.apis as ApisConfig,
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidCustomEndpointsConfig', () => {
  it.each([
    {
      name: 'valid GET query',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'SELECT * FROM users;'},
          },
        },
      },
    },
    {
      name: 'valid POST insert query',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'POST' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'INSERT INTO users (name) VALUES (1);'},
          },
        },
      },
    },
    {
      name: 'valid WITH query',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'WITH cte AS (SELECT 1) SELECT * FROM cte;',
            },
          },
        },
      },
    },
    {
      name: 'valid variables in POST query',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'POST' as const,
            path: '/test',
            description: 'test',
            validation: {
              type: 'object',
              required: ['id'],
            },
            handler: {
              type: 'sql',
              sql: 'INSERT INTO users (id, name, is_active) VALUES ($$id:integer$$, @@name:string@@, @@active:boolean@@);',
            },
          },
        },
      },
    },
    {
      name: 'valid variables in GET query',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {
              type: 'object',
              required: ['id'],
            },
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = $$id:integer$$ AND name = &&name:string&&;',
            },
          },
        },
      },
    },
    {
      name: 'valid magic variable with hyphen and underscore',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {
              type: 'sql',
              sql: 'SELECT * FROM users WHERE id = &&user-id:integer&& AND name = &&user_name:string&&;',
            },
          },
        },
      },
    },
    {
      name: 'valid webhook with triggerOnRequest',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'SELECT * FROM users;'},
          },
        },
        apis: {
          'customEndpoints.sample_query': {
            webhooks: [
              {
                url: 'https://example.com',
                data: ['query'],
                triggerOnRequest: true,
              },
            ],
          },
        },
      },
    },
    {
      name: 'valid webhook with triggerOnResponse',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'SELECT * FROM users;'},
          },
        },
        apis: {
          'customEndpoints.sample_query': {
            webhooks: [
              {
                url: 'https://example.com',
                data: ['query'],
                triggerOnResponse: true,
              },
            ],
          },
        },
      },
    },
    {
      name: 'a valid webhook with both triggerOnRequest and triggerOnResponse',
      patch: {
        customEndpoints: {
          sample_query: {
            method: 'GET' as const,
            path: '/test',
            description: 'test',
            validation: {},
            handler: {type: 'sql', sql: 'SELECT * FROM users;'},
          },
        },
        apis: {
          'customEndpoints.sample_query': {
            webhooks: [
              {
                url: 'https://example.com',
                data: ['query'],
                triggerOnRequest: true,
                triggerOnResponse: true,
              },
            ],
          },
        },
      },
    },
  ])('Scenario: $name . should return', ({patch}) => {
    const patchObj = patch as Record<string, unknown>;
    const config = {
      ...validBaseConfig,
      customEndpoints: patchObj.customEndpoints as Record<
        string,
        CustomEndpointConfig
      >,
      apis: patchObj.apis as ApisConfig,
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// ----- Rate Limit Config Tests -----

describe('validateRateLimitConfig', () => {
  it.each([
    {
      name: 'enabled as string instead of boolean',
      patch: {
        rateLimit: {
          enabled: 'asdasdas',
          max: 100,
          timeWindow: '15m',
        },
      },
      expected: '/application/rateLimit/enabled must be boolean',
    },
    {
      name: 'max as negative integer',
      patch: {
        rateLimit: {enabled: true, max: -5, timeWindow: '15m'},
      },
      expected: '/application/rateLimit/max must be >= 1',
    },
    {
      name: 'max as zero',
      patch: {
        rateLimit: {enabled: true, max: 0, timeWindow: '15m'},
      },
      expected: '/application/rateLimit/max must be >= 1',
    },
    {
      name: 'max as string',
      patch: {
        rateLimit: {
          enabled: true,
          max: 'sadfg',
          timeWindow: '15m',
        },
      },
      expected: '/application/rateLimit/max must be integer',
    },
    {
      name: 'timeWindow with invalid format (no unit)',
      patch: {
        rateLimit: {enabled: true, max: 100, timeWindow: '15'},
      },
      expected: '/application/rateLimit/timeWindow must match pattern',
    },
    {
      name: 'timeWindow with invalid format (wrong unit)',
      patch: {
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '15x',
        },
      },
      expected: '/application/rateLimit/timeWindow must match pattern',
    },
    {
      name: 'timeWindow with invalid format (no number)',
      patch: {
        rateLimit: {enabled: true, max: 100, timeWindow: 'm'},
      },
      expected: '/application/rateLimit/timeWindow must match pattern',
    },
    {
      name: 'missing enabled property',
      patch: {
        rateLimit: {
          max: 100,
          timeWindow: '15m',
        } as unknown as typeof validBaseConfig.application,
      },
      expected: "/application/rateLimit must have required property 'enabled'",
    },
    {
      name: 'missing max property',
      patch: {
        rateLimit: {
          enabled: true,
          timeWindow: '15m',
        } as unknown as typeof validBaseConfig.application,
      },
      expected: "/application/rateLimit must have required property 'max'",
    },
    {
      name: 'missing timeWindow property',
      patch: {
        rateLimit: {
          enabled: true,
          max: 100,
        } as unknown as typeof validBaseConfig.application,
      },
      expected:
        "/application/rateLimit must have required property 'timeWindow'",
    },
  ])('Scenario: $name . should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      application: {
        ...validBaseConfig.application,
        ...patch,
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });

  it.each([
    {
      name: 'valid rate limit with seconds',
      patch: {
        rateLimit: {enabled: true, max: 50, timeWindow: '30s'},
      },
    },
    {
      name: 'valid rate limit with minutes',
      patch: {
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '15m',
        },
      },
    },
    {
      name: 'valid rate limit with hours',
      patch: {
        rateLimit: {enabled: true, max: 1000, timeWindow: '1h'},
      },
    },
    {
      name: 'valid rate limit with days',
      patch: {
        rateLimit: {
          enabled: true,
          max: 10000,
          timeWindow: '7d',
        },
      },
    },
    {
      name: 'rate limit disabled',
      patch: {
        rateLimit: {
          enabled: false,
          max: 100,
          timeWindow: '15m',
        },
      },
    },
  ])('Scenario: $name . should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      application: {
        ...validBaseConfig.application,
        ...patch,
      },
      infrastructure: {
        ...validBaseConfig.infrastructure,
        cache: {
          engine: 'redis',
          connection: {
            url: 'redis://localhost:6379',
          },
          timeout: 5000,
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// ----- Cache DB Config Tests -----

describe('validateCacheDbConfig', () => {
  it.each([
    {
      name: 'engine as invalid value',
      patch: {engine: 'memcached', connection: {url: 'redis://localhost:6379'}},
      expected:
        '/infrastructure/cache/engine must be equal to one of the allowed values',
    },
    {
      name: 'connection url with invalid format (http)',
      patch: {engine: 'redis', connection: {url: 'http://localhost:6379'}},
      expected:
        '/infrastructure/cache/connection/url must match pattern "^redis:\\/\\/"',
    },
    {
      name: 'connection url without protocol',
      patch: {engine: 'redis', connection: {url: 'localhost:6379'}},
      expected:
        '/infrastructure/cache/connection/url must match pattern "^redis:\\/\\/"',
    },
    {
      name: 'connection url empty string',
      patch: {engine: 'redis', connection: {url: ''}},
      expected:
        '/infrastructure/cache/connection/url must match pattern "^redis:\\/\\/"',
    },
    {
      name: 'timeout as negative integer',
      patch: {
        engine: 'redis',
        connection: {url: 'redis://localhost:6379'},
        timeout: -100,
      },
      expected: '/infrastructure/cache/timeout must be >= 1',
    },
    {
      name: 'timeout as zero',
      patch: {
        engine: 'redis',
        connection: {url: 'redis://localhost:6379'},
        timeout: 0,
      },
      expected: '/infrastructure/cache/timeout must be >= 1',
    },
    {
      name: 'missing required engine',
      patch: {
        connection: {url: 'redis://localhost:6379'},
      } as unknown as typeof validBaseConfig,
      expected: "/infrastructure/cache must have required property 'engine'",
    },
    {
      name: 'missing required connection',
      patch: {engine: 'redis'} as unknown as typeof validBaseConfig,
      expected:
        "/infrastructure/cache must have required property 'connection'",
    },
  ])('Scenario: $name . should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      infrastructure: {
        ...validBaseConfig.infrastructure,
        cache: patch as unknown as typeof validBaseConfig.infrastructure.cache,
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });

  it.each([
    {
      name: 'valid cache with redis localhost',
      patch: {engine: 'redis', connection: {url: 'redis://localhost:6379'}},
    },
    {
      name: 'valid cache with redis and timeout',
      patch: {
        engine: 'redis',
        connection: {url: 'redis://localhost:6379'},
        timeout: 5000,
      },
    },
    {
      name: 'valid cache with redis remote host',
      patch: {
        engine: 'redis',
        connection: {url: 'redis://redis.example.com:6379'},
      },
    },
    {
      name: 'valid cache with redis and password',
      patch: {
        engine: 'redis',
        connection: {url: 'redis://:mypassword@localhost:6379'},
      },
    },
  ])('Scenario: $name . should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      infrastructure: {
        ...validBaseConfig.infrastructure,
        cache: patch as unknown as typeof validBaseConfig.infrastructure.cache,
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// ----- Optional Cache Config Tests -----

describe('validateCacheOptional', () => {
  it('cache is completely optional and config should validate', () => {
    const config = {
      ...validBaseConfig,
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });

  it('config without cache and without rateLimit should validate', () => {
    const config = {
      ...validBaseConfig,
      application: {
        name: 'Test App',
        logLevel: 'info',
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// ----- Optional ModelAPIs Config Tests -----
describe('validateInvalidModelAPIsConfig', () => {
  it.each([
    {
      name: 'invalid webhook for modelAPis',
      patch: {
        'aggregateAPIs.users.id.getAggregation': 'invalid',
      },
      expected: '/apis/aggregateAPIs.users.id.getAggregation must be object',
    },
    {
      name: 'invalid webhook conf',
      patch: {
        'aggregateAPIs.users.id.getAggregation': {
          webhooks: 'invalid',
        },
      },
      expected:
        '/apis/aggregateAPIs.users.id.getAggregation/webhooks must be array',
    },
    {
      name: 'invalid api key format',
      patch: {
        invalid_key: {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: true,
              triggerOnResponse: true,
            },
          ],
        },
      },
      expected: 'apis/invalid_key: invalid key format',
    },
    {
      name: 'invalid data response cannot be used when triggerOnRequest is true',
      patch: {
        'aggregateAPIs.users.id.getAggregation': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: true,
              triggerOnResponse: true,
            },
          ],
        },
      },
      expected:
        'apis/aggregateAPIs.users.id.getAggregation/webhooks/0: data response cannot be used when triggerOnRequest is true',
    },
  ])('Scenario: $name . should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      apis: patch,
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidModelAPIsConfig', () => {
  it.each([
    {
      name: 'valid modelAPIs',
      patch: {
        'aggregateAPIs.users.id.getAggregation': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs.users.id.delete': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs.users.id.edit': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs.users.all.getAll': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs.users.id.index': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs.users.all.insert': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs.users.id.search': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'response'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
      },
    },
  ])('Scenario: $name . should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      apis: patch,
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

describe('validateInvalidAuthConfig', () => {
  it.each([
    {
      name: 'invalid value for enabled',
      patch: {
        authentication: {
          enabled: 'true',
          provider: {
            type: 'api-key',
            config: {key: 'xxx'},
          },
        },
      },
      expected: '/authentication/enabled must be boolean',
    },
    {
      name: 'invalid provider type',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'invalid',
            config: {key: 'xxx'},
          },
        },
      },
      expected:
        '/authentication/provider/type must be equal to one of the allowed values',
    },
    {
      name: 'missing provider config',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'api-key',
          },
        },
      },
      expected: "/authentication/provider must have required property 'config'",
    },
    {
      name: 'providing userModel when provider type is api-key',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'api-key',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              key: 'xxx',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel: userModel should not be present when provider type is api-key',
    },
    {
      name: 'not providing key when provider type is api-key',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'api-key',
            config: {},
          },
        },
      },
      expected:
        '/authentication/provider/config/key: key is required when provider type is api-key',
    },
    {
      name: 'not providing userModel when provider type is up-auth',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {},
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel: userModel is required when provider type is up-auth',
    },
    {
      name: 'invalid userModel.model',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'does-not-exist',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/model: model does not exist',
    },
    {
      name: 'invalid userModel.idField',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'invalid',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/idField: field does not exist in model',
    },
    {
      name: 'invalid userModel.usernameField',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'invalid',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/usernameField: field does not exist in model',
    },
    {
      name: 'invalid userModel.passwordField',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'invalid',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/passwordField: field does not exist in model',
    },
    {
      name: 'idField exists in a different model, not the specified model',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'user_id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/idField: field does not exist in model',
    },
    {
      name: 'usernameField exists in a different model, not the specified model',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'posts',
                idField: 'user_id',
                usernameField: 'name',
                passwordField: 'body',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/usernameField: field does not exist in model',
    },
    {
      name: 'providing key when provider type is up-auth',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'invalid',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
              key: 'xxx',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/key: key should not be present when provider type is up-auth',
    },
    {
      name: 'not providing jwtSecret when provider type is up-auth',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'invalid',
                passwordField: 'name',
              },
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/jwtSecret: jwtSecret is required when provider type is up-auth',
    },
    {
      name: 'providing jwtSecret when provider type is api-key',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'api-key',
            config: {
              key: 'xxx',
              jwtSecret: 'this-key-should-not-be-here-in-api-key-config',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/jwtSecret: jwtSecret should not be present when provider type is api-key',
    },
    {
      name: 'jwtSecret too short',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'too-short',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/jwtSecret must NOT have fewer than 32 characters',
    },
    {
      name: 'invalid tokenExpiration pattern',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
              tokenExpiration: '2x',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/tokenExpiration must match pattern',
    },
    {
      name: 'non-string idField',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 123,
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/idField must be string',
    },
    {
      name: 'non-string usernameField',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: false,
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/usernameField must be string',
    },
    {
      name: 'non-string passwordField',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 789,
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/passwordField must be string',
    },
    {
      name: 'mfaRequired not boolean',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
              mfaRequired: 'yes',
            },
          },
        },
      },
      expected: '/authentication/provider/config/mfaRequired must be boolean',
    },
    {
      name: 'mfaRequired true but no cache configured',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
              mfaRequired: true,
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/mfaRequired: cache must be configured when mfaRequired is true',
    },
    {
      name: 'mfaRequired true but no communicate configured',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
              mfaRequired: true,
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/mfaRequired: integrations.email must be configured when mfaRequired is true',
    },
    {
      name: 'non-string isVerifiedField',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
                isVerifiedField: 123,
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/isVerifiedField must be string',
    },
    {
      name: 'isVerifiedField field does not exist in model',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
                isVerifiedField: 'nonexistent',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/isVerifiedField: field does not exist in model',
    },
    {
      name: 'isVerifiedField field is not boolean type',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'posts',
                idField: 'user_id',
                usernameField: 'title',
                passwordField: 'body',
                isVerifiedField: 'title',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/isVerifiedField: field must be of type boolean',
    },
    {
      name: 'isVerifiedField set but no integrations.email configured',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
                isVerifiedField: 'is_active',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      expected:
        '/authentication/provider/config/userModel/isVerifiedField: integrations.email must be configured when isVerifiedField is set',
    },
  ])('Scenario: $name . should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      authentication: patch.authentication as unknown as NonNullable<
        typeof validBaseConfig.authentication
      >,
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidAuthConfig', () => {
  it.each([
    {
      name: 'valid api-key auth config',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'api-key',
            config: {key: 'xxx'},
          },
        },
      },
    },
    {
      name: 'valid up-auth auth config',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
    },
    {
      name: 'valid up-auth auth config with tokenExpiration',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
              tokenExpiration: '2h',
            },
          },
        },
      },
    },
    {
      name: 'valid up-auth auth config with mfaRequired false',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
              mfaRequired: false,
            },
          },
        },
      },
    },
    {
      name: 'valid up-auth auth config with mfaRequired true',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
              mfaRequired: true,
            },
          },
        },
      },
      extra: {
        cache: {
          engine: 'redis' as const,
          connection: {url: 'redis://localhost:6379'},
        },
        integrations: {email: {provider: 'dummy' as const}},
      },
    },
    {
      name: 'valid up-auth auth config with isVerifiedField',
      patch: {
        authentication: {
          enabled: true,
          provider: {
            type: 'up-auth',
            config: {
              userModel: {
                model: 'users',
                idField: 'id',
                usernameField: 'name',
                passwordField: 'name',
                isVerifiedField: 'is_active',
              },
              jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
            },
          },
        },
      },
      extra: {
        integrations: {email: {provider: 'dummy' as const}},
      },
    },
  ])('Scenario: $name . should return', ({patch, extra}) => {
    const base = {...validBaseConfig};
    if (extra) {
      base.infrastructure = {...base.infrastructure, cache: extra.cache};
      base.integrations = extra.integrations;
    }
    const config = {
      ...base,
      authentication: patch.authentication as unknown as NonNullable<
        typeof validBaseConfig.authentication
      >,
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

describe('validateAuthConstraints directly (bypass AJV)', () => {
  it('should catch missing providerConfig', () => {
    const config = {
      ...validBaseConfig,
      authentication: {
        enabled: true,
        provider: {
          type: 'up-auth',
          config: undefined as unknown as NonNullable<
            NonNullable<typeof validBaseConfig.authentication>['provider']
          >['config'],
        },
      },
    };
    const errors = validateAuthConstraints(
      config as unknown as import('@/interfaces/config').AppConfig,
    );
    expect(errors).toContain(
      '/authentication/provider/config: provider config is required',
    );
  });

  it('should catch non-string idField', () => {
    const config = {
      ...validBaseConfig,
      data: {
        models: {
          users: {
            table: 'users',
            fields: {
              id: {type: 'integer', primaryKey: true},
              name: {type: 'string'},
            },
          },
        },
      },
      authentication: {
        enabled: true,
        provider: {
          type: 'up-auth',
          config: {
            userModel: {
              model: 'users',
              idField: 123,
              usernameField: 'name',
              passwordField: 'name',
            },
            jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
          } as unknown as NonNullable<
            NonNullable<typeof validBaseConfig.authentication>['provider']
          >['config'],
        },
      },
    };
    const errors = validateAuthConstraints(
      config as unknown as import('@/interfaces/config').AppConfig,
    );
    expect(errors).toContain(
      '/authentication/provider/config/userModel/idField: must be a string',
    );
  });

  it('should catch non-string usernameField', () => {
    const config = {
      ...validBaseConfig,
      data: {
        models: {
          users: {
            table: 'users',
            fields: {
              id: {type: 'integer', primaryKey: true},
              name: {type: 'string'},
            },
          },
        },
      },
      authentication: {
        enabled: true,
        provider: {
          type: 'up-auth',
          config: {
            userModel: {
              model: 'users',
              idField: 'id',
              usernameField: 456,
              passwordField: 'name',
            },
            jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
          } as unknown as NonNullable<
            NonNullable<typeof validBaseConfig.authentication>['provider']
          >['config'],
        },
      },
    };
    const errors = validateAuthConstraints(
      config as unknown as import('@/interfaces/config').AppConfig,
    );
    expect(errors).toContain(
      '/authentication/provider/config/userModel/usernameField: must be a string',
    );
  });

  it('should catch non-string passwordField', () => {
    const config = {
      ...validBaseConfig,
      data: {
        models: {
          users: {
            table: 'users',
            fields: {
              id: {type: 'integer', primaryKey: true},
              name: {type: 'string'},
            },
          },
        },
      },
      authentication: {
        enabled: true,
        provider: {
          type: 'up-auth',
          config: {
            userModel: {
              model: 'users',
              idField: 'id',
              usernameField: 'name',
              passwordField: 789,
            },
            jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
          } as unknown as NonNullable<
            NonNullable<typeof validBaseConfig.authentication>['provider']
          >['config'],
        },
      },
    };
    const errors = validateAuthConstraints(
      config as unknown as import('@/interfaces/config').AppConfig,
    );
    expect(errors).toContain(
      '/authentication/provider/config/userModel/passwordField: must be a string',
    );
  });

  it('should catch non-string isVerifiedField', () => {
    const config = {
      ...validBaseConfig,
      data: {
        models: {
          users: {
            table: 'users',
            fields: {
              id: {type: 'integer', primaryKey: true},
              name: {type: 'string'},
            },
          },
        },
      },
      authentication: {
        enabled: true,
        provider: {
          type: 'up-auth',
          config: {
            userModel: {
              model: 'users',
              idField: 'id',
              usernameField: 'name',
              passwordField: 'name',
              isVerifiedField: 123,
            },
            jwtSecret: 'this-is-a-long-enough-secret-key-for-testing',
          } as unknown as NonNullable<
            NonNullable<typeof validBaseConfig.authentication>['provider']
          >['config'],
        },
      },
    };
    const errors = validateAuthConstraints(
      config as unknown as import('@/interfaces/config').AppConfig,
    );
    expect(errors).toContain(
      '/authentication/provider/config/userModel/isVerifiedField: must be a string',
    );
  });
});

// check invalid ssp configs
describe('validateInvalidSspConfig', () => {
  it.each([
    {
      name: 'invalid ssp config param type',
      patch: {serverParams: [{type: 'invalid', name: 'id', value: '1'}]},
      expected:
        '/apis/customAPIs.customQueries.all.sample_query/serverParams/0/type must be equal to one of the allowed values',
    },
    {
      name: 'invalid ssp config param type',
      patch: {serverParams: [{type: 132, name: 'id', value: '1'}]},
      expected:
        '/apis/customAPIs.customQueries.all.sample_query/serverParams/0/type must be equal to one of the allowed values',
    },
    {
      name: 'invalid ssp config param name',
      patch: {serverParams: [{type: 'body', name: 123, value: '1'}]},
      expected:
        '/apis/customAPIs.customQueries.all.sample_query/serverParams/0/name must be string',
    },
    {
      name: 'invalid ssp config param value',
      patch: {serverParams: [{type: 'body', name: 'id', value: null}]},
      expected:
        '/apis/customAPIs.customQueries.all.sample_query/serverParams/0/value must be string',
    },
  ])('Scenario: $name . should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      apis: {
        'customAPIs.customQueries.all.sample_query': {
          serverParams: patch.serverParams,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

// check valid ssp configs
describe('validateValidSspConfig', () => {
  it.each([
    {
      name: 'valid ssp config',
      patch: {serverParams: [{type: 'body', name: 'id', value: '1'}]},
    },
    {
      name: 'valid ssp config',
      patch: {serverParams: [{type: 'body', name: 'id', value: 1}]},
    },
    {
      name: 'valid ssp config',
      patch: {serverParams: [{type: 'body', name: 'id', value: true}]},
    },
    {
      name: 'valid ssp config',
      patch: {serverParams: [{type: 'query', name: 'id', value: '1'}]},
    },
    {
      name: 'valid ssp config',
      patch: {serverParams: [{type: 'path', name: 'id', value: '1'}]},
    },
  ])('Scenario: $name . should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      apis: {
        'modelAPIs.posts.all.getAll': {
          serverParams: patch.serverParams,
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// validate the authorization property
describe('validateInvalidAuthorizationConfig', () => {
  it.each([
    {
      name: 'invalid authorization config',
      patch: {authorization: 'wrong'},
      expected: 'modelAPIs.posts.all.getAll/authorization must be boolean',
    },
    {
      name: 'invalid authorization config',
      patch: {authorization: null},
      expected: 'modelAPIs.posts.all.getAll/authorization must be boolean',
    },
  ])('Scenario: $name . should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      apis: {
        'modelAPIs.posts.all.getAll': {
          authorization: patch.authorization,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateInvalidAuthorizationConfig', () => {
  it.each([
    {
      name: 'authorization is enabled when authentication is disabled',
      patch: {authorization: true},
      expected:
        'apis/modelAPIs.posts.all.getAll/authorization: authorization is only allowed when auth is enabled',
    },
  ])('Scenario: $name . should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      authentication: {
        enabled: false,
        provider: {
          type: 'api-key',
          config: {key: '1234'},
        },
      },
      apis: {
        'modelAPIs.posts.all.getAll': {
          authorization: patch.authorization,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidAuthorizationConfig', () => {
  it.each([
    {
      name: 'valid authorization config',
      patch: {authorization: true},
    },
    {
      name: 'valid authorization config',
      patch: {authorization: false},
    },
  ])('Scenario: $name . should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      authentication: {
        enabled: true,
        provider: {
          type: 'api-key',
          config: {key: '1234'},
        },
      },
      apis: {
        'modelAPIs.posts.all.getAll': {
          authorization: patch.authorization,
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// check integrations configs validation
describe('validateIntegrationsConfig', () => {
  it('should pass when integrations config is valid', () => {
    const config = {
      ...validBaseConfig,
      integrations: {
        email: {
          provider: 'dummy',
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });

  it('should throw when email config is missing required provider', () => {
    const config = {
      ...validBaseConfig,
      integrations: {
        email: {},
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      "must have required property 'provider'",
    );
  });

  it('should throw when email config has invalid provider enum value', () => {
    const config = {
      ...validBaseConfig,
      integrations: {
        email: {
          provider: 'invalid-provider',
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      'must be equal to one of the allowed values',
    );
  });

  it('should throw when email config has extra properties', () => {
    const config = {
      ...validBaseConfig,
      integrations: {
        email: {
          provider: 'dummy',
          extraProperty: true,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      'must NOT have additional properties',
    );
  });

  it('should throw when integrations config itself has extra properties', () => {
    const config = {
      ...validBaseConfig,
      integrations: {
        email: {
          provider: 'dummy',
        },
        extraProperty: true,
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      'must NOT have additional properties',
    );
  });
});

describe('validateCustomEndpointsConfig', () => {
  it('should pass when validation property is omitted', () => {
    const config = {
      ...validBaseConfig,
      customEndpoints: {
        testEndpoint: {
          method: 'GET',
          path: '/test-path',
          description: 'Test endpoint description',
          handler: {
            type: 'sql',
            sql: 'SELECT * FROM users;',
          },
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });

  it('should pass when validation includes path parameters in required', () => {
    const config = {
      ...validBaseConfig,
      customEndpoints: {
        testEndpoint: {
          method: 'GET',
          path: '/test-path',
          description: 'Test endpoint description',
          validation: {
            type: 'object',
            required: ['id'],
            properties: {
              id: {type: 'integer'},
            },
          },
          handler: {
            type: 'sql',
            sql: 'SELECT * FROM users WHERE id = $$id:integer$$;',
          },
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });

  it('should throw when endpoint validation is not a valid JSON schema', () => {
    const config = {
      ...validBaseConfig,
      customEndpoints: {
        testEndpoint: {
          method: 'GET',
          path: '/test-path',
          description: 'Test endpoint description',
          validation: {
            type: 'invalid-type',
          },
          handler: {
            type: 'sql',
            sql: 'SELECT * FROM users;',
          },
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      '/customEndpoints/testEndpoint/validation:',
    );
  });
});
