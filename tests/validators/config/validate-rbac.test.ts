import {describe, expect, it} from 'vitest';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';

import {
  AppConfig,
  AppConfigInput,
  DatabaseConfig,
  ModelConfig,
  RbacConfig,
  ResolvedAppConfig,
  RoleConfig,
} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';
import validateRbacConstraints from '@/validators/config/validate-rbac';

const getDefaultDatabaseConfig = (): DatabaseConfig => ({
  engine: 'sqlite',
  connection: {
    url: './test.db',
  },
});

const getDefaultModelConfig = (): Record<string, ModelConfig> => ({
  users: {
    fields: {
      id: {type: 'integer', primaryKey: true, unique: true, nullable: false},
      email: {type: 'string', unique: true, nullable: false},
      password: {type: 'string', secret: true, nullable: false},
      role: {type: 'string', nullable: false},
      status: {
        type: 'enum',
        values: ['admin', 'editor:senior', 'editor:junior', 'viewer'],
        nullable: false,
      },
      age: {type: 'integer', nullable: true},
    },
  },
  posts: {
    fields: {
      id: {type: 'integer', primaryKey: true, nullable: false},
      title: {type: 'string', nullable: false},
    },
  },
});

const createBaseConfig = (): AppConfig => ({
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
        version: '1.0.0',
      },
    },
  },
  infrastructure: {database: getDefaultDatabaseConfig()},
  data: {models: getDefaultModelConfig()},
  authentication: {
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
        jwtSecret: 'a-super-secret-key-that-is-at-least-32-chars-long',
      },
    },
  },
});

const createValidRbacConfig = (): RbacConfig & {
  roles: Record<string, RoleConfig>;
} => ({
  enabled: true,
  modelName: 'users',
  roleField: 'role',
  defaultRole: 'viewer',
  roles: {
    admin: {
      description: 'Super administrator',
      includes: ['*'],
    },
    lead_editor: {
      description: 'Lead Editor',
      includes: ['editor:*'],
    },
    'editor:senior': {
      description: 'Senior Editor',
      includes: ['editor:junior', 'viewer'],
    },
    'editor:junior': {
      description: 'Junior Editor',
      includes: ['viewer'],
    },
    viewer: {
      description: 'Viewer',
    },
  },
});

