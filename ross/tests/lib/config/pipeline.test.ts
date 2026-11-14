import * as fs from 'fs';
import * as path from 'path';

import {expect, test} from 'vitest';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {resolveConfig} from '@/lib/config/resolve';

import {AppConfigInput} from '@/interfaces/config';

const EXAMPLE_CONFIG_PATH = path.resolve('example_config.json');
const GOLDEN_SNAPSHOT_PATH = path.resolve(
  'tests/lib/config/__goldens__/example_config.resolved.json',
);

test('example_config.json resolves to the checked-in golden snapshot', () => {
  const raw = JSON.parse(
    fs.readFileSync(EXAMPLE_CONFIG_PATH, 'utf-8'),
  ) as AppConfigInput;

  const resolved = resolveConfig(raw, {mode: 'dev'});

  const golden = JSON.parse(fs.readFileSync(GOLDEN_SNAPSHOT_PATH, 'utf-8'));

  expect(resolved).toEqual(golden);
});

test('examples/01-barebone/barebone_config.json resolves and validates in dev', () => {
  const raw = JSON.parse(
    fs.readFileSync(
      path.resolve('examples/01-barebone/barebone_config.json'),
      'utf-8',
    ),
  ) as AppConfigInput;

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
