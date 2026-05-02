import Ajv, {SchemaValidateFunction} from 'ajv';
import addFormats from 'ajv-formats';

import {
  AppConfig,
  JsonSchemaObject,
  JsonSchemaProperty,
  WebhookConfig,
} from '@/schema/config';

import {validateEntityName} from './entity';

const ajv = new Ajv({
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
      enum: ['integer', 'string', 'boolean', 'text', 'datetime'],
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
    webhooks: {
      type: 'array',
      items: webhookSchema,
    },
  },
};

const modelAPISchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    aggregate: {
      type: 'object',
      required: ['webhooks'],
      additionalProperties: false,
      properties: {
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
      },
    },
    delete: {
      type: 'object',
      additionalProperties: false,
      properties: {
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
      },
    },
    edit: {
      type: 'object',
      additionalProperties: false,
      properties: {
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
      },
    },
    'get-all': {
      type: 'object',
      additionalProperties: false,
      properties: {
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
      },
    },
    index: {
      type: 'object',
      additionalProperties: false,
      properties: {
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
      },
    },
    post: {
      type: 'object',
      additionalProperties: false,
      properties: {
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
      },
    },
    search: {
      type: 'object',
      additionalProperties: false,
      properties: {
        webhooks: {
          type: 'array',
          items: webhookSchema,
          minItems: 1,
        },
      },
    },
  },
};

const apisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    customQueries: {
      type: 'array',
      items: customQuerySchema,
    },
    modelAPIs: {
      type: 'object',
      additionalProperties: modelAPISchema,
    },
  },
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
  },
};

const ALLOWED_OPERATIONS: Record<string, string[]> = {
  integer: [
    'sortable',
    'editable',
    'deletable',
    'lessThan',
    'lessThanEqual',
    'greaterThan',
    'greaterThanEqual',
    'equal',
    'oneOf',
    'indexable',
  ],
  string: [
    'searchable',
    'sortable',
    'editable',
    'deletable',
    'equal',
    'oneOf',
    'indexable',
  ],
  boolean: ['equal'],
  text: [],
  datetime: [
    'sortable',
    'lessThan',
    'lessThanEqual',
    'greaterThan',
    'greaterThanEqual',
    'equal',
    'oneOf',
  ],
};

const ALLOWED_AGGREGATIONS: Record<string, string[]> = {
  integer: ['mean', 'max', 'min', 'count', 'sum'],
  string: ['count'],
  boolean: ['count', 'frequency'],
  text: [],
  datetime: ['mean', 'max', 'min', 'count'],
};

function validateFieldConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    model.fields.forEach((field, fi) => {
      const path = `/models/${mi}/fields/${fi}`;
      const {
        type,
        primaryKey,
        nullable,
        unique,
        supportedOperations,
        supportedAggregation,
      } = field;

      // Primary key rules
      if (primaryKey) {
        if (nullable !== false)
          errors.push(`${path}: primaryKey field must have nullable=false`);
        if (unique !== true)
          errors.push(`${path}: primaryKey field must have unique=true`);
        if (type !== 'integer' && type !== 'string') {
          errors.push(
            `${path}: primaryKey field must be of type integer or string (found ${type})`,
          );
        }
      }

      // Validate supportedOperations against allowed list for this type
      if (supportedOperations) {
        const allowed = ALLOWED_OPERATIONS[type] ?? [];
        supportedOperations.forEach(op => {
          if (!allowed.includes(op)) {
            errors.push(
              `${path}/supportedOperations: "${op}" is not allowed for type "${type}"`,
            );
          }
        });
      }

      // Validate supportedAggregation against allowed list for this type
      if (supportedAggregation) {
        const allowed = ALLOWED_AGGREGATIONS[type] ?? [];
        supportedAggregation.forEach(agg => {
          if (!allowed.includes(agg)) {
            errors.push(
              `${path}/supportedAggregation: "${agg}" is not allowed for type "${type}"`,
            );
          }
        });
      }
    });
  });

  return errors;
}

