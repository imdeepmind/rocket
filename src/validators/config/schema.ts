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
  required: ['logLevel', 'name'],
  properties: {
    name: {type: 'string', minLength: 1},
    logLevel: {
      type: 'string',
      enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'],
    },
    rateLimit: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'max', 'timeWindow'],
      properties: {
        enabled: {type: 'boolean'},
        max: {type: 'integer', minimum: 1},
        timeWindow: {
          type: 'string',
          pattern: '^\\d+[smhd]$',
        },
      },
    },
    dangerouslyOverrideDefaultVariant: {
      type: 'string',
      minLength: 1,
      maxLength: 25,
      pattern: '^[a-zA-Z0-9_-]+$',
    },
  },
};

const docsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['openapi'],
  properties: {
    openapi: {
      type: 'object',
      required: ['enabled', 'path', 'info'],
      additionalProperties: false,
      properties: {
        enabled: {type: 'boolean'},
        path: {
          type: 'string',
          pattern: '^\\/([A-Za-z0-9-_]+\\/)*[A-Za-z0-9-_]*$',
        },
        info: {
          type: 'object',
          required: ['title', 'version'],
          additionalProperties: false,
          properties: {
            title: {type: 'string', minLength: 5},
            description: {type: 'string', minLength: 1},
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
    },
  },
};

const databaseSchema = {
  type: 'object',
  required: ['engine', 'connection'],
  properties: {
    engine: {type: 'string', enum: ['sqlite', 'postgres']},
    connection: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: {type: 'string'},
      },
    },
    timeout: {type: 'integer', default: 10000, minimum: 1},
  },
  oneOf: [
    {
      type: 'object',
      properties: {
        engine: {const: 'sqlite'},
        connection: {
          type: 'object',
          properties: {
            url: {
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
        engine: {const: 'postgres'},
        connection: {
          type: 'object',
          properties: {
            url: {
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
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: {type: 'string', pattern: '^redis:\\/\\/'},
      },
    },
    timeout: {type: 'integer', default: 10000, minimum: 1},
  },
};

const infrastructureSchema = {
  type: 'object',
  required: ['database'],
  additionalProperties: false,
  properties: {
    database: databaseSchema,
    cache: cacheDbSchema,
  },
};

const fieldSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type'],
  properties: {
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
        'json',
        'enum',
        'uuid',
        'ulid',
      ],
    },
    primaryKey: {type: 'boolean', default: false},
    autoIncrement: {type: 'boolean', default: false},
    nullable: {type: 'boolean', default: true},
    unique: {type: 'boolean', default: false},
    default: true,
    apis: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['search', 'index', 'edit', 'delete'],
      },
      uniqueItems: true,
    },
    query: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'not_in', 'sort'],
      },
      uniqueItems: true,
    },
    aggregations: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['count', 'avg', 'sum', 'min', 'max', 'frequency'],
      },
      uniqueItems: true,
    },
    values: {
      type: 'array',
      items: {type: 'string', minLength: 1},
      minItems: 1,
      uniqueItems: true,
    },
  },
};

const indexSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['fields'],
  properties: {
    fields: {
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

const relationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'model', 'localField', 'foreignField'],
  properties: {
    type: {
      type: 'string',
      enum: ['belongsTo'],
    },
    model: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    localField: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    foreignField: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    onDelete: {
      type: 'string',
      enum: ['cascade', 'set null', 'set default', 'restrict', 'no action'],
    },
    onUpdate: {
      type: 'string',
      enum: ['cascade', 'set null', 'set default', 'restrict', 'no action'],
    },
  },
};

