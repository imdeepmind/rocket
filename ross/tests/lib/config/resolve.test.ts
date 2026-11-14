import * as path from 'path';

import {expect, test} from 'vitest';

import {
  resolveConfig,
  resolveModelField,
  resolveWebhook,
} from '@/lib/config/resolve';

import {
  AppConfigInput,
  ModelConfigInput,
  ModelFieldConfig,
  ResolvedAuthenticationConfig,
  ResolvedModelFieldConfig,
  WebhookConfig,
} from '@/interfaces/config';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const upAuth = {
  enabled: true,
  provider: {
    type: 'up-auth',
    config: {
      userModel: {
        model: 'users',
        idField: 'id',
        usernameField: 'email',
        passwordField: 'password',
      },
      jwtSecret: 'a-very-long-secret-used-for-testing-purposes',
    },
  },
} as const;

const simpleUserModel = {
  fields: {
    id: {type: 'integer'},
    email: {type: 'string'},
  } as Record<string, ModelFieldConfig>,
};

function devInput(overrides: Partial<AppConfigInput> = {}): AppConfigInput {
  return {
    application: {name: 'rocket'},
    data: {models: {}},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Minimal dev config
// ---------------------------------------------------------------------------

test('minimal dev config resolves every section densely', () => {
  const config = resolveConfig(devInput(), {mode: 'dev'});

  // application
  expect(config.application).toEqual({
    name: 'rocket',
    logLevel: 'info',
    rateLimit: {
      enabled: false,
      max: 100,
      timeWindow: '1m',
      rateLimitHealthAPI: false,
    },
    dangerouslyOverrideDefaultVariant: 'v1',
    magicVariables: {},
    cors: {
      enabled: false,
      origins: [],
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
      exposedHeaders: [],
      credentials: false,
      maxAge: 86400,
      routes: [],
    },
    healthCheck: {
      enabled: true,
      path: '/api/health',
    },
  });

  // docs enabled in dev
  expect(config.docs.openapi.enabled).toBe(true);
  expect(config.docs.openapi.path).toBe('/docs');
  expect(config.docs.openapi.info).toEqual({title: 'rocket', version: '1.0.0'});

  // default sqlite database
  expect(config.infrastructure.database).toEqual({
    engine: 'sqlite',
    connection: {url: './database.db'},
    timeout: 10000,
  });

  // memory cache
  expect(config.infrastructure.cache).toEqual({engine: 'memory'});

  // data passes through densely
  expect(config.data).toEqual({models: {}});

  // authentication disabled
  expect(config.authentication).toEqual({enabled: false});

  // rbac disabled
  expect(config.rbac).toEqual({enabled: false});

  // pass-through sections
  expect(config.apis).toEqual({});
  expect(config.customEndpoints).toEqual({});
  expect(config.integrations).toEqual({});
  expect(config.apiVariants).toEqual({});
});

// ---------------------------------------------------------------------------
// Prod database rules
// ---------------------------------------------------------------------------

test('prod mode without a database throws a clear error', () => {
  expect(() =>
    resolveConfig({data: {models: {}}} as AppConfigInput, {mode: 'prod'}),
  ).toThrow('Config error: infrastructure.database is required in prod mode');
});

test('prod mode with a database resolves with a default timeout', () => {
  const config = resolveConfig(
    {
      application: {name: 'rocket'},
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://localhost/db'},
        },
      },
      data: {models: {}},
    },
    {mode: 'prod'},
  );

  expect(config.infrastructure.database).toEqual({
    engine: 'postgres',
    connection: {url: 'postgresql://localhost/db'},
    timeout: 10000,
  });

  // docs disabled in prod unless explicitly enabled
  expect(config.docs.openapi.enabled).toBe(false);
});

test('prod mode keeps an explicit database timeout', () => {
  const config = resolveConfig(
    {
      application: {name: 'rocket'},
      infrastructure: {
        database: {
          engine: 'sqlite',
          connection: {url: './data.db'},
          timeout: 5000,
        },
      },
      data: {models: {}},
    },
    {mode: 'prod'},
  );

  expect(config.infrastructure.database).toEqual({
    engine: 'sqlite',
    connection: {url: './data.db'},
    timeout: 5000,
  });
});

