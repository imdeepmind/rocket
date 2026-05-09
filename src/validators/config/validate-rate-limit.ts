import {AppConfig} from '@/interfaces/config';

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

export default validateRateLimitConstraints;
