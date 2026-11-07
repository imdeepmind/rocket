import * as fs from 'fs';
import * as path from 'path';

import {expect, test} from 'vitest';

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
