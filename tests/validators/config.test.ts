import {describe, expect, it} from 'vitest';

import {
  ApisConfig,
  AppConfig,
  CustomQueryConfig,
  DatabaseConfig,
  ModelConfig,
} from '@/interfaces/config';

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
      name: 'users',
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
      name: 'posts',
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
      expected:
        'Entity name "132234asd" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
    },
    {
      name: 'invalid name',
      patch: {name: 'sad asdas'},
      expected:
        'Entity name "sad asdas" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
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
        'Entity name "132234asd" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
    },
    {
      name: 'invalid field.name',
      patch: {name: 'test', fields: [{name: 'sad asdas'}]},
      expected:
        'Entity name "sad asdas" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
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
      name: 'field.supportedOperations contains invalid value for type=decimal',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'decimal', supportedOperations: ['searchable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "searchable" is not allowed for type "decimal"',
    },
    {
      name: 'field.supportedOperations contains invalid value for type=date',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'date', supportedOperations: ['searchable']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedOperations: "searchable" is not allowed for type "date"',
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
      name: 'field.supportedAggregation contains invalid value for type=decimal',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'decimal', supportedAggregation: ['frequency']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "frequency" is not allowed for type "decimal"',
    },
    {
      name: 'field.supportedAggregation contains invalid value for type=date',
      patch: {
        name: 'test',
        fields: [
          {name: 'test', type: 'date', supportedAggregation: ['frequency']},
        ],
      },
      expected:
        '/models/0/fields/0/supportedAggregation: "frequency" is not allowed for type "date"',
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
      expected: '/models/0/indexes/0/name must be string',
    },
    {
      name: 'index.name starts with number',
      patch: {
        indexes: [{name: '12121asdas', columns: ['id']}],
      },
      expected:
        'Entity name "12121asdas" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
    },
    {
      name: 'index.name contains space',
      patch: {
        indexes: [{name: 'cat dog', columns: ['id']}],
      },
      expected:
        'Entity name "cat dog" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
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
        'Entity name "" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
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
      expected: '/models/2/foreignKeys/0/name must be string',
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
        'Entity name "" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
    },
    {
      name: 'foreignKey.name is empty string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['does_not_exist'],
            referenceTable: 'users',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/columns: column "does_not_exist" does not exist in model "posts"',
    },
    {
      name: 'foreignKey.name is duplicate',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['user_id'],
            referenceTable: 'users',
            referenceColumns: ['id'],
          },
          {
            name: 'fk_id_id',
            columns: ['user_id'],
            referenceTable: 'users',
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
            referenceTable: 'users',
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
            referenceTable: 'users',
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
            referenceTable: 'users',
            referenceColumns: ['id'],
          },
        ],
      },
      expected: '/models/2/foreignKeys/0/columns/0 must be string',
    },
    {
      name: 'foreignKey.columns contains non-string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['1321asdas'],
            referenceTable: 'users',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        'Entity name "1321asdas" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
    },
    {
      name: 'foreignKey.columns contains non-string',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['cat dog'],
            referenceTable: 'users',
            referenceColumns: ['id'],
          },
        ],
      },
      expected:
        'Entity name "cat dog" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
    },
    {
      name: 'foreignKey.columns contains duplicate items',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id', 'id'],
            referenceTable: 'users',
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
      expected: '/models/2/foreignKeys/0/referenceTable must be string',
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
        'Entity name "" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
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
            referenceTable: 'users',
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
            referenceTable: 'users',
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
            referenceTable: 'users',
            referenceColumns: [123],
          },
        ],
      },
      expected: '/models/2/foreignKeys/0/referenceColumns/0 must be string',
    },
    {
      name: 'foreignKey.referenceColumns contains non-existent column',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'users',
            referenceColumns: ['does_not_exist'],
          },
        ],
      },
      expected:
        '/models/2/foreignKeys/0/referenceColumns: column "does_not_exist" does not exist in table "users"',
    },
    {
      name: 'foreignKey.referenceColumns contains duplicate items',
      patch: {
        foreignKeys: [
          {
            name: 'fk_id_id',
            columns: ['id'],
            referenceTable: 'users',
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
            referenceTable: 'users',
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
            referenceTable: 'users',
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
            referenceTable: 'users',
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
            referenceTable: 'users',
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
            referenceTable: 'users',
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
      name: 'name as invalid',
      patch: {
        customQueries: [
          {name: '123_asd', method: 'GET', path: '/test', query: 'SELECT 1;'},
        ],
      },
      expected:
        '/customAPIs/customQueries/0/name Entity name "123_asd" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
    },
    {
      name: 'name as invalid',
      patch: {
        customQueries: [
          {name: 'asd&*asd', method: 'GET', path: '/test', query: 'SELECT 1;'},
        ],
      },
      expected:
        '/customAPIs/customQueries/0/name Entity name "asd&*asd" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores',
    },
    {
      name: 'name as duplicate',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT 1;',
          },
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test-different',
            query: 'SELECT 1;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/1/name: name must be unique and non-empty',
    },
    {
      name: 'method as invalid',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'OPTIONS',
            path: '/test',
            query: 'SELECT 1;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/method must be equal to one of the allowed values',
    },
    {
      name: 'path without slash',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: 'test',
            query: 'SELECT 1;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/path must match pattern "^\\/[a-z_\\-\\/]+$"',
    },
    {
      name: 'path with space and uppercase',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test-api asdas',
            query: 'SELECT 1;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/path must match pattern "^\\/[a-z_\\-\\/]+$"',
    },
    {
      name: 'empty query',
      patch: {
        customQueries: [
          {name: 'sample_query', method: 'GET', path: '/test', query: ''},
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query must NOT have fewer than 1 characters',
    },
    {
      name: 'DDL query',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'POST',
            path: '/test',
            query: 'CREATE TABLE x (id INTEGER);',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: DDL queries are not allowed',
    },
    {
      name: 'GET method with DML query',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'INSERT INTO x (id) VALUES (1);',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: only DQL queries are allowed for GET method',
    },
    {
      name: 'POST method with invalid SQL starting word',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'POST',
            path: '/test',
            query: 'RANDOM COMMAND;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: only DQL and DML queries are allowed',
    },
    {
      name: 'GET method with body magic variables (@@)',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = @@id:integer@@;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: body magic variables (@@) are not allowed for GET method',
    },
    {
      name: 'Invalid body variable name',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'POST',
            path: '/test',
            query: 'UPDATE users SET name = @@first name:string@@;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: invalid magic variable name "first name" for body (@@) parameter',
    },
    {
      name: 'Invalid path variable name',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = $$id!:integer$$;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: invalid magic variable name "id!" for path ($$) parameter',
    },
    {
      name: 'Invalid query variable name',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query:
              'SELECT * FROM users WHERE country = &&country space:string&&;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: invalid magic variable name "country space" for query (&&) parameter',
    },
    {
      name: 'Mixed delimiters ($$id&&)',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = $$id:integer&&;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: mixed magic variable delimiters "$$" and "&&"',
    },
    {
      name: 'Unclosed delimiter (@@id@)',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'POST',
            path: '/test',
            query: 'UPDATE users SET name = @@id@;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: unclosed magic variable delimiter "@@"',
    },
    {
      name: 'Multiple datatype declarations',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = $$id:integer:string$$;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: invalid magic variable format "id:integer:string", multiple types provided',
    },
    {
      name: 'Invalid datatype in variable',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'POST',
            path: '/test',
            query: 'UPDATE users SET name = @@name:varchar@@;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: invalid magic variable type "varchar" for body (@@) parameter',
    },
    {
      name: 'Missing datatype in variable',
      patch: {
        customQueries: [
          {
            name: 'update_users',
            method: 'POST',
            path: '/test',
            query: 'UPDATE users SET name = @@name@@;',
          },
        ],
      },
      expected:
        '/customAPIs/customQueries/0/query: missing data type for magic variable "name" in body (@@) parameter',
    },
    {
      name: 'invalid webhook url',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = &&id:integer&&;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
        '/apis/customAPIs->customQueries->all->sample_query/webhooks/0/url must match pattern "^https?:\\/\\/"',
    },
    {
      name: 'data field type is not array',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = &&id:integer&&;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
            webhooks: [
              {
                url: 'https://example.com',
                data: 'query',
                triggerOnRequest: true,
              },
            ],
          },
        },
      },
      expected:
        '/apis/customAPIs->customQueries->all->sample_query/webhooks/0/data must be array',
    },
    {
      name: 'data field is empty array',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = &&id:integer&&;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
        '/apis/customAPIs->customQueries->all->sample_query/webhooks/0/data must NOT have fewer than 1 items',
    },
    {
      name: 'data field contains invalid value',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = &&id:integer&&;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
        '/apis/customAPIs->customQueries->all->sample_query/webhooks/0/data/1 must be equal to one of the allowed values',
    },
    {
      name: 'triggerOnRequest is not a boolean',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = &&id:integer&&;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
        '/apis/customAPIs->customQueries->all->sample_query/webhooks/0/triggerOnRequest must be boolean',
    },
    {
      name: 'triggerOnResponse is not a boolean',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = &&id:integer&&;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
        '/apis/customAPIs->customQueries->all->sample_query/webhooks/0/triggerOnResponse must be boolean',
    },
    {
      name: 'triggerOnResponse or triggerOnRequest needs to be true, both cannot be false',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users WHERE id = &&id:integer&&;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
        'apis/customAPIs->customQueries->all->sample_query/webhooks/0: webhook must have at least one of triggerOnRequest or triggerOnResponse',
    },
  ])('Scenario: $name -> should throw: "$expected"', ({patch, expected}) => {
    const patchObj = patch as Record<string, unknown>;
    const config = {
      ...validBaseConfig,
      customAPIs: {
        customQueries: patchObj.customQueries as CustomQueryConfig[],
      },
      apis: patchObj.apis as ApisConfig,
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
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users;',
          },
        ],
      },
    },
    {
      name: 'valid POST insert query',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'POST',
            path: '/test',
            query: 'INSERT INTO users (name) VALUES (1);',
          },
        ],
      },
    },
    {
      name: 'valid WITH query',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
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
            name: 'sample_query',
            method: 'POST',
            path: '/test',
            query:
              'INSERT INTO users (id, name, is_active) VALUES ($$id:integer$$, @@name:string@@, @@active:boolean@@);',
          },
        ],
      },
    },
    {
      name: 'valid variables in GET query',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query:
              'SELECT * FROM users WHERE id = $$id:integer$$ AND name = &&name:string&&;',
          },
        ],
      },
    },
    {
      name: 'valid magic variable with hyphen and underscore',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query:
              'SELECT * FROM users WHERE id = &&user-id:integer&& AND name = &&user_name:string&&;',
          },
        ],
      },
    },
    {
      name: 'valid webhook with triggerOnRequest',
      patch: {
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
        customQueries: [
          {
            name: 'sample_query',
            method: 'GET',
            path: '/test',
            query: 'SELECT * FROM users;',
          },
        ],
        apis: {
          'customAPIs->customQueries->all->sample_query': {
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
  ])('Scenario: $name -> should return', ({patch}) => {
    const patchObj = patch as Record<string, unknown>;
    const config = {
      ...validBaseConfig,
      customAPIs: {
        customQueries: patchObj.customQueries as CustomQueryConfig[],
      },
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
          useRedis: false,
        },
      },
      expected: '/application/rateLimit/enabled must be boolean',
    },
    {
      name: 'max as negative integer',
      patch: {
        rateLimit: {enabled: true, max: -5, timeWindow: '15m', useRedis: false},
      },
      expected: '/application/rateLimit/max must be >= 1',
    },
    {
      name: 'max as zero',
      patch: {
        rateLimit: {enabled: true, max: 0, timeWindow: '15m', useRedis: false},
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
          useRedis: false,
        },
      },
      expected: '/application/rateLimit/max must be integer',
    },
    {
      name: 'timeWindow with invalid format (no unit)',
      patch: {
        rateLimit: {enabled: true, max: 100, timeWindow: '15', useRedis: false},
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
          useRedis: false,
        },
      },
      expected: '/application/rateLimit/timeWindow must match pattern',
    },
    {
      name: 'timeWindow with invalid format (no number)',
      patch: {
        rateLimit: {enabled: true, max: 100, timeWindow: 'm', useRedis: false},
      },
      expected: '/application/rateLimit/timeWindow must match pattern',
    },
    {
      name: 'useRedis as string instead of boolean',
      patch: {
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '15m',
          useRedis: 'asdasdassadas',
        },
      },
      expected: '/application/rateLimit/useRedis must be boolean',
    },
    {
      name: 'missing enabled property',
      patch: {
        rateLimit: {
          max: 100,
          timeWindow: '15m',
          useRedis: false,
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
          useRedis: false,
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
          useRedis: false,
        } as unknown as typeof validBaseConfig.application,
      },
      expected:
        "/application/rateLimit must have required property 'timeWindow'",
    },
    {
      name: 'missing useRedis property',
      patch: {
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '15m',
        } as unknown as typeof validBaseConfig.application,
      },
      expected: "/application/rateLimit must have required property 'useRedis'",
    },
  ])('Scenario: $name -> should throw error', ({patch, expected}) => {
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
        rateLimit: {enabled: true, max: 50, timeWindow: '30s', useRedis: false},
      },
    },
    {
      name: 'valid rate limit with minutes',
      patch: {
        rateLimit: {
          enabled: true,
          max: 100,
          timeWindow: '15m',
          useRedis: false,
        },
      },
    },
    {
      name: 'valid rate limit with hours',
      patch: {
        rateLimit: {enabled: true, max: 1000, timeWindow: '1h', useRedis: true},
      },
    },
    {
      name: 'valid rate limit with days',
      patch: {
        rateLimit: {
          enabled: true,
          max: 10000,
          timeWindow: '7d',
          useRedis: true,
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
          useRedis: false,
        },
      },
    },
  ])('Scenario: $name -> should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      application: {
        ...validBaseConfig.application,
        ...patch,
      },
      cache_db: {
        engine: 'redis',
        connection: {
          uri: 'redis://localhost:6379',
        },
        timeout: 5000,
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
      patch: {engine: 'memcached', connection: {uri: 'redis://localhost:6379'}},
      expected: '/cache_db/engine must be equal to one of the allowed values',
    },
    {
      name: 'connection uri with invalid format (http)',
      patch: {engine: 'redis', connection: {uri: 'http://localhost:6379'}},
      expected: '/cache_db/connection/uri must match pattern "^redis:\\/\\/"',
    },
    {
      name: 'connection uri without protocol',
      patch: {engine: 'redis', connection: {uri: 'localhost:6379'}},
      expected: '/cache_db/connection/uri must match pattern "^redis:\\/\\/"',
    },
    {
      name: 'connection uri empty string',
      patch: {engine: 'redis', connection: {uri: ''}},
      expected: '/cache_db/connection/uri must match pattern "^redis:\\/\\/"',
    },
    {
      name: 'timeout as negative integer',
      patch: {
        engine: 'redis',
        connection: {uri: 'redis://localhost:6379'},
        timeout: -100,
      },
      expected: '/cache_db/timeout must be >= 1',
    },
    {
      name: 'timeout as zero',
      patch: {
        engine: 'redis',
        connection: {uri: 'redis://localhost:6379'},
        timeout: 0,
      },
      expected: '/cache_db/timeout must be >= 1',
    },
    {
      name: 'missing required engine',
      patch: {
        connection: {uri: 'redis://localhost:6379'},
      } as unknown as typeof validBaseConfig,
      expected: "/cache_db must have required property 'engine'",
    },
    {
      name: 'missing required connection',
      patch: {engine: 'redis'} as unknown as typeof validBaseConfig,
      expected: "/cache_db must have required property 'connection'",
    },
  ])('Scenario: $name -> should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      cache_db: patch as unknown as typeof validBaseConfig.cache_db,
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });

  it.each([
    {
      name: 'valid cache_db with redis localhost',
      patch: {engine: 'redis', connection: {uri: 'redis://localhost:6379'}},
    },
    {
      name: 'valid cache_db with redis and timeout',
      patch: {
        engine: 'redis',
        connection: {uri: 'redis://localhost:6379'},
        timeout: 5000,
      },
    },
    {
      name: 'valid cache_db with redis remote host',
      patch: {
        engine: 'redis',
        connection: {uri: 'redis://redis.example.com:6379'},
      },
    },
    {
      name: 'valid cache_db with redis and password',
      patch: {
        engine: 'redis',
        connection: {uri: 'redis://:mypassword@localhost:6379'},
      },
    },
  ])('Scenario: $name -> should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      cache_db: patch as unknown as typeof validBaseConfig.cache_db,
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// ----- Optional Cache DB Config Tests -----

describe('validateCacheDbOptional', () => {
  it('cache_db is completely optional and config should validate', () => {
    const config = {
      ...validBaseConfig,
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });

  it('config without cache_db and without rateLimit should validate', () => {
    const config = {
      ...validBaseConfig,
      application: {
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
        'aggregateAPIs->users->id->getAggregation': 'invalid',
      },
      expected: '/apis/aggregateAPIs->users->id->getAggregation must be object',
    },
    {
      name: 'invalid webhook conf',
      patch: {
        'aggregateAPIs->users->id->getAggregation': {
          webhooks: 'invalid',
        },
      },
      expected:
        '/apis/aggregateAPIs->users->id->getAggregation/webhooks must be array',
    },
    {
      name: 'invalid api key format',
      patch: {
        invalid_key: {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: true,
              triggerOnResponse: true,
            },
          ],
        },
      },
      expected: 'apis/invalid_key: invalid key format',
    },
    {
      name: 'invalid data resp cannot be used when triggerOnRequest is true',
      patch: {
        'aggregateAPIs->users->id->getAggregation': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: true,
              triggerOnResponse: true,
            },
          ],
        },
      },
      expected:
        'apis/aggregateAPIs->users->id->getAggregation/webhooks/0: data resp cannot be used when triggerOnRequest is true',
    },
  ])('Scenario: $name -> should throw error', ({patch, expected}) => {
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
        'aggregateAPIs->users->id->getAggregation': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs->users->id->delete': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs->users->id->edit': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs->users->all->getAll': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs->users->id->index': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs->users->all->insert': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
        'modelAPIs->users->id->search': {
          webhooks: [
            {
              url: 'https://google.com',
              data: ['query', 'body', 'params', 'resp'],
              triggerOnRequest: false,
              triggerOnResponse: true,
            },
          ],
        },
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

describe('validateInvalidModelAPIsConfig', () => {
  it.each([
    {
      name: 'invalid value for enableAuth',
      patch: {
        auth: {
          enableAuth: 'true',
          authEngine: 'api-key',
          apiKey: 'xxx',
        },
      },
      expected: '/auth/enableAuth must be boolean',
    },
    {
      name: 'invalid authEngine',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'invalid',
          apiKey: 'xxx',
        },
      },
      expected: '/auth/authEngine must be equal to one of the allowed values',
    },
    {
      name: 'providing authModel when authEngine is api-key',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'api-key',
          authModel: {
            modelName: 'users',
            idColumn: 'id',
            usernameColumn: 'name',
            passwordColumn: 'name',
          },
          apiKey: 'xxx',
        },
      },
      expected:
        '/auth/authModel: authModel should not be present when authEngine is api-key',
    },
    {
      name: 'not providing apiKey when authEngine is api-key',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'api-key',
        },
      },
      expected: '/auth/apiKey: apiKey is required when authEngine is api-key',
    },
    {
      name: 'invalid authModel',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: 'invalid',
        },
      },
      expected: '/auth/authModel must be object',
    },
    {
      name: 'invalid authModel.modelName',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: {
            modelName: 'invalid',
            idColumn: 'id',
            usernameColumn: 'name',
            passwordColumn: 'name',
          },
        },
      },
      expected: '/auth/authModel/modelName: model does not exist',
    },
    {
      name: 'invalid authModel.idColumn',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: {
            modelName: 'users',
            idColumn: 'invalid',
            usernameColumn: 'name',
            passwordColumn: 'name',
          },
        },
      },
      expected: '/auth/authModel/idColumn: field does not exist in model',
    },
    {
      name: 'invalid authModel.usernameColumn',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: {
            modelName: 'users',
            idColumn: 'id',
            usernameColumn: 'invalid',
            passwordColumn: 'name',
          },
        },
      },
      expected: '/auth/authModel/usernameColumn: field does not exist in model',
    },
    {
      name: 'invalid authModel.passwordColumn',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: {
            modelName: 'users',
            idColumn: 'id',
            usernameColumn: 'name',
            passwordColumn: 'invalid',
          },
        },
      },
      expected: '/auth/authModel/passwordColumn: field does not exist in model',
    },
    {
      name: 'providing apiKey when authEngine is up-auth',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: {
            modelName: 'users',
            idColumn: 'id',
            usernameColumn: 'invalid',
            passwordColumn: 'name',
          },
          apiKey: 'xxx',
        },
      },
      expected:
        '/auth/apiKey: apiKey should not be present when authEngine is up-auth',
    },
    {
      name: 'not providing authModel when authEngine is up-auth',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
        },
      },
      expected:
        '/auth/authModel: authModel is required when authEngine is up-auth',
    },
  ])('Scenario: $name -> should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      auth: patch.auth as unknown as typeof validBaseConfig.auth,
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

describe('validateValidModelAPIsConfig', () => {
  it.each([
    {
      name: 'valid auth config',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'api-key',
          apiKey: 'xxx',
        },
      },
    },
    {
      name: 'valid auth config',
      patch: {
        auth: {
          enableAuth: true,
          authEngine: 'up-auth',
          authModel: {
            modelName: 'users',
            idColumn: 'id',
            usernameColumn: 'name',
            passwordColumn: 'name',
          },
        },
      },
    },
  ])('Scenario: $name -> should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      auth: patch.auth as unknown as typeof validBaseConfig.auth,
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// check invalid ssp configs
describe('validateInvalidSspConfig', () => {
  it.each([
    {
      name: 'invalid ssp config param type',
      patch: {ssp: [{paramType: 'invalid', paramName: 'id', value: '1'}]},
      expected:
        '/apis/customAPIs->customQueries->all->sample_query/ssp/0/paramType must be equal to one of the allowed values',
    },
    {
      name: 'invalid ssp config param type',
      patch: {ssp: [{paramType: 132, paramName: 'id', value: '1'}]},
      expected:
        '/apis/customAPIs->customQueries->all->sample_query/ssp/0/paramType must be equal to one of the allowed values',
    },
    {
      name: 'invalid ssp config param name',
      patch: {ssp: [{paramType: 'body', paramName: 123, value: '1'}]},
      expected:
        '/apis/customAPIs->customQueries->all->sample_query/ssp/0/paramName must be string',
    },
    {
      name: 'invalid ssp config param value',
      patch: {ssp: [{paramType: 'body', paramName: 'id', value: null}]},
      expected:
        '/apis/customAPIs->customQueries->all->sample_query/ssp/0/value must be string',
    },
  ])('Scenario: $name -> should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      apis: {
        'customAPIs->customQueries->all->sample_query': {
          ssp: patch.ssp,
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
      patch: {ssp: [{paramType: 'body', paramName: 'id', value: '1'}]},
    },
    {
      name: 'valid ssp config',
      patch: {ssp: [{paramType: 'body', paramName: 'id', value: 1}]},
    },
    {
      name: 'valid ssp config',
      patch: {ssp: [{paramType: 'body', paramName: 'id', value: true}]},
    },
    {
      name: 'valid ssp config',
      patch: {ssp: [{paramType: 'query', paramName: 'id', value: '1'}]},
    },
    {
      name: 'valid ssp config',
      patch: {ssp: [{paramType: 'path', paramName: 'id', value: '1'}]},
    },
  ])('Scenario: $name -> should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      apis: {
        'modelAPIs->posts->all->getAll': {
          ssp: patch.ssp,
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
      expected: 'modelAPIs->posts->all->getAll/authorization must be boolean',
    },
    {
      name: 'invalid authorization config',
      patch: {authorization: null},
      expected: 'modelAPIs->posts->all->getAll/authorization must be boolean',
    },
  ])('Scenario: $name -> should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      apis: {
        'modelAPIs->posts->all->getAll': {
          authorization: patch.authorization,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

// authorization is enabled when authentication is disabled
describe('validateInvalidAuthorizationConfig', () => {
  it.each([
    {
      name: 'authorization is enabled when authentication is disabled',
      patch: {authorization: true},
      expected:
        'apis/modelAPIs->posts->all->getAll/authorization: authorization is only allowed when auth is enabled',
    },
  ])('Scenario: $name -> should throw error', ({patch, expected}) => {
    const config = {
      ...validBaseConfig,
      auth: {
        enableAuth: false,
        authEngine: 'api-key',
        apiKey: '1234',
      },
      apis: {
        'modelAPIs->posts->all->getAll': {
          authorization: patch.authorization,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      expected,
    );
  });
});

// check valid authorization configs
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
  ])('Scenario: $name -> should return', ({patch}) => {
    const config = {
      ...validBaseConfig,
      auth: {
        enableAuth: true,
        authEngine: 'api-key',
        apiKey: '1234',
      },
      apis: {
        'modelAPIs->posts->all->getAll': {
          authorization: patch.authorization,
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });
});

// check communicate configs validation
describe('validateCommunicateConfig', () => {
  it('should pass when communicate config is valid', () => {
    const config = {
      ...validBaseConfig,
      communicate: {
        email: {
          emailEngine: 'dummy',
        },
      },
    };

    expect(validateConfig(config as unknown as AppConfig)).toEqual(config);
  });

  it('should throw when email config is missing required emailEngine', () => {
    const config = {
      ...validBaseConfig,
      communicate: {
        email: {},
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      "must have required property 'emailEngine'",
    );
  });

  it('should throw when email config has invalid emailEngine enum value', () => {
    const config = {
      ...validBaseConfig,
      communicate: {
        email: {
          emailEngine: 'invalid-engine',
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
      communicate: {
        email: {
          emailEngine: 'dummy',
          extraProperty: true,
        },
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      'must NOT have additional properties',
    );
  });

  it('should throw when communicate config itself has extra properties', () => {
    const config = {
      ...validBaseConfig,
      communicate: {
        email: {
          emailEngine: 'dummy',
        },
        extraProperty: true,
      },
    };

    expect(() => validateConfig(config as unknown as AppConfig)).toThrow(
      'must NOT have additional properties',
    );
  });
});
