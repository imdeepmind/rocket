import * as fs from 'fs';
import * as path from 'path';

import {afterEach, expect, test, vi} from 'vitest';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {resolveConfig} from '@/lib/config/resolve';

import {AppConfigInput} from '@/interfaces/config';

const FULL_CONFIG_FIXTURE_PATH = path.resolve(
  'tests/fixtures/config/full.json',
);
const GOLDEN_SNAPSHOT_PATH = path.resolve(
  'tests/fixtures/config/__goldens__/full.resolved.json',
);

afterEach(() => {
  vi.unstubAllEnvs();
});

test('full config fixture resolves to the checked-in golden snapshot', () => {
  const raw = JSON.parse(
    fs.readFileSync(FULL_CONFIG_FIXTURE_PATH, 'utf-8'),
  ) as AppConfigInput;

  const resolved = resolveConfig(raw, {mode: 'dev'});

  const golden = JSON.parse(fs.readFileSync(GOLDEN_SNAPSHOT_PATH, 'utf-8'));

  expect(resolved).toEqual(golden);
});

test('barebone config resolves and validates in dev', () => {
  const raw: AppConfigInput = {
    application: {name: 'Barebone API'},
    data: {
      models: {
        notes: {
          fields: {
            id: {type: 'integer', primaryKey: true, autoIncrement: true},
            title: {
              type: 'string',
              nullable: false,
              apis: ['search', 'edit'],
              query: ['eq', 'sort'],
            },
            body: {type: 'text', nullable: true},
            status: {
              type: 'enum',
              values: ['draft', 'published'],
              nullable: false,
              apis: ['edit', 'delete'],
              query: ['eq', 'in'],
            },
          },
        },
      },
    },
  };

  const resolved = resolveAndValidateConfig(raw, 'dev');

  expect(resolved.docs.openapi.enabled).toBe(true);
  expect(resolved.infrastructure.database.engine).toBe('sqlite');
  expect(resolved.infrastructure.cache).toEqual({engine: 'memory'});
  expect(resolved.authentication).toEqual({enabled: false});
  expect(Object.keys(resolved.data.models)).toEqual(['notes']);
  expect(resolved.data.models.notes.fields.title.apis).toEqual([
    'search',
    'edit',
  ]);
  expect(resolved.data.models.notes.fields.status.query).toEqual(['eq', 'in']);
});

test('passes dangerouslyAllowDDL through to resolved config', () => {
  const raw: AppConfigInput = {
    application: {name: 'Pipeline Test'},
    infrastructure: {
      database: {
        engine: 'postgres',
        connection: {url: 'postgresql://localhost/db'},
        migrations: {
          directory: './migrations',
          dangerouslyAllowDDL: false,
        },
      },
    },
    data: {
      models: {
        item: {
          fields: {
            name: {type: 'string'},
          },
        },
      },
    },
  };

  const resolved = resolveAndValidateConfig(raw, 'prod', '/app', {
    dangerouslyAllowDdl: true,
  });

  expect(resolved.infrastructure.database.migrations?.dangerouslyAllowDDL).toBe(
    true,
  );
});

test('rejects empty string dangerouslyOverrideDefaultVariant in pipeline validation', () => {
  const raw: AppConfigInput = {
    application: {
      name: 'Test App',
      dangerouslyOverrideDefaultVariant: '',
    },
    data: {
      models: {
        notes: {
          fields: {
            id: {type: 'integer', primaryKey: true, nullable: false},
          },
        },
      },
    },
  };

  expect(() => resolveAndValidateConfig(raw, 'dev')).toThrow(
    '/application/dangerouslyOverrideDefaultVariant must NOT have fewer than 1 characters',
  );
});

test('resolves the SendGrid apiKey from the environment', () => {
  vi.stubEnv('SENDGRID_API_KEY', 'SG.resolved-from-env');

  const raw: AppConfigInput = {
    application: {name: 'SendGrid Pipeline Test'},
    data: {
      models: {
        notes: {
          fields: {
            id: {type: 'integer', primaryKey: true, nullable: false},
          },
        },
      },
    },
    integrations: {
      email: {
        provider: 'sendgrid',
        config: {
          apiKey: 'env:SENDGRID_API_KEY',
          fromEmail: 'noreply@example.com',
        },
      },
    },
  };

  const resolved = resolveAndValidateConfig(raw, 'dev');

  expect(resolved.integrations.email).toEqual({
    provider: 'sendgrid',
    config: {
      apiKey: 'SG.resolved-from-env',
      fromEmail: 'noreply@example.com',
    },
  });
});
