import Ajv, {SchemaValidateFunction} from 'ajv';
import addFormats from 'ajv-formats';

import {validateEntityName} from '@/validators/entity';

export const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: false,
  strict: true,
});

addFormats(ajv);

ajv.addKeyword({
  keyword: 'isEntityName',
  type: 'string',
  schema: false,
  errors: true,
  validate: function validate(data: string) {
    try {
      validateEntityName(data);
      return true;
    } catch (e: unknown) {
      (validate as SchemaValidateFunction).errors = [
        {
          keyword: 'isEntityName',
          message: (e as Error).message || 'Entity name is invalid',
          params: {keyword: 'isEntityName'},
        },
      ];
      return false;
    }
  } as SchemaValidateFunction,
});

const applicationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['logLevel'],
  properties: {
    logLevel: {
      type: 'string',
      enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'],
    },
    rateLimit: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'max', 'timeWindow', 'useRedis'],
      properties: {
        enabled: {type: 'boolean'},
        max: {type: 'integer', minimum: 1},
        timeWindow: {
          type: 'string',
          pattern: '^\\d+[smhd]$',
        },
        useRedis: {type: 'boolean'},
      },
    },
  },
};

const swaggerSchema = {
  type: 'object',
  required: ['enabled', 'basePath', 'info'],
  additionalProperties: false,
  properties: {
    enabled: {type: 'boolean'},
    basePath: {
      type: 'string',
      pattern: '^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$',
    },
    info: {
      type: 'object',
      required: ['title'],
      additionalProperties: false,
      properties: {
        title: {type: 'string', minLength: 5},
        description: {type: 'string', minLength: 25},
        version: {type: 'string'},
        termsOfService: {type: 'string', format: 'uri'},
        contact: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: {type: 'string', minLength: 5},
            url: {type: 'string', format: 'uri'},
            email: {type: 'string', format: 'email'},
          },
        },
        license: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: {type: 'string', minLength: 1},
            url: {type: 'string', format: 'uri'},
          },
        },
      },
    },
  },
};

const databaseSchema = {
  type: 'object',
  required: ['engine', 'connection'],
  properties: {
    engine: {type: 'string', enum: ['sqlite', 'pg']},
    connection: {
      type: 'object',
      required: ['urlOrPath'],
      additionalProperties: false,
      properties: {
        urlOrPath: {type: 'string'},
      },
    },
    dbTimeout: {type: 'integer', default: 10000, minimum: 1},
  },
  oneOf: [
    {
      type: 'object',
      properties: {
        engine: {const: 'sqlite'},
        connection: {
          type: 'object',
          properties: {
            urlOrPath: {
              type: 'string',
              pattern:
                '^(.\\/|\\/)?([\\w\\-. ]+\\/)*[\\w\\-. ]+\\.(db|sqlite)$',
            },
          },
        },
      },
    },
    {
      type: 'object',
      properties: {
        engine: {const: 'pg'},
        connection: {
          type: 'object',
          properties: {
            urlOrPath: {
              type: 'string',
              pattern: '^postgres(ql)?:\\/\\/',
            },
          },
        },
      },
    },
  ],
  additionalProperties: false,
};

const cacheDbSchema = {
  type: 'object',
  required: ['engine', 'connection'],
  additionalProperties: false,
  properties: {
    engine: {type: 'string', enum: ['redis']},
    connection: {
      type: 'object',
      required: ['uri'],
      additionalProperties: false,
      properties: {
        uri: {type: 'string', pattern: '^redis:\\/\\/'},
      },
    },
    timeout: {type: 'integer', default: 10000, minimum: 1},
  },
};

const fieldSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'type'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    type: {
      type: 'string',
      enum: [
        'integer',
        'string',
        'boolean',
        'text',
        'datetime',
        'decimal',
        'date',
      ],
    },
    primaryKey: {type: 'boolean', default: false},
    nullable: {type: 'boolean', default: true},
    unique: {type: 'boolean', default: false},
    default: true,
    supportedOperations: {
      type: 'array',
      items: {type: 'string'},
      uniqueItems: true,
    },
    supportedAggregation: {
      type: 'array',
      items: {type: 'string'},
      uniqueItems: true,
    },
  },
};

const indexSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'columns'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    columns: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        isEntityName: true,
      },
      uniqueItems: true,
    },
    unique: {
      type: 'boolean',
      default: false,
    },
  },
};

const foreignKeySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'columns', 'referenceTable', 'referenceColumns'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    columns: {
      type: 'array',
      minItems: 1,
      items: {type: 'string', isEntityName: true},
      uniqueItems: true,
    },
    referenceTable: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    referenceColumns: {
      type: 'array',
      minItems: 1,
      items: {type: 'string', isEntityName: true},
      uniqueItems: true,
    },
    onDelete: {
      type: 'string',
      enum: ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION'],
    },
    onUpdate: {
      type: 'string',
      enum: ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION'],
    },
  },
};

const modelSchema = {
  type: 'object',
  required: ['name', 'fields'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      isEntityName: true,
      minLength: 1,
    },
    fields: {
      type: 'array',
      minItems: 1,
      items: fieldSchema,
    },
    indexes: {
      type: 'array',
      items: indexSchema,
    },
    foreignKeys: {
      type: 'array',
      items: foreignKeySchema,
    },
    validation: {
      type: 'object',
      nullable: true,
    },
  },
};

const webhookSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['url'],
  properties: {
    url: {
      type: 'string',
      pattern: '^https?:\\/\\/',
    },
    data: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['query', 'body', 'params', 'resp'],
      },
      minItems: 1,
    },
    triggerOnRequest: {
      type: 'boolean',
      default: false,
    },
    triggerOnResponse: {
      type: 'boolean',
      default: false,
    },
  },
};

const customQuerySchema = {
  type: 'object',
  required: ['name', 'method', 'path', 'query'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    method: {
      type: 'string',
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
    path: {
      type: 'string',
      pattern: '^\\/[a-z_\\-\\/]+$',
    },
    query: {
      type: 'string',
      minLength: 1,
    },
  },
};

const sspSchema = {
  type: 'object',
  required: ['paramType', 'paramName', 'value'],
  additionalProperties: false,
  properties: {
    paramType: {
      type: 'string',
      enum: ['path', 'query', 'body'],
    },
    paramName: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    value: {
      anyOf: [{type: 'string'}, {type: 'number'}, {type: 'boolean'}],
    },
  },
};

const apisSchema = {
  type: 'object',
  patternProperties: {
    '^[A-Za-z0-9-_>]+$': {
      type: 'object',
      properties: {
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
        ssp: {
          type: 'array',
          items: sspSchema,
          minItems: 1,
        },
        authorization: {
          type: 'boolean',
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const customAPIsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    customQueries: {
      type: 'array',
      items: customQuerySchema,
    },
  },
};

const authSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['enableAuth', 'authEngine'],
  properties: {
    enableAuth: {
      type: 'boolean',
    },
    authEngine: {
      type: 'string',
      enum: ['api-key', 'up-auth'],
    },
    authModel: {
      type: 'object',
      additionalProperties: false,
      required: ['modelName', 'idColumn', 'usernameColumn', 'passwordColumn'],
      properties: {
        modelName: {
          type: 'string',
          isEntityName: true,
          minLength: 1,
        },
        idColumn: {
          type: 'string',
          isEntityName: true,
          minLength: 1,
        },
        usernameColumn: {
          type: 'string',
          isEntityName: true,
          minLength: 1,
        },
        passwordColumn: {
          type: 'string',
          isEntityName: true,
          minLength: 1,
        },
      },
    },
    apiKey: {
      type: 'string',
      minLength: 1,
      nullable: true,
    },
  },
};

const emailSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['emailEngine'],
  properties: {
    emailEngine: {
      type: 'string',
      enum: ['dummy'],
    },
  },
};

const schema = {
  type: 'object',
  required: ['application', 'swagger', 'database', 'models'],
  additionalProperties: false,
  properties: {
    application: applicationSchema,
    swagger: swaggerSchema,
    database: databaseSchema,
    models: {
      type: 'array',
      minItems: 1,
      items: modelSchema,
    },
    apis: apisSchema,
    cache_db: cacheDbSchema,
    customAPIs: customAPIsSchema,
    auth: authSchema,
    email: emailSchema,
  },
};

const validateSchema = ajv.compile(schema);

export default validateSchema;
