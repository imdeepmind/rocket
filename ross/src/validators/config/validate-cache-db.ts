import {AppConfig, ResolvedAppConfig} from '@/interfaces/config';

const MEMCACHED_SCHEME = /^memcached:\/\//;

function validateMemcachedUrl(url: string): string[] {
  const errors: string[] = [];
  const servers = url.replace(MEMCACHED_SCHEME, '').split(',');

  for (const server of servers) {
    const port = Number(server.split(':').pop());

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push(
        `infrastructure.cache: memcached port "${server}" must be between 1 and 65535`,
      );
    }
  }

  return errors;
}

export default function validateCacheDbConstraints(
  config: AppConfig | ResolvedAppConfig,
): string[] {
  const cache = config.infrastructure?.cache;

  if (!cache || cache.engine !== 'memcached') {
    return [];
  }

  const url = cache.connection?.url;

  if (!url) {
    return [];
  }

  return validateMemcachedUrl(url);
}