function validateIndexes(config: AppConfig): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    const path = `/models/${mi}`;

    if (!model.indexes) return;

    const indexNames = new Set<string>();
    const fieldNames = new Set(model.fields.map(f => f.name));

    model.indexes.forEach((index, ii) => {
      const indexPath = `${path}/indexes/${ii}`;

      // 1. unique index name
      if (indexNames.has(index.name)) {
        errors.push(`${indexPath}: duplicate index name "${index.name}"`);
      } else {
        indexNames.add(index.name);
      }

      // 2. columns must exist
      index.columns.forEach(col => {
        if (!fieldNames.has(col)) {
          errors.push(
            `${indexPath}/columns: column "${col}" does not exist in fields`,
          );
        }
      });
    });
  });

  return errors;
}

function validateForeignKeys(config: AppConfig): string[] {
  const errors: string[] = [];

  // Map of all models for quick lookup
  const modelMap = new Map<string, (typeof config.models)[0]>();
  config.models.forEach(m => modelMap.set(m.name, m));

  config.models.forEach((model, mi) => {
    const path = `/models/${mi}`;

    if (!model.foreignKeys) return;

    const fieldNames = new Set(model.fields.map(f => f.name));
    const fkNames = new Set<string>();

    model.foreignKeys.forEach((fk, fi) => {
      const fkPath = `${path}/foreignKeys/${fi}`;

      // 1. unique FK name inside model
      if (fkNames.has(fk.name)) {
        errors.push(`${fkPath}: duplicate foreign key name "${fk.name}"`);
      } else {
        fkNames.add(fk.name);
      }

      // 2. local columns must exist
      fk.columns.forEach(col => {
        if (!fieldNames.has(col)) {
          errors.push(
            `${fkPath}/columns: column "${col}" does not exist in model "${model.name}"`,
          );
        }
      });

      // 3. reference table must exist
      const refModel = modelMap.get(fk.referenceTable);
      if (!refModel) {
        errors.push(
          `${fkPath}: referenceTable "${fk.referenceTable}" does not exist`,
        );
        return;
      }

      const refFieldNames = new Set(refModel.fields.map(f => f.name));

      // 4. reference columns must exist
      fk.referenceColumns.forEach(col => {
        if (!refFieldNames.has(col)) {
          errors.push(
            `${fkPath}/referenceColumns: column "${col}" does not exist in table "${fk.referenceTable}"`,
          );
        }
      });

      // 5. column length match (VERY important)
      if (fk.columns.length !== fk.referenceColumns.length) {
        errors.push(
          `${fkPath}: columns and referenceColumns must have same length`,
        );
      }
    });
  });

  return errors;
}

function mapModelTypeToJsonSchema(type: string): string {
  switch (type) {
    case 'integer':
      return 'integer';
    case 'string':
    case 'text':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'datetime':
      return 'date-time';
    /* istanbul ignore next */
    default:
      return 'string';
  }
}

function normalizeSchemaForAjv(schema: JsonSchemaObject): JsonSchemaObject {
  const normalized = JSON.parse(JSON.stringify(schema));
  if (normalized.properties && typeof normalized.properties === 'object') {
    Object.keys(normalized.properties).forEach(key => {
      const prop = (
        normalized.properties as Record<string, JsonSchemaProperty>
      )[key];
      if (prop && (prop.type === 'datetime' || prop.type === 'date-time')) {
        prop.type = 'string';
        prop.format = 'date-time';
      }
    });
  }
  return normalized;
}

