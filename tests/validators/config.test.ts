import {describe, expect, it} from 'vitest';

import {AppConfig, DatabaseConfig, ModelConfig} from '@/schema/config';

import {validateConfig} from '@/validators/config';

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
        {
          name: 'is_active',
          type: 'boolean',
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
      ],
    },
    {
      name: 'Post',
      fields: [
        {
          name: 'title',
          type: 'string',
          nullable: false,
          supportedOperations: ['searchable', 'sortable'],
          supportedAggregation: ['count'],
        },
        {
          name: 'body',
          type: 'text',
          nullable: true,
        },
        {
          name: 'user_id',
          type: 'integer',
          nullable: false,
          supportedOperations: ['equal', 'oneOf'],
          supportedAggregation: ['count'],
        },
        {
          name: 'created_at',
          type: 'datetime',
          supportedOperations: ['lessThan', 'greaterThan', 'sortable'],
        },
      ],
    },
  ];
};

const validBaseConfig: AppConfig = {
  application: {
    logLevel: 'info',
  },
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
      patch: {enabled: 'wrong'},
      expected: '/swagger/enabled must be boolean',
    },
    {
      name: 'enabled as undefined',
      patch: {enabled: undefined},
      expected: "/swagger must have required property 'enabled'",
    },
    {
      name: 'invalid base path',
      patch: {basePath: 'wrong'},
      expected:
        '/swagger/basePath must match pattern "^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$"',
    },
    {
      name: 'invalid base path',
      patch: {basePath: 'api/docs'},
      expected:
        '/swagger/basePath must match pattern "^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$"',
    },
    {
      name: 'swagger title undefined',
      patch: {info: {title: undefined}},
      expected: "/swagger/info must have required property 'title'",
    },
    {
      name: 'swagger title too small',
      patch: {info: {title: '1234'}},
      expected: '/swagger/info/title must NOT have fewer than 5 characters',
    },
    {
      name: 'swagger description too small',
      patch: {
        info: {title: validBaseConfig.swagger.info.title, description: '1234'},
      },
      expected:
        '/swagger/info/description must NOT have fewer than 25 characters',
    },
    {
      name: 'swagger termsOfService not valid url',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          termsOfService: '1234',
        },
      },
      expected: '/swagger/info/termsOfService must match format "uri"',
    },
    {
      name: 'swagger termsOfService not valid url',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          termsOfService: '/api/base',
        },
      },
      expected: '/swagger/info/termsOfService must match format "uri"',
    },
    {
      name: 'swagger contact name too small',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: {name: '1234'},
        },
      },
      expected:
        '/swagger/info/contact/name must NOT have fewer than 5 characters',
    },
    {
      name: 'swagger contact url is not valid url',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: {name: '1234', url: '/api/base'},
        },
      },
      expected: '/swagger/info/contact/url must match format "uri"',
    },
    {
      name: 'swagger contact email is not valid email',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: {name: '1234', email: '1234'},
        },
      },
      expected: '/swagger/info/contact/email must match format "email"',
    },
    {
      name: 'swagger contact license name too small',
      patch: {
        info: {title: validBaseConfig.swagger.info.title, license: {name: ''}},
      },
      expected:
        '/swagger/info/license/name must NOT have fewer than 1 characters',
    },
    {
      name: 'swagger contact license uri is not valid url',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          license: {name: 'MIT', url: '/api/base'},
        },
      },
      expected: '/swagger/info/license/url must match format "uri"',
    },
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      swagger: {
        ...validBaseConfig.swagger,
        ...patch,
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidSwaggerConfig', () => {
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
      name: 'valid base path',
      patch: {basePath: '/api/docs'},
    },
    {
      name: 'swagger title',
      patch: {info: {title: 'Valid docs title'}},
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
          contact: {name: 'Abhishek Chatterjee'},
        },
      },
    },
    {
      name: 'swagger contact url',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: {name: 'Abhishek Chatterjee', url: 'https://imdeepmind.com'},
        },
      },
    },
    {
      name: 'swagger contact email',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          contact: {
            name: 'Abhishek Chatterjee',
            email: 'abhishek@imdeepmind.com',
          },
        },
      },
    },
    {
      name: 'swagger contact license name',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          license: {name: 'MIT'},
        },
      },
    },
    {
      name: 'swagger contact license uri',
      patch: {
        info: {
          title: validBaseConfig.swagger.info.title,
          license: {name: 'MIT', url: 'https://opensource.org/licenses/MIT'},
        },
      },
    },
  ])('Scenario: $name -> should return', ({patch}) => {
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

describe('validateInvalidDatabaseConfig', () => {
  it.each([
    {
      name: 'engine as invalid',
      patch: {engine: 'wrong', connection: {urlOrPath: './database.db'}},
      expected: '/database/engine must be equal to constant',
    },
    {
      name: 'engine as undefined',
      patch: {engine: undefined, connection: {urlOrPath: './database.db'}},
      expected: "/database must have required property 'engine'",
    },
    {
      name: 'connection.urlOrPath as empty string',
      patch: {engine: 'pg', connection: {urlOrPath: ''}},
      expected:
        '/database/connection/urlOrPath must match pattern "^postgres(ql)?:\\/\\/"',
    },
    {
      name: 'connection.urlOrPath wrong pg connection string',
      patch: {engine: 'pg', connection: {urlOrPath: './database.db'}},
      expected:
        '/database/connection/urlOrPath must match pattern "^postgres(ql)?:\\/\\/"',
    },
    {
      name: 'connection.urlOrPath wrong sqlite connection string',
      patch: {
        engine: 'sqlite',
        connection: {
          urlOrPath: '.postgres://devuser:devpassword@db:5432/rocketdb',
        },
      },
      expected:
        '/database/connection/urlOrPath must match pattern "^(.\\/|\\/)?([\\w\\-. ]+\\/)*[\\w\\-. ]+\\.(db|sqlite)$"',
    },
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      database: {
        ...validBaseConfig.database,
        ...patch,
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
      name: 'engine as pg',
      patch: {
        engine: 'pg',
        connection: {
          urlOrPath: 'postgres://devuser:devpassword@db:5432/rocketdb',
        },
      },
    },
    {
      name: 'engine as sqlite',
      patch: {engine: 'sqlite', connection: {urlOrPath: './database.db'}},
    },
  ])('Scenario: $name -> should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      database: {
        ...validBaseConfig.database,
        ...patch,
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
      patch: {name: '132234asd'},
      expected: '/models/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'invalid name',
      patch: {name: 'sad asdas'},
      expected: '/models/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'name as undefined',
      patch: {name: undefined},
      expected: "/models/0 must have required property 'name'",
    },
    // ============== end of invalid name tests ===============
    // ============== invalid fields tests ==============
    {
      name: 'empty field',
      patch: {name: 'test', fields: []},
      expected: '/models/0/fields must NOT have fewer than 1 items',
    },
    {
      name: 'invalid field.name',
      patch: {name: 'test', fields: [{name: '132234asd'}]},
      expected:
        '/models/0/fields/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'invalid field.name',
      patch: {name: 'test', fields: [{name: 'sad asdas'}]},
      expected:
        '/models/0/fields/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'invalid field.name',
      patch: {name: 'test', fields: [{name: undefined}]},
      expected: "/models/0/fields/0 must have required property 'name'",
    },
    {
      name: 'invalid field.type',
      patch: {name: 'test', fields: [{name: 'test', type: undefined}]},
      expected: "/models/0/fields/0 must have required property 'type'",
    },
    {
      name: 'invalid field.type',
      patch: {name: 'test', fields: [{name: 'test', type: 'invalid'}]},
      expected:
        '/models/0/fields/0/type must be equal to one of the allowed values',
    },
    {
      name: 'invalid field.primaryKey',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'integer', primaryKey: 'invalid'}],
      },
      expected: '/models/0/fields/0/primaryKey must be boolean',
    },
    {
      name: 'invalid field.primaryKey',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'boolean', primaryKey: true}],
      },
      expected:
        '/models/0/fields/0: primaryKey field must be of type integer or string (found boolean)',
    },
    {
      name: 'invalid field.primaryKey',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'text', primaryKey: true}],
      },
      expected:
        '/models/0/fields/0: primaryKey field must be of type integer or string (found text)',
    },
    {
      name: 'invalid field.primaryKey',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'datetime', primaryKey: true}],
      },
      expected:
        '/models/0/fields/0: primaryKey field must be of type integer or string (found datetime)',
    },
    {
      name: 'invalid field.unique',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'string', unique: 'invalid'}],
      },
      expected: '/models/0/fields/0/unique must be boolean',
    },
    {
      name: 'field.unique=False and primaryKey=True',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', primaryKey: true, unique: false},
        ],
      },
      expected: '/models/0/fields/0: primaryKey field must have unique=true',
    },
    {
      name: 'invalid field.nullable',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'string', nullable: 'invalid'}],
      },
      expected: '/models/0/fields/0/nullable must be boolean',
    },
    {
      name: 'field.nullable=False and primaryKey=True',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'test',
            type: 'string',
            primaryKey: true,
            unique: true,
            nullable: true,
          },
        ],
      },
      expected: '/models/0/fields/0: primaryKey field must have nullable=false',
    },
    {
      name: 'field.supportedOperations is not array',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', supportedOperations: 'invalid'},
        ],
      },
      expected: '/models/0/fields/0/supportedOperations must be array',
    },
    {
      name: 'field.supportedOperations contains invalid value',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', supportedOperations: ['invalid']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "invalid" is not allowed for type "string"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=integer',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'integer', supportedOperations: ['searchable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "searchable" is not allowed for type "integer"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', supportedOperations: ['lessThan']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "lessThan" is not allowed for type "string"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'test',
            type: 'string',
            supportedOperations: ['lessThanEqual'],
          },
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "lessThanEqual" is not allowed for type "string"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', supportedOperations: ['greaterThan']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "greaterThan" is not allowed for type "string"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'test',
            type: 'string',
            supportedOperations: ['greaterThanEqual'],
          },
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "greaterThanEqual" is not allowed for type "string"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedOperations: ['searchable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "searchable" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedOperations: ['sortable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "sortable" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedOperations: ['editable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "editable" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedOperations: ['deletable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "deletable" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedOperations: ['lessThan']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "lessThan" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'test',
            type: 'boolean',
            supportedOperations: ['lessThanEqual'],
          },
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "lessThanEqual" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedOperations: ['greaterThan']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "greaterThan" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'test',
            type: 'boolean',
            supportedOperations: ['greaterThanEqual'],
          },
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "greaterThanEqual" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedOperations: ['oneOf']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "oneOf" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedOperations: ['indexable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "indexable" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['searchable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "searchable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['sortable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "sortable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['editable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "editable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['deletable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "deletable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['lessThan']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "lessThan" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['lessThanEqual']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "lessThanEqual" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['greaterThan']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "greaterThan" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'test',
            type: 'text',
            supportedOperations: ['greaterThanEqual'],
          },
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "greaterThanEqual" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'text', supportedOperations: ['equal']}],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "equal" is not allowed for type "text"',
    },

    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'text', supportedOperations: ['oneOf']}],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "oneOf" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['indexable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "indexable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['searchable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "searchable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['editable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "editable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['deletable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "deletable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedOperations: ['indexable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "indexable" is not allowed for type "text"',
    },
    {
      name: 'field.supportedAggregation is not array',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', supportedAggregation: 'invalid'},
        ],
      },
      expected: '/models/0/fields/0/supportedAggregation must be array',
    },
    {
      name: 'field.supportedAggregation contains invalid value',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', supportedAggregation: ['invalid']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "invalid" is not allowed for type "string"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=integer',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'integer', supportedAggregation: ['frequency']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "frequency" is not allowed for type "integer"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', supportedAggregation: ['mean']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "mean" is not allowed for type "string"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'string', supportedAggregation: ['max']}],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "max" is not allowed for type "string"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'string', supportedAggregation: ['min']}],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "min" is not allowed for type "string"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'string', supportedAggregation: ['sum']}],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "sum" is not allowed for type "string"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=string',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'string', supportedAggregation: ['frequency']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "frequency" is not allowed for type "string"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedAggregation: ['mean']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "mean" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedAggregation: ['max']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "max" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedAggregation: ['min']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "min" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=boolean',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'boolean', supportedAggregation: ['sum']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "sum" is not allowed for type "boolean"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'text', supportedAggregation: ['mean']}],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "mean" is not allowed for type "text"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'text', supportedAggregation: ['max']}],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "max" is not allowed for type "text"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'text', supportedAggregation: ['min']}],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "min" is not allowed for type "text"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'text', supportedAggregation: ['sum']}],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "sum" is not allowed for type "text"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [{name: 'test', type: 'text', supportedAggregation: ['count']}],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "count" is not allowed for type "text"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=text',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'text', supportedAggregation: ['frequency']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "frequency" is not allowed for type "text"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=datetime',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'datetime', supportedAggregation: ['sum']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "sum" is not allowed for type "datetime"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=datetime',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'datetime', supportedAggregation: ['frequency']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "frequency" is not allowed for type "datetime"',
    },
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      models: [
        {
          ...validBaseConfig.models[0],
          ...patch,
        },
      ],
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidModelFieldsConfig', () => {
  it.each([
    {
      name: 'valid model',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'id',
            type: 'integer',
            primaryKey: true,
            unique: true,
            nullable: false,
          },
        ],
      },
    },
    {
      name: 'valid model',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'id',
            type: 'integer',
            primaryKey: true,
            unique: true,
            nullable: false,
            supportedOperations: ['indexable', 'sortable'],
          },
        ],
      },
    },
    {
      name: 'valid model',
      patch: {
        name: 'test',
        fields: [
          {
            name: 'id',
            type: 'integer',
            primaryKey: true,
            unique: true,
            nullable: false,
            supportedOperations: ['indexable', 'sortable'],
            supportedAggregation: ['mean', 'max', 'min', 'count', 'sum'],
          },
        ],
      },
    },
  ])('Scenario: $name -> should return the same config', ({patch}) => {
    const config = {
      ...validBaseConfig,
      models: [
        {
          ...validBaseConfig.models[0],
          ...patch,
        },
      ],
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

describe('validateInvalidModelIndexesConfig', () => {
  it.each([
    {
      name: 'index.name is not string',
      patch: {
        indexes: [{name: 123, columns: ['id']}],
      },
      expected:
        '/models/0/indexes/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'index.name starts with number',
      patch: {
        indexes: [{name: '12121asdas', columns: ['id']}],
      },
      expected:
        '/models/0/indexes/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'index.name contains space',
      patch: {
        indexes: [{name: 'cat dog', columns: ['id']}],
      },
      expected:
        '/models/0/indexes/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'index.name is duplicate',
      patch: {
        indexes: [
          {name: 'valid_index', columns: ['id']},
          {name: 'valid_index', columns: ['id']},
        ],
      },
      expected: '/models/0/indexes/1: duplicate index name "valid_index"',
    },
    {
      name: 'index.column is pointing to wrong field',
      patch: {
        indexes: [{name: 'valid_index', columns: ['age']}],
      },
      expected:
        '/models/0/indexes/0/columns: column "age" does not exist in fields',
    },
    {
      name: 'index.column is empty',
      patch: {
        indexes: [{name: 'valid_index', columns: ['']}],
      },
      expected:
        '/models/0/indexes/0/columns/0 must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'index.column is not array',
      patch: {
        indexes: [{name: 'valid_index', columns: 'test'}],
      },
      expected: '/models/0/indexes/0/columns must be array',
    },
    {
      name: 'index.unique is not boolean',
      patch: {
        indexes: [{name: 'valid_index', columns: ['id'], unique: 'test'}],
      },
      expected: '/models/0/indexes/0/unique must be boolean',
    },
    {
      name: 'index.unique is not boolean',
      patch: {
        indexes: [{name: 'valid_index', columns: ['id'], unique: 123}],
      },
      expected: '/models/0/indexes/0/unique must be boolean',
    },
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      models: [
        {
          ...validBaseConfig.models[0],
          ...patch,
        },
      ],
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidModelIndexesConfig', () => {
  it.each([
    {
      name: 'valid model',
      patch: {
        name: 'test',
        indexes: [
          {
            name: 'valid_index',
            columns: ['id'],
            unique: true,
          },
        ],
      },
    },
    {
      name: 'valid model',
      patch: {
        name: 'test',
        indexes: [
          {
            name: 'valid_index',
            columns: ['id', 'name'],
            unique: false,
          },
        ],
      },
    },
    {
      name: 'not passing index',
      patch: {
        name: 'test',
      },
    },
  ])('Scenario: $name -> should return the same config', ({patch}) => {
    const config = {
      ...validBaseConfig,
      models: [
        {
          ...validBaseConfig.models[0],
          ...patch,
        },
      ],
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

describe('validateInvalidModelValidationConfig', () => {
  it.each([
    {
      name: 'validation.type is not object',
      patch: {
        name: 'test',
        validation: 13,
      },
      expected: '/models/0/validation must be object',
    },
    {
      name: 'validation property column does not exist',
      patch: {
        name: 'test',
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
        '/models/0/validation/properties/age: field does not exist in model',
    },
    {
      name: 'validation required is not array',
      patch: {
        name: 'test',
        validation: {
          type: 'object',
          required: 'wrong type',
          properties: {
            id: {type: 'integer', minimum: 1},
            age: {type: 'integer', minimum: 1},
          },
        },
      },
      expected: '/models/0/validation/required: must be an array',
    },
    {
      name: 'validation required is not array',
      patch: {
        name: 'test',
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
        '/models/0/validation/required/0: field "wrong type" does not exist in model',
    },
    {
      name: 'validation property column data type does not match',
      patch: {
        name: 'test',
        validation: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {type: 'string'},
          },
        },
      },
      expected:
        '/models/0/validation/properties/id: type mismatch (model=integer, schema=string)',
    },
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      models: [
        {
          ...validBaseConfig.models[0],
          ...patch,
        },
      ],
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidModelValidationConfig', () => {
  it.each([
    {
      name: 'valid model',
      patch: {
        name: 'test',
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
        name: 'test',
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
        name: 'test',
      },
    },
  ])('Scenario: $name -> should return the same config', ({patch}) => {
    const config = {
      ...validBaseConfig,
      models: [
        {
          ...validBaseConfig.models[0],
          ...patch,
        },
      ],
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

describe('validateInvalidModelForeignKeyConfig', () => {
  it.each([
    {
      name: 'foreignKey.name is not string',
      patch: {
        foreignKeys: [
          {
            name: 123,
            columns: ['id'],
            referenceTable: 'test',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'foreignKey.name is empty string',
      patch: {
        foreignKeys: [
          {
            name: '',
            columns: ['id'],
            referenceTable: 'test',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/name must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'foreignKey.name is empty string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['does_not_exist'],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/columns: column "does_not_exist" does not exist in model "Post"',
    },
    {
      name: 'foreignKey.name is duplicate',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['user_id'],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
          {
            name: 'fk_id_id',
            columns: ['user_id'],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/1: duplicate foreign key name "fk_id_id"',
    },
    {
      name: 'foreignKey.columns is not array',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: 'id',
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected: '/models/2/foreignKeys/0/columns must be array',
    },
    {
      name: 'foreignKey.columns is empty array',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: [],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/columns must NOT have fewer than 1 items',
    },
    {
      name: 'foreignKey.columns contains non-string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: [123],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/columns/0 must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'foreignKey.columns contains non-string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['1321asdas'],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/columns/0 must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'foreignKey.columns contains non-string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['cat dog'],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/columns/0 must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'foreignKey.columns contains duplicate items',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id', 'id'],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/columns must NOT have duplicate items (items ## 1 and 0 are identical)',
    },
    {
      name: 'foreignKey.referenceTable is not string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 123,
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/referenceTable must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'foreignKey.referenceTable is empty string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: '',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/referenceTable must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'foreignKey.referenceTable is empty string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'does_not_exist',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0: referenceTable "does_not_exist" does not exist',
    },
    {
      name: 'foreignKey.referenceColumns is not array',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'User',
            referenceColumns: 'id',
          },
        ],
      },
      expected: '/models/2/foreignKeys/0/referenceColumns must be array',
    },
    {
      name: 'foreignKey.referenceColumns is empty array',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'User',
            referenceColumns: [],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/referenceColumns must NOT have fewer than 1 items',
    },
    {
      name: 'foreignKey.referenceColumns contains non-string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'User',
            referenceColumns: [123],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/referenceColumns/0 must match pattern "^[a-zA-Z_][a-zA-Z0-9_]*$"',
    },
    {
      name: 'foreignKey.referenceColumns contains non-existent column',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'User',
            referenceColumns: ['does_not_exist'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/referenceColumns: column "does_not_exist" does not exist in table "User"',
    },
    {
      name: 'foreignKey.referenceColumns contains duplicate items',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'User',
            referenceColumns: ['id', 'id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/referenceColumns must NOT have duplicate items (items ## 1 and 0 are identical)',
    },
    {
      name: 'foreignKey.onUpdate is not one of allowed values',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['user_id'],
            referenceTable: 'User',
            referenceColumns: ['id', 'title'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0: columns and referenceColumns must have same length',
    },
    {
      name: 'foreignKey.onUpdate is not one of allowed values',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['user_id', 'name'],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0: columns and referenceColumns must have same length',
    },
    {
      name: 'foreignKey.onDelete is not one of allowed values',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'User',
            referenceColumns: ['id'],
            onDelete: 'INVALID',
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/onDelete must be equal to one of the allowed values',
    },
    {
      name: 'foreignKey.onUpdate is not one of allowed values',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'User',
            referenceColumns: ['id'],
            onUpdate: 'INVALID',
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/onUpdate must be equal to one of the allowed values',
    },
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
    const fkTable = validBaseConfig.models[1];
    const config = {
      ...validBaseConfig,
      models: [
        ...validBaseConfig.models,
        {
          ...fkTable,
          ...patch,
        },
      ],
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidModelForeignKeyConfig', () => {
  it.each([
    {
      name: 'valid model',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['user_id'],
            referenceTable: 'User',
            referenceColumns: ['id'],
          },
        ],
      },
    },
    {
      name: 'valid model',
      patch: {
        foreignKeys: [],
      },
    },
  ])('Scenario: $name -> should return the same config', ({patch}) => {
    const fkTable = validBaseConfig.models[1];
    const config = {
      ...validBaseConfig,
      models: [
        ...validBaseConfig.models,
        {
          ...fkTable,
          ...patch,
        },
      ],
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
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
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
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
    {name: 'logLevel trace', patch: {logLevel: 'trace'}},
    {name: 'logLevel debug', patch: {logLevel: 'debug'}},
    {name: 'logLevel info', patch: {logLevel: 'info'}},
    {name: 'logLevel warn', patch: {logLevel: 'warn'}},
    {name: 'logLevel error', patch: {logLevel: 'error'}},
    {name: 'logLevel fatal', patch: {logLevel: 'fatal'}},
    {name: 'logLevel silent', patch: {logLevel: 'silent'}},
  ])('Scenario: $name -> should return', ({patch}) => {
    const config: AppConfig = {
      ...validBaseConfig,
      application: patch as AppConfig['application'],
    };

    expect(validateConfig(config as unknown as AppConfig)).toMatchObject({
      application: patch,
    });
  });
});

describe('validateInvalidApisConfig', () => {
  it.each([
    {
      name: 'method as invalid',
      patch: {
        customQueries: [{method: 'OPTIONS', path: '/test', query: 'SELECT 1;'}],
      },
      expected:
        '/apis/customQueries/0/method must be equal to one of the allowed values',
    },
    {
      name: 'path without slash',
      patch: {
        customQueries: [{method: 'GET', path: 'test', query: 'SELECT 1;'}],
      },
      expected:
        '/apis/customQueries/0/path must match pattern "^\\/[a-z_\\-\\/]+$"',
    },
    {
      name: 'path with space and uppercase',
      patch: {
        customQueries: [
          {method: 'GET', path: '/test-api asdas', query: 'SELECT 1;'},
        ],
      },
      expected:
        '/apis/customQueries/0/path must match pattern "^\\/[a-z_\\-\\/]+$"',
    },
    {
      name: 'empty query',
      patch: {customQueries: [{method: 'GET', path: '/test', query: ''}]},
      expected:
        '/apis/customQueries/0/query must NOT have fewer than 1 characters',
    },
    {
      name: 'DDL query',
      patch: {
        customQueries: [
          {
            method: 'POST',
            path: '/test',
            query: 'CREATE TABLE x (id INTEGER);',
          },
        ],
      },
      expected: '/apis/customQueries/0/query: DDL queries are not allowed',
    },
    {
      name: 'GET method with DML query',
      patch: {
        customQueries: [
          {
            method: 'GET',
            path: '/test',
            query: 'INSERT INTO x (id) VALUES (1);',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: only DQL queries are allowed for GET method',
    },
    {
      name: 'POST method with invalid SQL starting word',
      patch: {
        customQueries: [
          {method: 'POST', path: '/test', query: 'RANDOM COMMAND;'},
        ],
      },
      expected:
        '/apis/customQueries/0/query: only DQL and DML queries are allowed',
    },
    {
      name: 'GET method with body magic variables (@@)',
      patch: {
        customQueries: [
          {
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = @@id:integer@@;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: body magic variables (@@) are not allowed for GET method',
    },
    {
      name: 'Invalid body variable name',
      patch: {
        customQueries: [
          {
            method: 'POST',
            path: '/test',
            query: 'UPDATE users SET name = @@first name:string@@;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: invalid magic variable name "first name" for body (@@) parameter',
    },
    {
      name: 'Invalid path variable name',
      patch: {
        customQueries: [
          {
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = $$id!:integer$$;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: invalid magic variable name "id!" for path ($$) parameter',
    },
    {
      name: 'Invalid query variable name',
      patch: {
        customQueries: [
          {
            method: 'GET',
            path: '/test',
            query:
              'SELECT * FROM users WHERE country = &&country space:string&&;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: invalid magic variable name "country space" for query (&&) parameter',
    },
    {
      name: 'Mixed delimiters ($$id&&)',
      patch: {
        customQueries: [
          {
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = $$id:integer&&;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: mixed magic variable delimiters "$$" and "&&"',
    },
    {
      name: 'Unclosed delimiter (@@id@)',
      patch: {
        customQueries: [
          {
            method: 'POST',
            path: '/test',
            query: 'UPDATE users SET name = @@id@;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: unclosed magic variable delimiter "@@"',
    },
    {
      name: 'Multiple datatype declarations',
      patch: {
        customQueries: [
          {
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = $$id:integer:string$$;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: invalid magic variable format "id:integer:string", multiple types provided',
    },
    {
      name: 'Invalid datatype in variable',
      patch: {
        customQueries: [
          {
            method: 'POST',
            path: '/test',
            query: 'UPDATE users SET name = @@name:varchar@@;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: invalid magic variable type "varchar" for body (@@) parameter',
    },
    {
      name: 'Missing datatype in variable',
      patch: {
        customQueries: [
          {
            method: 'POST',
            path: '/test',
            query: 'UPDATE users SET name = @@name@@;',
          },
        ],
      },
      expected:
        '/apis/customQueries/0/query: missing data type for magic variable "name" in body (@@) parameter',
    },
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      apis: patch,
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidApisConfig', () => {
  it.each([
    {
      name: 'valid GET query',
      patch: {
        customQueries: [
          {method: 'GET', path: '/test', query: 'SELECT * FROM User;'},
        ],
      },
    },
    {
      name: 'valid POST insert query',
      patch: {
        customQueries: [
          {
            method: 'POST',
            path: '/test',
            query: 'INSERT INTO User (name) VALUES (1);',
          },
        ],
      },
    },
    {
      name: 'valid WITH query',
      patch: {
        customQueries: [
          {
            method: 'GET',
            path: '/test',
            query: 'WITH cte AS (SELECT 1) SELECT * FROM cte;',
          },
        ],
      },
    },
    {
      name: 'valid variables in POST query',
      patch: {
        customQueries: [
          {
            method: 'POST',
            path: '/update-user',
            query:
              "UPDATE users SET name = '@@name:string@@', age = @@age:integer@@ WHERE id = $$id:integer$$ AND status = '&&status:string&&';",
          },
        ],
      },
    },
    {
      name: 'valid path and query variables in GET',
      patch: {
        customQueries: [
          {
            method: 'GET',
            path: '/search',
            query:
              'SELECT * FROM users WHERE id = $$id:integer$$ AND category = &&cat:string&&;',
          },
        ],
      },
    },
    {
      name: 'valid typed variables in POST query',
      patch: {
        customQueries: [
          {
            method: 'POST',
            path: '/update-user',
            query:
              "UPDATE users SET name = '@@name:string@@', age = @@age:integer@@, updated_at = '@@updated_at:datetime@@' WHERE id = $$id:integer$$ AND status = &&status:boolean&&;",
          },
        ],
      },
    },
  ])('Scenario: $name -> should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      apis: patch,
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});