describe('RBAC Schema Validation (AJV)', () => {
  it('passes schema validation for valid RBAC configuration', () => {
    const config = createBaseConfig();
    config.rbac = createValidRbacConfig();

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('passes schema validation when RBAC is disabled', () => {
    const config = createBaseConfig();
    config.rbac = {enabled: false};

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('passes schema validation when RBAC is disabled with optional fields present', () => {
    const config = createBaseConfig();
    config.rbac = {
      enabled: false,
      modelName: 'users',
      roleField: 'role',
      defaultRole: 'viewer',
      roles: {
        viewer: {description: 'Viewer'},
      },
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('fails when rbac is not an object or missing required enabled property', () => {
    const config = createBaseConfig();
    (config as unknown as Record<string, unknown>).rbac = 'invalid';

    expect(() => validateConfig(config)).toThrow(
      '/rbac must match exactly one schema in oneOf',
    );
  });

  it('fails when enabled: true but required fields are missing', () => {
    const config = createBaseConfig();
    (config as unknown as Record<string, unknown>).rbac = {enabled: true};

    expect(() => validateConfig(config)).toThrow(
      "must have required property 'modelName'",
    );
  });

  it('fails when defaultRole is missing from enabled rbac config', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    delete rbac.defaultRole;
    config.rbac = rbac;

    expect(() => validateConfig(config)).toThrow(
      "must have required property 'defaultRole'",
    );
  });

  it('fails when modelName is invalid entity name', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.modelName = '123_invalid';
    config.rbac = rbac;

    expect(() => validateConfig(config)).toThrow(
      'Entity name "123_invalid" is not valid',
    );
  });

  it('fails when roleField is invalid entity name', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.roleField = 'invalid-role-field!';
    config.rbac = rbac;

    expect(() => validateConfig(config)).toThrow(
      'Entity name "invalid-role-field!" is not valid',
    );
  });

  it('fails when roles dictionary is empty', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.roles = {} as Record<string, RoleConfig>;
    config.rbac = rbac;

    expect(() => validateConfig(config)).toThrow(
      '/rbac/roles must NOT have fewer than 1 properties',
    );
  });

  it('fails when a role name in roles contains invalid characters or wildcard', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    (rbac.roles as Record<string, unknown>)['editor:*'] = {
      description: 'Invalid role key with wildcard',
    };
    config.rbac = rbac;

    expect(() => validateConfig(config)).toThrow(
      'must NOT have additional properties',
    );
  });

  it('fails when a role definition contains extra properties', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    (rbac.roles.viewer as Record<string, unknown>).extraProp = 'disallowed';
    config.rbac = rbac;

    expect(() => validateConfig(config)).toThrow(
      '/rbac/roles/viewer must NOT have additional properties',
    );
  });

  it('fails when includes is not an array of strings', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    (rbac.roles.admin as Record<string, unknown>).includes = 'not-an-array';
    config.rbac = rbac;

    expect(() => validateConfig(config)).toThrow(
      '/rbac/roles/admin/includes must be array',
    );
  });

  it('fails when apis[key].roles is not an array', () => {
    const config = createBaseConfig();
    config.rbac = createValidRbacConfig();
    config.apis = {
      'model.test.posts.unknown.insert': {
        authorization: true,
        roles: 'admin' as unknown as string[],
      },
    };

    expect(() => validateConfig(config)).toThrow(
      '/apis/model.test.posts.unknown.insert/roles must be array',
    );
  });

  it('fails when apis[key].roles is empty array', () => {
    const config = createBaseConfig();
    config.rbac = createValidRbacConfig();
    config.apis = {
      'model.test.posts.unknown.insert': {
        authorization: true,
        roles: [],
      },
    };

    expect(() => validateConfig(config)).toThrow(
      '/apis/model.test.posts.unknown.insert/roles must NOT have fewer than 1 items',
    );
  });

  it('fails when apis[key].roles contains duplicates', () => {
    const config = createBaseConfig();
    config.rbac = createValidRbacConfig();
    config.apis = {
      'model.test.posts.unknown.insert': {
        authorization: true,
        roles: ['admin', 'admin'],
      },
    };

    expect(() => validateConfig(config)).toThrow(
      '/apis/model.test.posts.unknown.insert/roles must NOT have duplicate items',
    );
  });
});