test('resolves migrations directory relative to configDir and defaults dangerouslyAllowDDL to false', () => {
  const config = resolveConfig(
    {
      application: {name: 'rocket'},
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://localhost/db'},
          migrations: {
            directory: './custom-migrations',
          },
        },
      },
      data: {models: {}},
    },
    {mode: 'prod', configDir: '/custom/config/dir'},
  );

  expect(config.infrastructure.database.migrations).toEqual({
    directory: '/custom/config/dir/custom-migrations',
    dangerouslyAllowDDL: false,
  });
});

test('resolves migrations directory relative to process.cwd() when configDir is omitted', () => {
  const config = resolveConfig(
    {
      application: {name: 'rocket'},
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://localhost/db'},
          migrations: {
            directory: './custom-migrations',
            dangerouslyAllowDDL: true,
          },
        },
      },
      data: {models: {}},
    },
    {mode: 'prod'},
  );

  expect(config.infrastructure.database.migrations).toEqual({
    directory: path.resolve(process.cwd(), './custom-migrations'),
    dangerouslyAllowDDL: true,
  });
});

test('preserves absolute migrations directory', () => {
  const absoluteDir = path.resolve('/var/migrations');
  const config = resolveConfig(
    {
      application: {name: 'rocket'},
      infrastructure: {
        database: {
          engine: 'sqlite',
          connection: {url: './data.db'},
          migrations: {
            directory: absoluteDir,
          },
        },
      },
      data: {models: {}},
    },
    {mode: 'dev', configDir: '/some/other/dir'},
  );

  expect(config.infrastructure.database.migrations?.directory).toBe(
    absoluteDir,
  );
  expect(config.infrastructure.database.migrations?.dangerouslyAllowDDL).toBe(
    false,
  );
});

test('overrides dangerouslyAllowDDL to true when passed in cliOptions', () => {
  const config = resolveConfig(
    {
      application: {name: 'rocket'},
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://localhost/db'},
          migrations: {
            directory: './custom-migrations',
            dangerouslyAllowDDL: false,
          },
        },
      },
      data: {models: {}},
    },
    {mode: 'prod', cliOptions: {dangerouslyAllowDdl: true}},
  );

  expect(config.infrastructure.database.migrations?.dangerouslyAllowDDL).toBe(
    true,
  );
});

test('dev mode keeps an explicit database engine and url', () => {
  const config = resolveConfig(
    devInput({
      infrastructure: {
        database: {
          engine: 'postgres',
          connection: {url: 'postgresql://localhost/db'},
        },
      },
    }),
    {mode: 'dev'},
  );

  expect(config.infrastructure.database).toEqual({
    engine: 'postgres',
    connection: {url: 'postgresql://localhost/db'},
    timeout: 10000,
  });
});

// ---------------------------------------------------------------------------
// Explicit falsy values are preserved
// ---------------------------------------------------------------------------

test('explicit false / 0 / "" values are never replaced', () => {
  const config = resolveConfig(
    devInput({
      application: {
        name: 'rocket',
        logLevel: 'warn',
        rateLimit: {enabled: false, max: 1, timeWindow: '5m'},
        magicVariables: {
          count: 0,
          flag: false,
          label: '',
        },
      },
      docs: {
        openapi: {enabled: false, path: '/api-docs'},
      },
      data: {
        models: {
          users: {
            timestamps: true,
            fields: {
              id: {type: 'integer', primaryKey: true, autoIncrement: true},
              active: {type: 'boolean', default: false},
              rank: {type: 'integer', default: 0},
              note: {type: 'string', default: ''},
            },
          },
        },
      },
    }),
    {mode: 'dev'},
  );

  expect(config.application.logLevel).toBe('warn');
  expect(config.application.rateLimit).toEqual({
    enabled: false,
    max: 1,
    timeWindow: '5m',
    rateLimitHealthAPI: false,
  });
  expect(config.application.magicVariables).toEqual({
    count: 0,
    flag: false,
    label: '',
  });
  expect(config.docs.openapi.enabled).toBe(false);
  expect(config.docs.openapi.path).toBe('/api-docs');
  expect(config.data.models.users.timestamps).toBe(true);

  const fields = config.data.models.users.fields;
  expect(fields.active.default).toBe(false);
  expect(fields.rank.default).toBe(0);
  expect(fields.note.default).toBe('');
});

