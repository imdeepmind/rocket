import Ajv, {SchemaValidateFunction} from 'ajv';
import addFormats from 'ajv-formats';

import {validateEntityName} from '@/validators/entity';

export const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: false,
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
  required: ['name'],
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
          pattern: '^[1-9]\\d*[smhd]$',
        },
        rateLimitHealthAPI: {type: 'boolean'},
      },
    },
    cors: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled'],
      properties: {
        enabled: {type: 'boolean'},
        origins: {
          type: 'array',
          items: {type: 'string', minLength: 1},
        },
        methods: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
          },
        },
        allowedHeaders: {
          type: 'array',
          items: {type: 'string', minLength: 1},
        },
        exposedHeaders: {
          type: 'array',
          items: {type: 'string', minLength: 1},
        },
        credentials: {type: 'boolean'},
        maxAge: {type: 'integer', minimum: 0},
        routes: {
          type: 'array',
          items: {type: 'string', minLength: 1},
        },
      },
    },
    dangerouslyOverrideDefaultVariant: {
      type: 'string',
      minLength: 1,
      maxLength: 25,
      pattern: '^[a-zA-Z0-9_-]+$',
    },
    magicVariables: {
      type: 'object',
      additionalProperties: {
        anyOf: [{type: 'string'}, {type: 'number'}, {type: 'boolean'}],
      },
    },
    healthCheck: {
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: {type: 'boolean'},
        path: {type: 'string', minLength: 1},
      },
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
            title: {type: 'string', minLength: 1},
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
    engine: {type: 'string', enum: ['sqlite', 'postgres', 'mysql']},
    connection: {
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: {type: 'string'},
      },
    },
    timeout: {type: 'integer', minimum: 1},
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
    {
      type: 'object',
      properties: {
        engine: {const: 'mysql'},
        connection: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              pattern: '^(mysql(2)?|mariadb):\\/\\/',
            },
          },
        },
      },
    },
  ],
  additionalProperties: false,
};

const cacheSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['engine'],
      properties: {
        engine: {const: 'memory'},
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['engine', 'connection'],
      properties: {
        engine: {const: 'redis'},
        connection: {
          type: 'object',
          required: ['url'],
          additionalProperties: false,
          properties: {
            url: {type: 'string', pattern: '^redis:\\/\\/'},
          },
        },
        timeout: {type: 'integer', minimum: 1},
      },
    },
  ],
};

const infrastructureSchema = {
  type: 'object',
  required: ['database'],
  additionalProperties: false,
  properties: {
    database: databaseSchema,
    cache: cacheSchema,
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
    primaryKey: {type: 'boolean'},
    autoIncrement: {type: 'boolean'},
    nullable: {type: 'boolean'},
    unique: {type: 'boolean'},
    // `default` allows any user value for the column default (no schema
    // default-keyword here; `{}` = any value)
    default: {},
    secret: {type: 'boolean'},
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
  required: ['url', 'data'],
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
    },
    triggerOnResponse: {
      type: 'boolean',
    },
  },
};

const customEndpointSqlHandlerSchema = {
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

const customEndpointFunctionHandlerSchema = {
  type: 'object',
  required: ['type', 'file', 'exportName'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: ['function'],
    },
    file: {
      type: 'string',
      minLength: 1,
    },
    exportName: {
      type: 'string',
      minLength: 1,
    },
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'array',
          items: {type: 'string', minLength: 1},
          uniqueItems: true,
        },
        query: {
          type: 'array',
          items: {type: 'string', minLength: 1},
          uniqueItems: true,
        },
        body: {
          type: 'array',
          items: {type: 'string', minLength: 1},
          uniqueItems: true,
        },
        headers: {
          type: 'array',
          items: {type: 'string', minLength: 1},
          uniqueItems: true,
        },
        header: {
          type: 'array',
          items: {type: 'string', minLength: 1},
          uniqueItems: true,
        },
      },
    },
  },
};

const customEndpointHandlerSchema = {
  oneOf: [customEndpointSqlHandlerSchema, customEndpointFunctionHandlerSchema],
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
      pattern:
        '^\\/([a-zA-Z0-9_-]+|:[a-zA-Z0-9_-]+)(\\/([a-zA-Z0-9_-]+|:[a-zA-Z0-9_-]+))*$',
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
        roles: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
          uniqueItems: true,
          minItems: 1,
        },
        bypassSecret: {
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
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['enabled'],
      properties: {
        enabled: {const: false},
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'provider'],
      properties: {
        enabled: {const: true},
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
    },
  ],
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

const roleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    description: {
      type: 'string',
    },
    includes: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
      },
      uniqueItems: true,
    },
  },
};

const rolesSchema = {
  type: 'object',
  minProperties: 1,
  patternProperties: {
    '^[a-zA-Z0-9_:-]+$': roleSchema,
  },
  additionalProperties: false,
};

const rbacSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['enabled'],
      properties: {
        enabled: {const: false},
        modelName: {
          type: 'string',
          isEntityName: true,
          minLength: 1,
        },
        roleField: {
          type: 'string',
          isEntityName: true,
          minLength: 1,
        },
        defaultRole: {
          type: 'string',
          minLength: 1,
        },
        roles: {
          type: 'object',
          patternProperties: {
            '^[a-zA-Z0-9_:-]+$': roleSchema,
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'modelName', 'roleField', 'defaultRole', 'roles'],
      properties: {
        enabled: {const: true},
        modelName: {
          type: 'string',
          isEntityName: true,
          minLength: 1,
        },
        roleField: {
          type: 'string',
          isEntityName: true,
          minLength: 1,
        },
        defaultRole: {
          type: 'string',
          minLength: 1,
        },
        roles: rolesSchema,
      },
    },
  ],
};

const schema = {
  type: 'object',
  required: ['application', 'data'],
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
    rbac: rbacSchema,
  },
};

const validateSchema = ajv.compile(schema);

export default validateSchema;
