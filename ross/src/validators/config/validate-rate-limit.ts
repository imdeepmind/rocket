import {AppConfig, ResolvedAppConfig} from '@/interfaces/config';

export default function validateRateLimitConstraints(
  config: AppConfig | ResolvedAppConfig,
): string[] {
  const errors: string[] = [];
  const rateLimit = config.application?.rateLimit;
  const healthCheck = config.application?.healthCheck;

  if (rateLimit?.rateLimitHealthAPI) {
    if (!rateLimit.enabled) {
      errors.push(
        'application.rateLimit: rateLimitHealthAPI can only be enabled when rateLimit is enabled',
      );
    }
    if (healthCheck !== undefined && healthCheck.enabled === false) {
      errors.push(
        'application.rateLimit: rateLimitHealthAPI can only be enabled when healthCheck is enabled',
      );
    }
  }

  return errors;
}
