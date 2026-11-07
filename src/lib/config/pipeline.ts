import {resolveEnvVars} from '@/lib/config/env';

import {Mode} from '@/interfaces';
import {AppConfigInput, ResolvedAppConfig} from '@/interfaces/config';

import {validateConfig} from '@/validators/config';

import {resolveConfig} from './resolve';

/**
 * Run the full configuration pipeline once:
 *
 *   raw input → env resolution → resolution (defaults) → validation
 *
 * Returns the dense, validated `ResolvedAppConfig` consumed by the server.
 */
export function resolveAndValidateConfig(
  raw: AppConfigInput,
  mode: Mode,
): ResolvedAppConfig {
  const resolved = resolveConfig(resolveEnvVars(raw), {mode});
  return validateConfig(resolved);
}