const modelSchema = {
  type: 'object',
  required: ['fields'],
  additionalProperties: false,
  properties: {
    timestamps: {
      type: 'boolean',
    },
    fields: {
      type: 'object',
      minProperties: 1,
      additionalProperties: fieldSchema,
    },
    indexes: {
      type: 'object',
      additionalProperties: indexSchema,
    },
    relations: {
      type: 'object',
      additionalProperties: relationSchema,
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
        enum: ['query', 'body', 'params', 'response'],
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

const customEndpointHandlerSchema = {
  type: 'object',
  required: ['type', 'sql'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: ['sql'],
    },
    sql: {
      type: 'string',
      minLength: 1,
    },
  },
};

const customEndpointSchema = {
  type: 'object',
  required: ['method', 'path', 'description', 'handler'],
  additionalProperties: false,
  properties: {
    method: {
      type: 'string',
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
    path: {
      type: 'string',
      pattern: '^\\/[a-zA-Z0-9_-]+$',
    },
    description: {
      type: 'string',
      minLength: 1,
    },
    validation: {
      type: 'object',
    },
    handler: customEndpointHandlerSchema,
  },
};

const serverSideParamSchema = {
  type: 'object',
  required: ['type', 'name', 'value'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: ['path', 'query', 'body'],
    },
    name: {
      type: 'string',
      minLength: 1,
      isEntityName: true,
    },
    value: {
      anyOf: [{type: 'string'}, {type: 'number'}, {type: 'boolean'}],
    },
  },
};

const queryOperationValues = [
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'not_in',
  'sort',
];
const aggregationValues = ['count', 'avg', 'sum', 'min', 'max', 'frequency'];

const apisSchema = {
  type: 'object',
  patternProperties: {
    '^[A-Za-z0-9-_.]+$': {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
        },
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
        serverSideParams: {
          type: 'array',
          items: serverSideParamSchema,
          minItems: 1,
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 2,
            maxLength: 25,
          },
          minItems: 1,
        },
        authorization: {
          type: 'boolean',
        },
        supportedQueries: {
          type: 'array',
          items: {
            type: 'string',
            enum: queryOperationValues,
          },
          uniqueItems: true,
          minItems: 1,
        },
        supportedAggregations: {
          type: 'array',
          items: {
            type: 'string',
            enum: aggregationValues,
          },
          uniqueItems: true,
          minItems: 1,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const customEndpointsSchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: customEndpointSchema,
};

const userModelSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['model', 'idField', 'usernameField', 'passwordField'],
  properties: {
    model: {
      type: 'string',
      isEntityName: true,
      minLength: 1,
    },
    idField: {
      type: 'string',
      isEntityName: true,
      minLength: 1,
    },
    usernameField: {
      type: 'string',
      isEntityName: true,
      minLength: 1,
    },
    passwordField: {
      type: 'string',
      isEntityName: true,
      minLength: 1,
    },
    isVerifiedField: {
      type: 'string',
      isEntityName: true,
      minLength: 1,
    },
  },
};

const authenticationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['enabled', 'provider'],
  properties: {
    enabled: {
      type: 'boolean',
    },
    provider: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'config'],
      properties: {
        type: {
          type: 'string',
          enum: ['api-key', 'up-auth'],
        },
        config: {
          type: 'object',
          additionalProperties: false,
          properties: {
            userModel: userModelSchema,
            jwtSecret: {
              type: 'string',
              minLength: 32,
            },
            tokenExpiration: {
              type: 'string',
              pattern: '^\\d+[smhd]$',
            },
            mfaRequired: {
              type: 'boolean',
            },
            key: {
              type: 'string',
              minLength: 1,
            },
          },
        },
      },
    },
  },
};

const emailSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['provider'],
  properties: {
    provider: {
      type: 'string',
      enum: ['dummy'],
    },
  },
};

const integrationsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: emailSchema,
  },
};

const apiVariantsSchema = {
  type: 'object',
  patternProperties: {
    '^[A-Za-z0-9-_.]+$': {
      type: 'object',
      required: ['variants'],
      additionalProperties: false,
      properties: {
        variants: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'string',
            minLength: 1,
            maxLength: 25,
            pattern: '^[a-zA-Z0-9_-]+$',
          },
          uniqueItems: true,
        },
      },
    },
  },
  additionalProperties: false,
};

const schema = {
  type: 'object',
  required: ['application', 'docs', 'infrastructure', 'data'],
  additionalProperties: false,
  properties: {
    application: applicationSchema,
    docs: docsSchema,
    infrastructure: infrastructureSchema,
    data: {
      type: 'object',
      required: ['models'],
      additionalProperties: false,
      properties: {
        models: {
          type: 'object',
          minProperties: 1,
          additionalProperties: modelSchema,
        },
      },
    },
    apis: apisSchema,
    customEndpoints: customEndpointsSchema,
    authentication: authenticationSchema,
    integrations: integrationsSchema,
    apiVariants: apiVariantsSchema,
  },
};

const validateSchema = ajv.compile(schema);

export default validateSchema;
