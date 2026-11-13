import {AppConfig, ResolvedAppConfig} from '@/interfaces/config';

export default function validateCorsConstraints(
  config: AppConfig | ResolvedAppConfig,
): string[] {
  const errors: string[] = [];
  const cors = config.application?.cors;

  if (cors && cors.enabled) {
    if (!cors.origins || cors.origins.length === 0) {
      errors.push(
        'application.cors: origins must contain at least one origin when cors is enabled',
      );
    }
    if (cors.credentials && cors.origins?.includes('*')) {
      errors.push(
        'application.cors: credentials cannot be true when origins includes "*"',
      );
    }
  }

  return errors;
}