// ---------------------------------------------------------------------------
// Absence sentinels
// ---------------------------------------------------------------------------

test('absence sentinels stay absent (undefined, not materialised)', () => {
  const config = resolveConfig(
    devInput({
      data: {
        models: {
          users: {
            fields: {
              id: {type: 'integer'},
              email: {type: 'string', values: ['a', 'b']},
            },
            indexes: {},
            relations: {
              author: {
                type: 'belongsTo',
                model: 'posts',
                localField: 'authorId',
                foreignField: 'id',
              },
            },
          },
        },
      },
      apis: {
        'model.v1.users.index.getAll': {},
      },
    }),
    {mode: 'dev'},
  );

  const users = config.data.models.users;
  expect(users.validation).toBeUndefined();
  expect('validation' in users).toBe(false);

  const field = users.fields.id as ResolvedModelFieldConfig;
  expect('default' in field).toBe(false);
  expect('values' in field).toBe(false);

  const emailField = users.fields.email;
  expect(emailField.values).toEqual(['a', 'b']);

  const relation = users.relations.author;
  expect('onDelete' in relation).toBe(false);
  expect('onUpdate' in relation).toBe(false);

  // docs metadata is never materialised
  expect('description' in config.docs.openapi.info).toBe(false);
  expect('termsOfService' in config.docs.openapi.info).toBe(false);
  expect('contact' in config.docs.openapi.info).toBe(false);
  expect('license' in config.docs.openapi.info).toBe(false);

  // apis entries stay sparse; only user-provided keys exist
  const apiEntry = config.apis['model.v1.users.index.getAll'];
  expect('enabled' in apiEntry).toBe(false);
  expect('tags' in apiEntry).toBe(false);
  expect('supportedQueries' in apiEntry).toBe(false);
  expect('supportedAggregations' in apiEntry).toBe(false);
  expect('authorization' in apiEntry).toBe(false);
  expect('bypassSecret' in apiEntry).toBe(false);
});

// ---------------------------------------------------------------------------
// Field / index / model templates
// ---------------------------------------------------------------------------

test('fields are dense with template defaults', () => {
  const field = resolveModelField({type: 'string'});

  expect(field).toEqual({
    type: 'string',
    primaryKey: false,
    autoIncrement: false,
    nullable: true,
    unique: false,
    secret: false,
    apis: [],
    query: [],
    aggregations: [],
  });
});

test('field overrides and optional values are preserved', () => {
  const field = resolveModelField({
    type: 'enum',
    primaryKey: true,
    autoIncrement: true,
    nullable: false,
    unique: true,
    secret: true,
    apis: ['index', 'edit'],
    query: ['eq', 'in'],
    aggregations: ['count'],
    values: ['x', 'y'],
    default: 'x',
  } as ResolvedModelFieldConfig);

  expect(field.primaryKey).toBe(true);
  expect(field.autoIncrement).toBe(true);
  expect(field.nullable).toBe(false);
  expect(field.unique).toBe(true);
  expect(field.secret).toBe(true);
  expect(field.apis).toEqual(['index', 'edit']);
  expect(field.query).toEqual(['eq', 'in']);
  expect(field.aggregations).toEqual(['count']);
  expect(field.values).toEqual(['x', 'y']);
  expect(field.default).toBe('x');
});

test('default: null is preserved (key-visible absence vs null)', () => {
  const field = resolveModelField({type: 'string', default: null});
  expect('default' in field).toBe(true);
  expect(field.default).toBeNull();
});

test('field with present-but-falsy values resolves to an empty list', () => {
  const field = resolveModelField({
    type: 'string',
    values: undefined as unknown as string[],
  });
  expect('values' in field).toBe(true);
  expect(field.values).toEqual([]);
});

test('model and data tolerate missing fields at runtime', () => {
  const config = resolveConfig(
    {
      data: {
        models: {users: {}} as unknown as Record<string, ModelConfigInput>,
      },
    } as AppConfigInput,
    {mode: 'dev'},
  );

  expect(config.data.models.users.fields).toEqual({});
  expect(config.data.models.users.indexes).toEqual({});
  expect(config.data.models.users.relations).toEqual({});
  expect(config.data.models.users.timestamps).toBe(false);
});