function validateModelValidation(config: AppConfig, ajv: Ajv): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    const validation = (model as {validation?: unknown}).validation;
    if (!validation) return;

    const path = `/models/${mi}/validation`;

    const schema = validation as JsonSchemaObject;

    // validate JSON schema
    const normalizedSchema = normalizeSchemaForAjv(schema);
    const isValidSchema = ajv.validateSchema(normalizedSchema);
    if (!isValidSchema) {
      const schemaErrors =
        ajv.errors?.map(e => `${path}: ${e.instancePath} ${e.message}`) ?? [];
      errors.push(...schemaErrors);
    }

    const fieldMap = new Map(model.fields.map(f => [f.name, f.type]));

    // properties validation
    if (schema.properties && typeof schema.properties === 'object') {
      Object.entries(schema.properties).forEach(([key, value]) => {
        const propPath = `${path}/properties/${key}`;

        if (!fieldMap.has(key)) {
          errors.push(`${propPath}: field does not exist in model`);
          return;
        }

        const modelType = fieldMap.get(key)!;
        const expectedType = mapModelTypeToJsonSchema(modelType);

        let schemaType: string | undefined;

        if (typeof value === 'object' && value !== null && 'type' in value) {
          const v = value as JsonSchemaProperty;
          schemaType = v.type;
        }

        if (schemaType && schemaType !== expectedType) {
          const isDateMatch =
            (schemaType === 'datetime' || schemaType === 'date-time') &&
            (expectedType === 'datetime' || expectedType === 'date-time');

          if (!isDateMatch) {
            errors.push(
              `${propPath}: type mismatch (model=${modelType}, schema=${schemaType})`,
            );
          }
        }
      });
    }

    // required validation
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required)) {
        errors.push(`${path}/required: must be an array`);
      } else {
        schema.required.forEach((field, idx) => {
          if (!fieldMap.has(field)) {
            errors.push(
              `${path}/required/${idx}: field "${field}" does not exist in model`,
            );
          }
        });
      }
    }
  });

  return errors;
}

function validateRateLimitConstraints(config: AppConfig): string[] {
  const errors: string[] = [];
  const rateLimit = config.application.rateLimit;

  if (!rateLimit) return errors;

  const path = '/application/rateLimit';

  // Validate useRedis make sure cache_db details are provided in config
  if (rateLimit.useRedis && !config.cache_db) {
    errors.push(`${path}: useRedis is true but cache_db is not configured`);
  }

  return errors;
}

function validateCacheDbConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  if (!config.cache_db) return errors;

  return errors;
}

function validateWebhookConstraints(webhooks: WebhookConfig[]): string[] {
  const errors: string[] = [];

  webhooks.forEach((webhook, i) => {
    const path = `/webhooks/${i}`;
    // make sure atleast triggerOnRequest or triggerOnResponse is true
    if (!webhook.triggerOnRequest && !webhook.triggerOnResponse) {
      errors.push(
        `${path}: webhook must have at least one of triggerOnRequest or triggerOnResponse`,
      );
    }

    // data resp cannot be used when triggerOnRequest is true
    if (webhook.triggerOnRequest && webhook.data.includes('resp')) {
      errors.push(
        `${path}: data resp cannot be used when triggerOnRequest is true`,
      );
    }
  });

  return errors;
}

function validateModelNameInModelAPIs(config: AppConfig): string[] {
  const errors: string[] = [];

  // extra all the model names
  const modelNames = config.models.map(m => m.name);

  // iterate through all modelAPIs and check the name
  const modelAPIs = config.apis?.modelAPIs ?? {};
  Object.keys(modelAPIs).forEach((modelName, i) => {
    const path = `/apis/modelAPIs/${i}`;

    if (!modelNames.includes(modelName)) {
      errors.push(`${path}: model does not exist`);
    }
  });

  return errors;
}