describe('Static RBAC Constraint Validation (validateRbacConstraints)', () => {
  it('returns no errors when RBAC is omitted or disabled', () => {
    const config = createBaseConfig();
    delete config.rbac;
    expect(validateRbacConstraints(config)).toEqual([]);

    config.rbac = {enabled: false};
    expect(validateRbacConstraints(config)).toEqual([]);
  });

  it('rejects roles configured under apis when RBAC is disabled', () => {
    const config = createBaseConfig();
    config.rbac = {enabled: false};
    config.apis = {
      'model.test.posts.unknown.insert': {
        authorization: true,
        roles: ['admin'],
      },
    };

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      'apis/model.test.posts.unknown.insert/roles: roles cannot be configured when rbac is not enabled',
    );
  });

  it('rejects static api-key authentication when RBAC is enabled', () => {
    const config = createBaseConfig();
    config.authentication = {
      enabled: true,
      provider: {
        type: 'api-key',
        config: {
          key: 'some-api-key',
        },
      },
    };
    config.rbac = createValidRbacConfig();

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      "/rbac: static 'api-key' authentication cannot be used when rbac is enabled",
    );
  });

  it('rejects disabled authentication when RBAC is enabled', () => {
    const config = createBaseConfig();
    config.authentication = {
      enabled: false,
    };
    config.rbac = createValidRbacConfig();

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac: authentication must be enabled when rbac is enabled',
    );
  });

  it('rejects missing authentication section when RBAC is enabled', () => {
    const config = createBaseConfig();
    delete config.authentication;
    config.rbac = createValidRbacConfig();

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac: authentication must be enabled when rbac is enabled',
    );
  });

  it('rejects non-existent rbac.modelName', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.modelName = 'non_existent_model';
    config.rbac = rbac;

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac/modelName: model "non_existent_model" does not exist in data.models',
    );
  });

  it('rejects non-existent rbac.roleField in target model', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.roleField = 'non_existent_field';
    config.rbac = rbac;

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac/roleField: field "non_existent_field" does not exist in model "users"',
    );
  });

  it('rejects roleField of unsupported type (e.g. integer)', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.roleField = 'age';
    config.rbac = rbac;

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac/roleField: field "age" in model "users" must be of type string or enum',
    );
  });

  it('rejects enum roleField when enum values do not match declared roles', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.roleField = 'status'; // status has ['admin', 'editor:senior', 'editor:junior', 'viewer'] but lacks 'lead_editor'
    config.rbac = rbac;

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac/roleField: enum values for field "status" must match declared roles in rbac.roles exactly',
    );
  });

  it('accepts enum roleField when enum values match declared roles exactly', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.roleField = 'status';
    config.data.models.users.fields.status.values = [
      'admin',
      'lead_editor',
      'editor:senior',
      'editor:junior',
      'viewer',
    ];
    config.rbac = rbac;

    const errors = validateRbacConstraints(config);
    expect(errors).toEqual([]);
  });

  it('rejects undefined defaultRole', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.defaultRole = 'unknown_role';
    config.rbac = rbac;

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac/defaultRole: defaultRole "unknown_role" is not defined in rbac.roles',
    );
  });

  it('rejects role includes referencing non-existent role', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.roles.viewer = {
      description: 'Viewer',
      includes: ['ghost_role'],
    };
    config.rbac = rbac;

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac/roles/viewer/includes/0: role "ghost_role" does not exist in rbac.roles',
    );
  });

  it('rejects role includes with wildcard matching no declared roles', () => {
    const config = createBaseConfig();
    const rbac = createValidRbacConfig();
    rbac.roles.viewer = {
      description: 'Viewer',
      includes: ['billing:*'],
    };
    config.rbac = rbac;

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      '/rbac/roles/viewer/includes/0: wildcard pattern "billing:*" does not match any declared role in rbac.roles',
    );
  });

  it('rejects apis[key].roles when endpoint has authorization: false or omitted', () => {
    const config = createBaseConfig();
    config.rbac = createValidRbacConfig();
    config.apis = {
      'model.test.posts.unknown.insert': {
        authorization: false,
        roles: ['admin'],
      },
    };

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      'apis/model.test.posts.unknown.insert/roles: endpoint with roles must have authorization enabled',
    );
  });

  it('rejects apis[key].roles with undeclared role', () => {
    const config = createBaseConfig();
    config.rbac = createValidRbacConfig();
    config.apis = {
      'model.test.posts.unknown.insert': {
        authorization: true,
        roles: ['unknown_role'],
      },
    };

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      'apis/model.test.posts.unknown.insert/roles/0: role "unknown_role" does not exist in rbac.roles',
    );
  });

  it('rejects apis[key].roles with wildcard matching no declared roles', () => {
    const config = createBaseConfig();
    config.rbac = createValidRbacConfig();
    config.apis = {
      'model.test.posts.unknown.insert': {
        authorization: true,
        roles: ['billing:*'],
      },
    };

    const errors = validateRbacConstraints(config);
    expect(errors).toContain(
      'apis/model.test.posts.unknown.insert/roles/0: wildcard pattern "billing:*" does not match any declared role in rbac.roles',
    );
  });

  it('accepts apis[key].roles with universal wildcard and valid prefix wildcard', () => {
    const config = createBaseConfig();
    config.rbac = createValidRbacConfig();
    config.apis = {
      'model.test.posts.unknown.insert': {
        authorization: true,
        roles: ['*'],
      },
      'model.test.posts.unknown.delete': {
        authorization: true,
        roles: ['editor:*', 'admin'],
      },
    };

    const errors = validateRbacConstraints(config);
    expect(errors).toEqual([]);
  });

  it('validates resolved configuration via resolveAndValidateConfig', () => {
    const raw: AppConfigInput = {
      application: {name: 'Full RBAC App'},
      infrastructure: {database: getDefaultDatabaseConfig()},
      data: {models: getDefaultModelConfig()},
      authentication: {
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
            jwtSecret: 'a-super-secret-key-that-is-at-least-32-chars-long',
          },
        },
      },
      rbac: createValidRbacConfig(),
      apis: {
        'model.v1.posts.unknown.insert': {
          authorization: true,
          roles: ['editor:*'],
        },
      },
    };

    const resolved: ResolvedAppConfig = resolveAndValidateConfig(raw, 'dev');
    expect(resolved.rbac.enabled).toBe(true);
    if (!resolved.rbac.enabled) throw new Error('expected rbac to be enabled');
    expect(resolved.rbac.modelName).toBe('users');
    expect(resolved.apis['model.v1.posts.unknown.insert'].roles).toEqual([
      'editor:*',
    ]);
  });

  it('handles edge case inputs with missing data/models or missing roles gracefully', () => {
    // missing data section
    const configNoData = createBaseConfig();
    configNoData.rbac = createValidRbacConfig();
    delete (configNoData as unknown as Record<string, unknown>).data;
    expect(validateRbacConstraints(configNoData)).toContain(
      '/rbac/modelName: model "users" does not exist in data.models',
    );

    // missing roleField
    const configNoRoleField = createBaseConfig();
    configNoRoleField.rbac = {
      enabled: true,
      modelName: 'users',
    };
    expect(validateRbacConstraints(configNoRoleField)).toContain(
      '/rbac/roleField: field "undefined" does not exist in model "users"',
    );

    // missing roles dictionary
    const configNoRoles = createBaseConfig();
    configNoRoles.rbac = {
      enabled: true,
      modelName: 'users',
      roleField: 'role',
      defaultRole: 'viewer',
    };
    expect(validateRbacConstraints(configNoRoles)).toContain(
      '/rbac/defaultRole: defaultRole "viewer" is not defined in rbac.roles',
    );

    // missing defaultRole
    const configNoDefaultRole = createBaseConfig();
    configNoDefaultRole.rbac = {
      enabled: true,
      modelName: 'users',
      roleField: 'role',
    };
    expect(validateRbacConstraints(configNoDefaultRole)).toContain(
      '/rbac/defaultRole: defaultRole "undefined" is not defined in rbac.roles',
    );

    // enum field without values
    const configEnumNoValues = createBaseConfig();
    configEnumNoValues.data.models.users.fields.role = {
      type: 'enum',
    } as unknown as ModelConfig['fields']['role'];
    configEnumNoValues.rbac = createValidRbacConfig();
    expect(validateRbacConstraints(configEnumNoValues)).toContain(
      '/rbac/roleField: enum values for field "role" must match declared roles in rbac.roles exactly',
    );

    // apis entry that is undefined or has no roles
    const configApiNoRoles = createBaseConfig();
    configApiNoRoles.rbac = createValidRbacConfig();
    configApiNoRoles.apis = {
      'model.v1.posts.unknown.insert': undefined as unknown as {
        authorization?: boolean;
      },
      'model.v1.posts.unknown.getAll': {
        authorization: true,
      },
    };
    expect(validateRbacConstraints(configApiNoRoles)).toEqual([]);
  });
});