test('resolver tolerates an absent data section', () => {
  const config = resolveConfig({} as AppConfigInput, {mode: 'dev'});

  expect(config.data).toEqual({models: {}});
});

test('models get dense templates for missing sections', () => {
  const config = resolveConfig(
    devInput({
      data: {models: {users: simpleUserModel}},
    }),
    {mode: 'dev'},
  );

  const users = config.data.models.users;
  expect(users.timestamps).toBe(false);
  expect(users.indexes).toEqual({});
  expect(users.relations).toEqual({});
});

test('index unique defaults to false', () => {
  const config = resolveConfig(
    devInput({
      data: {
        models: {
          users: {
            fields: simpleUserModel.fields,
            indexes: {
              email_idx: {fields: ['email']},
            },
          },
        },
      },
    }),
    {mode: 'dev'},
  );

  expect(config.data.models.users.indexes.email_idx).toEqual({
    fields: ['email'],
    unique: false,
  });
});

test('explicit index unique and relations are preserved', () => {
  const config = resolveConfig(
    devInput({
      data: {
        models: {
          users: {
            fields: simpleUserModel.fields,
            indexes: {
              email_idx: {fields: ['email'], unique: true},
            },
            relations: {
              author: {
                type: 'belongsTo',
                model: 'posts',
                localField: 'authorId',
                foreignField: 'id',
                onDelete: 'cascade',
                onUpdate: 'set null',
              },
            },
          },
        },
      },
    }),
    {mode: 'dev'},
  );

  expect(config.data.models.users.indexes.email_idx).toEqual({
    fields: ['email'],
    unique: true,
  });

  expect(config.data.models.users.relations.author).toEqual({
    type: 'belongsTo',
    model: 'posts',
    localField: 'authorId',
    foreignField: 'id',
    onDelete: 'cascade',
    onUpdate: 'set null',
  });
});

test('model validation stays optional but passes through when present', () => {
  const validation = {type: 'object', required: ['email']};
  const config = resolveConfig(
    devInput({
      data: {
        models: {
          users: {...simpleUserModel, validation},
        },
      },
    }),
    {mode: 'dev'},
  );

  expect(config.data.models.users.validation).toEqual(validation);
});

// ---------------------------------------------------------------------------
// Nested application / rateLimit / docs fills
// ---------------------------------------------------------------------------

test('partial rateLimit is filled with defaults', () => {
  const config = resolveConfig(
    devInput({
      application: {name: 'rocket', rateLimit: {enabled: true}},
    }),
    {mode: 'dev'},
  );

  expect(config.application.rateLimit).toEqual({
    enabled: true,
    max: 100,
    timeWindow: '1m',
    rateLimitHealthAPI: false,
  });
});

test('full rateLimit and magicVariables pass through', () => {
  const magicVariables = {defaultOrg: 'rocket-oss'};
  const config = resolveConfig(
    devInput({
      application: {
        name: 'rocket',
        rateLimit: {
          enabled: true,
          max: 1000,
          timeWindow: '15m',
          rateLimitHealthAPI: true,
        },
        dangerouslyOverrideDefaultVariant: 'v2',
        magicVariables,
      },
    }),
    {mode: 'dev'},
  );

  expect(config.application.rateLimit).toEqual({
    enabled: true,
    max: 1000,
    timeWindow: '15m',
    rateLimitHealthAPI: true,
  });
  expect(config.application.dangerouslyOverrideDefaultVariant).toBe('v2');
  expect(config.application.magicVariables).toEqual(magicVariables);
});

test('healthCheck resolution uses defaults or accepts overrides', () => {
  const custom = resolveConfig(
    devInput({
      application: {
        name: 'rocket',
        healthCheck: {
          enabled: false,
          path: '/custom-health',
        },
      },
    }),
    {mode: 'dev'},
  );

  expect(custom.application.healthCheck).toEqual({
    enabled: false,
    path: '/custom-health',
  });
});