function validateCustomAPIs(config: AppConfig): string[] {
  const errors: string[] = [];

  const customQueries = config.customAPIs?.customQueries ?? [];

  const existingNames = new Set<string>();

  if (customQueries.length > 0) {
    customQueries.forEach((cq, i) => {
      const path = `/customAPIs/customQueries/${i}`;

      const q = cq.query.trim().toUpperCase();

      // validate the name to make sure it is unique and follow naming convention
      if (!cq.name || existingNames.has(cq.name)) {
        errors.push(`${path}/name: name must be unique and non-empty`);
      }
      existingNames.add(cq.name);

      // DDL commands usually start with CREATE, ALTER, DROP, TRUNCATE, RENAME
      const ddlPrefixes = [
        'CREATE ',
        'ALTER ',
        'DROP ',
        'TRUNCATE ',
        'RENAME ',
      ];
      if (ddlPrefixes.some(prefix => q.startsWith(prefix))) {
        errors.push(`${path}/query: DDL queries are not allowed`);
        return;
      }

      const isDql = q.startsWith('SELECT ') || q.startsWith('WITH ');
      const dmlPrefixes = ['INSERT ', 'UPDATE ', 'DELETE '];
      const isDml = dmlPrefixes.some(prefix => q.startsWith(prefix));

      if (cq.method === 'GET') {
        if (!isDql) {
          errors.push(
            `${path}/query: only DQL queries are allowed for GET method`,
          );
        }
      } else {
        if (!isDql && !isDml) {
          errors.push(`${path}/query: only DQL and DML queries are allowed`);
        }
      }

      // Magic variables validation
      const delims = ['@@', '$$', '&&'];
      const foundDelims: {pos: number; type: string}[] = [];

      delims.forEach(d => {
        let pos = cq.query.indexOf(d);
        while (pos !== -1) {
          foundDelims.push({pos, type: d});
          pos = cq.query.indexOf(d, pos + 2);
        }
      });

      foundDelims.sort((a, b) => a.pos - b.pos);

      for (let i = 0; i < foundDelims.length; i += 2) {
        const start = foundDelims[i];
        const end = foundDelims[i + 1];

        if (!end) {
          errors.push(
            `${path}/query: unclosed magic variable delimiter "${start.type}"`,
          );
          break;
        }

        if (start.type !== end.type) {
          errors.push(
            `${path}/query: mixed magic variable delimiters "${start.type}" and "${end.type}"`,
          );
          continue;
        }

        const varString = cq.query.substring(start.pos + 2, end.pos);
        const parts = varString.split(':');
        const varName = parts[0];
        const varType = parts[1];
        const typeName =
          start.type === '@@'
            ? 'body (@@)'
            : start.type === '$$'
              ? 'path ($$)'
              : 'query (&&)';

        // 1. Validation for variable name patterns (alphanumeric, underscores, hyphens)
        if (!/^[a-zA-Z0-9_-]+$/.test(varName)) {
          errors.push(
            `${path}/query: invalid magic variable name "${varName}" for ${typeName} parameter`,
          );
        }

        // 2. Validate datatype
        if (parts.length > 2) {
          errors.push(
            `${path}/query: invalid magic variable format "${varString}", multiple types provided`,
          );
        } else if (!varType) {
          errors.push(
            `${path}/query: missing data type for magic variable "${varName}" in ${typeName} parameter`,
          );
        } else if (
          !['integer', 'string', 'boolean', 'text', 'datetime'].includes(
            varType,
          )
        ) {
          errors.push(
            `${path}/query: invalid magic variable type "${varType}" for ${typeName} parameter`,
          );
        }

        // 3. GET method should not have body magic variables (@@)
        if (cq.method === 'GET' && start.type === '@@') {
          errors.push(
            `${path}/query: body magic variables (@@) are not allowed for GET method`,
          );
        }
      }

      // validate the webhook
      if (cq.webhooks) {
        const webhookErrors = validateWebhookConstraints(cq.webhooks);
        if (webhookErrors.length > 0) {
          webhookErrors.forEach(error => {
            errors.push(`${path}${error}`);
          });
        }
      }
    });
  }

  return errors;
}

function validateApisConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  // validate the modelAPIs
  if (config.apis?.modelAPIs) {
    const modelAPIErrors = validateModelNameInModelAPIs(config);
    if (modelAPIErrors.length > 0) {
      modelAPIErrors.forEach(error => {
        errors.push(`apis${error}`);
      });
    }

    // validate the webhooks in modelAPIs
    Object.keys(config.apis.modelAPIs).forEach((modelName, mi) => {
      const modelConfig = config.apis!.modelAPIs![modelName];
      Object.entries(modelConfig).forEach(([operation, opConfig]) => {
        if (
          opConfig &&
          (opConfig as unknown as {webhooks?: unknown}).webhooks
        ) {
          const webhookErrors = validateWebhookConstraints(
            (opConfig as unknown as {webhooks?: unknown})
              .webhooks as WebhookConfig[],
          );
          if (webhookErrors.length > 0) {
            webhookErrors.forEach(error => {
              errors.push(`apis/apis/modelAPIs/${mi}/${operation}${error}`);
            });
          }
        }
      });
    });
  }

  return errors;
}

function validateAuthConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  // if authModel is api-key, then apiKey is required
  if (config.auth?.authEngine === 'api-key' && !config.auth?.apiKey) {
    errors.push('/auth/apiKey: apiKey is required when authEngine is api-key');
  }

  // if authModel is api-key, then authModel should not be present
  if (config.auth?.authEngine === 'api-key' && config.auth?.authModel) {
    errors.push(
      '/auth/authModel: authModel should not be present when authEngine is api-key',
    );
  }

  // if authModel is up-auth, then authModel is required
  if (config.auth?.authEngine === 'up-auth' && !config.auth?.authModel) {
    errors.push(
      '/auth/authModel: authModel is required when authEngine is up-auth',
    );
  }

  // if authModel is up-auth, then apiKey should not be present
  if (config.auth?.authEngine === 'up-auth' && config.auth?.apiKey) {
    errors.push(
      '/auth/apiKey: apiKey should not be present when authEngine is up-auth',
    );
  }

  // check if authModel.modelName exists in models
  if (config.auth?.authEngine === 'up-auth' && config.auth?.authModel) {
    if (
      config.auth?.authModel.modelName &&
      !config.models.some(m => m.name === config.auth?.authModel.modelName)
    ) {
      errors.push('/auth/authModel/modelName: model does not exist');
    }

    // check if authModel.idColumn exists in models
    if (
      config.auth?.authModel.idColumn &&
      !config.models.some(m =>
        m.fields.some(f => f.name === config.auth?.authModel.idColumn),
      )
    ) {
      errors.push('/auth/authModel/idColumn: field does not exist in model');
    }

    // check if authModel.usernameColumn exists in models
    if (
      config.auth?.authModel.usernameColumn &&
      !config.models.some(m =>
        m.fields.some(f => f.name === config.auth?.authModel.usernameColumn),
      )
    ) {
      errors.push(
        '/auth/authModel/usernameColumn: field does not exist in model',
      );
    }

    // check if authModel.passwordColumn exists in models
    if (
      config.auth?.authModel.passwordColumn &&
      !config.models.some(m =>
        m.fields.some(f => f.name === config.auth?.authModel.passwordColumn),
      )
    ) {
      errors.push(
        '/auth/authModel/passwordColumn: field does not exist in model',
      );
    }
  }

  return errors;
}

const validateSchema = ajv.compile(schema);

export function validateConfig(input: AppConfig) {
  const valid = validateSchema(input);

  const ajvErrors: string[] = valid
    ? []
    : (validateSchema.errors?.map(e => `${e.instancePath} ${e.message}`) ?? []);

  const constraintErrors = valid
    ? [
        ...validateFieldConstraints(input as AppConfig),
        ...validateIndexes(input as AppConfig),
        ...validateForeignKeys(input as AppConfig),
        ...validateModelValidation(input as AppConfig, ajv),
        ...validateRateLimitConstraints(input as AppConfig),
        ...validateCacheDbConstraints(input as AppConfig),
        ...validateCustomAPIs(input as AppConfig),
        ...validateApisConstraints(input as AppConfig),
        ...validateAuthConstraints(input as AppConfig),
      ]
    : [];

  const allErrors = [...ajvErrors, ...constraintErrors];

  if (allErrors.length > 0) {
    throw new Error(allErrors.join('\n'));
  }

  return input;
}
