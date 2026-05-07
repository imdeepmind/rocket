import {AppConfig} from '@/interfaces/config';

function validateCacheDbConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  if (!config.cache_db) return errors;

  return errors;
}

export default validateCacheDbConstraints;