test('partial docs fill from mode + application name', () => {
  const config = resolveConfig(
    devInput({
      docs: {
        openapi: {
          path: '/api/docs',
          info: {
            title: 'My API',
            description: 'Description',
          },
        },
      },
    }),
    {mode: 'dev'},
  );

  expect(config.docs.openapi.enabled).toBe(true);
  expect(config.docs.openapi.path).toBe('/api/docs');
  expect(config.docs.openapi.info).toEqual({
    title: 'My API',
    description: 'Description',
    version: '1.0.0',
  });
});

test('docs metadata passes through when provided', () => {
  const config = resolveConfig(
    devInput({
      docs: {
        openapi: {
          enabled: true,
          info: {
            title: 'My API',
            version: 'v2',
            termsOfService: 'https://example.com/terms',
            contact: {name: 'John', email: 'a@b.com'},
            license: {name: 'MIT'},
          },
        },
      },
    }),
    {mode: 'dev'},
  );

  expect(config.docs.openapi.info.termsOfService).toBe(
    'https://example.com/terms',
  );
  expect(config.docs.openapi.info.contact).toEqual({
    name: 'John',
    email: 'a@b.com',
  });
  expect(config.docs.openapi.info.license).toEqual({name: 'MIT'});
});

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

test('absent cache resolves to memory engine', () => {
  const config = resolveConfig(devInput(), {mode: 'dev'});
  expect(config.infrastructure.cache).toEqual({engine: 'memory'});
});

test('redis cache gets a default timeout (no 5000 drift)', () => {
  const config = resolveConfig(
    devInput({
      infrastructure: {
        database: {engine: 'sqlite', connection: {url: './data.db'}},
        cache: {engine: 'redis', connection: {url: 'redis://localhost'}},
      },
    }),
    {mode: 'dev'},
  );

  expect(config.infrastructure.cache).toEqual({
    engine: 'redis',
    connection: {url: 'redis://localhost'},
    timeout: 10000,
  });
});

