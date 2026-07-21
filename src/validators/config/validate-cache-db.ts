import {AppConfig} from '@/interfaces/config';

function validateCacheDbConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  if (!config.infrastructure.cache) return errors;

  return errors;
}

export default validateCacheDbConstraints;