test('redis cache timeout is preserved and memory cache is normalized', () => {
  const config = resolveConfig(
    devInput({
      infrastructure: {
        database: {engine: 'sqlite', connection: {url: './data.db'}},
        cache: {
          engine: 'redis',
          connection: {url: 'redis://localhost'},
          timeout: 2000,
        },
      },
    }),
    {mode: 'dev'},
  );
  expect(config.infrastructure.cache).toEqual({
    engine: 'redis',
    connection: {url: 'redis://localhost'},
    timeout: 2000,
  });

  const memoryConfig = resolveConfig(
    devInput({
      infrastructure: {
        database: {engine: 'sqlite', connection: {url: './data.db'}},
        cache: {engine: 'memory'} as never,
      },
    }),
    {mode: 'dev'},
  );
  expect(memoryConfig.infrastructure.cache).toEqual({engine: 'memory'});
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test('authentication defaults to disabled when absent', () => {
  const config = resolveConfig(devInput(), {mode: 'dev'});
  expect(config.authentication).toEqual({enabled: false});
});

test('explicitly disabled authentication never materialises a provider', () => {
  const config = resolveConfig(
    devInput({
      authentication: {enabled: false, provider: upAuth.provider as never},
    }),
    {mode: 'dev'},
  );

  expect(config.authentication).toEqual({enabled: false});
  expect('provider' in config.authentication).toBe(false);
});

test('up-auth is normalized with tokenExpiration and mfaRequired', () => {
  const config = resolveConfig(
    devInput({
      authentication: upAuth as unknown as AppConfigInput['authentication'],
    }),
    {mode: 'dev'},
  );

  const auth = config.authentication as ResolvedAuthenticationConfig;
  expect(auth.enabled).toBe(true);
  if (!auth.enabled) throw new Error('authentication should be enabled');

  expect(auth.provider.type).toBe('up-auth');
  if (auth.provider.type !== 'up-auth') throw new Error('expected up-auth');
  expect(auth.provider.config.jwtSecret).toBe(
    'a-very-long-secret-used-for-testing-purposes',
  );
  expect(auth.provider.config.tokenExpiration).toBe('1d');
  expect(auth.provider.config.mfaRequired).toBe(false);
  expect(auth.provider.config.userModel).toEqual(
    upAuth.provider.config.userModel,
  );
});

test('up-auth explicit tokenExpiration and mfaRequired are preserved', () => {
  const config = resolveConfig(
    devInput({
      authentication: {
        enabled: true,
        provider: {
          type: 'up-auth',
          config: {
            ...upAuth.provider.config,
            tokenExpiration: '8h',
            mfaRequired: true,
          },
        },
      },
    }),
    {mode: 'dev'},
  );

  const provider = (
    config.authentication as ResolvedAuthenticationConfig & {
      provider: {config: {tokenExpiration: string; mfaRequired: boolean}};
    }
  ).provider;
  expect(provider.config.tokenExpiration).toBe('8h');
  expect(provider.config.mfaRequired).toBe(true);
});

test('enabled authentication with an unknown provider type resolves to disabled', () => {
  const config = resolveConfig(
    devInput({
      authentication: {
        enabled: true,
        provider: {
          type: 'unknown',
          config: {},
        },
      } as unknown as AppConfigInput['authentication'],
    }),
    {mode: 'dev'},
  );

  expect(config.authentication).toEqual({enabled: false});
});

test('api-key authentication passes through', () => {
  const config = resolveConfig(
    devInput({
      authentication: {
        enabled: true,
        provider: {type: 'api-key', config: {key: 'test-key'}},
      },
    }),
    {mode: 'dev'},
  );

  const auth = config.authentication as ResolvedAuthenticationConfig;
  expect(auth.enabled).toBe(true);
  if (!('provider' in auth)) throw new Error('provider expected');
  expect(auth.provider).toEqual({type: 'api-key', config: {key: 'test-key'}});
});

test('enabled authentication without a provider resolves to disabled', () => {
  const config = resolveConfig(
    devInput({
      authentication: {
        enabled: true,
      } as unknown as AppConfigInput['authentication'],
    }),
    {mode: 'dev'},
  );

  expect(config.authentication).toEqual({enabled: false});
});

// ---------------------------------------------------------------------------
// Webhook template
// ---------------------------------------------------------------------------

test('webhook triggers default to false and data is preserved', () => {
  const webhook = resolveWebhook({url: 'https://example.com'} as WebhookConfig);
  expect(webhook).toEqual({
    url: 'https://example.com',
    data: [],
    triggerOnRequest: false,
    triggerOnResponse: false,
  });

  const full = resolveWebhook({
    url: 'https://example.com/hook',
    data: ['body', 'response'],
    triggerOnRequest: true,
    triggerOnResponse: true,
  } as WebhookConfig);
  expect(full).toEqual({
    url: 'https://example.com/hook',
    data: ['body', 'response'],
    triggerOnRequest: true,
    triggerOnResponse: true,
  });
});

// ---------------------------------------------------------------------------
// Pass-through sections
// ---------------------------------------------------------------------------

test('customEndpoints, integrations and apiVariants pass through', () => {
  const customEndpoint = {
    method: 'GET' as const,
    path: '/ping',
    description: 'Ping',
    handler: {type: 'sql' as const, sql: 'SELECT * FROM users'},
  };
  const apiVariants = {'model.v1.users.index.getAll': {variants: ['admin']}};

  const config = resolveConfig(
    devInput({
      customEndpoints: {ping: customEndpoint},
      integrations: {email: {provider: 'dummy'}},
      apiVariants,
    }),
    {mode: 'dev'},
  );

  expect(config.customEndpoints.ping).toEqual(customEndpoint);
  expect(config.integrations).toEqual({email: {provider: 'dummy'}});
  expect(config.apiVariants).toEqual(apiVariants);

  // absent keys resolve to empty maps
  const emptyConfig = resolveConfig(devInput(), {mode: 'dev'});
  expect(emptyConfig.customEndpoints).toEqual({});
  expect(emptyConfig.integrations).toEqual({});
  expect(emptyConfig.apiVariants).toEqual({});
  expect(emptyConfig.rbac).toEqual({enabled: false});
});

test('rbac defaults to disabled when absent or explicitly disabled', () => {
  expect(resolveConfig(devInput(), {mode: 'dev'}).rbac).toEqual({
    enabled: false,
  });
  expect(
    resolveConfig(devInput({rbac: {enabled: false}}), {mode: 'dev'}).rbac,
  ).toEqual({enabled: false});
});

test('rbac resolves densely when enabled', () => {
  const rbacInput: AppConfigInput['rbac'] = {
    enabled: true,
    modelName: 'users',
    roleField: 'role',
    defaultRole: 'viewer',
    roles: {
      admin: {description: 'Full access', includes: ['*']},
      viewer: {description: 'Read only'},
    },
  };

  const config = resolveConfig(devInput({rbac: rbacInput}), {mode: 'dev'});
  expect(config.rbac).toEqual(rbacInput);
  expect(config.rbac).not.toBe(rbacInput);
  if (!config.rbac.enabled) throw new Error('expected rbac to be enabled');
  expect(config.rbac.roles).not.toBe(rbacInput.roles);
});

test('rbac clones when partial enabled config is provided', () => {
  const config = resolveConfig(devInput({rbac: {enabled: true}}), {
    mode: 'dev',
  });
  expect(config.rbac).toEqual({
    enabled: true,
  });
});

test('apis values are cloned, other sections clone as well', () => {
  const apis: AppConfigInput['apis'] = {
    'model.v1.users.index.getAll': {
      enabled: true,
      tags: ['Users'],
      authorization: false,
    },
  };

  const config = resolveConfig(devInput({apis}), {mode: 'dev'});

  expect(config.apis).toEqual(apis);
  expect(config.apis).not.toBe(apis);
  expect(config.apis['model.v1.users.index.getAll'].tags).not.toBe(
    apis!['model.v1.users.index.getAll'].tags,
  );
});

// ---------------------------------------------------------------------------
// Purity / cloning
// ---------------------------------------------------------------------------

test('resolving never mutates the raw input', () => {
  const raw: AppConfigInput = {
    application: {
      name: 'rocket',
      rateLimit: {enabled: false},
      magicVariables: {org: 'a'},
    },
    data: {
      models: {
        users: {
          fields: simpleUserModel.fields,
          indexes: {email_idx: {fields: ['email']}},
          relations: {
            author: {
              type: 'belongsTo',
              model: 'posts',
              localField: 'authorId',
              foreignField: 'id',
            },
          },
        },
      },
    },
  };

  const config = resolveConfig(raw, {mode: 'dev'});

  // mutate the resolved config
  config.application.rateLimit.max = 5000;
  config.application.magicVariables.org = 'mutated';
  config.infrastructure.database.timeout = 1;
  config.data.models.users.fields.id.apis.push('delete');
  config.data.models.users.indexes.email_idx.fields.push('extra');

  // the raw input is untouched
  expect(raw.application!.rateLimit).toEqual({enabled: false});
  expect(raw.application!.magicVariables).toEqual({org: 'a'});
  expect(config.application.dangerouslyOverrideDefaultVariant).toBe('v1');
  expect(raw.data!.models!.users.indexes!.email_idx.fields).toEqual(['email']);
});

test('separate resolutions never share references', () => {
  const input = devInput({
    infrastructure: {
      database: {engine: 'sqlite', connection: {url: './data.db'}},
    },
    data: {
      models: {
        users: {
          fields: simpleUserModel.fields,
          indexes: {email_idx: {fields: ['email']}},
        },
      },
    },
    apis: {
      'model.v1.users.index.getAll': {tags: ['Users']},
    },
  });

  const configA = resolveConfig(input, {mode: 'dev'});
  const configB = resolveConfig(input, {mode: 'prod'});

  expect(configA.data.models.users.fields.id.apis).not.toBe(
    configB.data.models.users.fields.id.apis,
  );
  expect(configA.data.models.users.indexes.email_idx.fields).not.toBe(
    configB.data.models.users.indexes.email_idx.fields,
  );
  expect(configA.apis['model.v1.users.index.getAll'].tags).not.toBe(
    configB.apis['model.v1.users.index.getAll'].tags,
  );
  expect(configA.application.rateLimit).not.toBe(configB.application.rateLimit);
  expect(configA.infrastructure.database).not.toBe(
    configB.infrastructure.database,
  );
});

test('resolving the same input twice in dev yields identical values', () => {
  const input = devInput({
    data: {models: {users: simpleUserModel}},
  });

  const configA = resolveConfig(input, {mode: 'dev'});
  const configB = resolveConfig(input, {mode: 'dev'});

  expect(configA).toEqual(configB);
});
