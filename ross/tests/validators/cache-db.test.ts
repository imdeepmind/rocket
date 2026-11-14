import {describe, expect, it} from 'vitest';

import {AppConfig} from '@/interfaces/config';

import validateCacheDbConstraints from '@/validators/config/validate-cache-db';

function buildConfig(cache?: unknown): AppConfig {
  return {
    infrastructure: {
      database: {engine: 'sqlite', connection: {url: './test.db'}},
      ...(cache === undefined ? {} : {cache}),
    },
  } as unknown as AppConfig;
}

describe('validateCacheDbConstraints', () => {
  it('returns no errors when cache is absent', () => {
    expect(validateCacheDbConstraints(buildConfig())).toEqual([]);
  });

  it('returns no errors for memory and redis caches', () => {
    expect(validateCacheDbConstraints(buildConfig({engine: 'memory'}))).toEqual(
      [],
    );
    expect(
      validateCacheDbConstraints(
        buildConfig({
          engine: 'redis',
          connection: {url: 'redis://localhost:6379'},
          timeout: 5000,
        }),
      ),
    ).toEqual([]);
  });

  it('accepts valid memcached servers and ports', () => {
    expect(
      validateCacheDbConstraints(
        buildConfig({
          engine: 'memcached',
          connection: {url: 'localhost:11211'},
          timeout: 5000,
        }),
      ),
    ).toEqual([]);

    expect(
      validateCacheDbConstraints(
        buildConfig({
          engine: 'memcached',
          connection: {url: 'memcached://cache1:11211,cache2:11212'},
        }),
      ),
    ).toEqual([]);
  });

  it('returns no errors when the connection is missing', () => {
    expect(
      validateCacheDbConstraints(
        buildConfig({engine: 'memcached', connection: undefined}),
      ),
    ).toEqual([]);
  });

  it.each(['localhost:0', 'localhost:70000', 'localhost:-1'])(
    'rejects the invalid memcached port in %s',
    url => {
      expect(
        validateCacheDbConstraints(
          buildConfig({
            engine: 'memcached',
            connection: {url},
          }),
        ),
      ).toEqual([
        `infrastructure.cache: memcached port "${url}" must be between 1 and 65535`,
      ]);
    },
  );

  it('rejects every invalid server in a multi-server URL', () => {
    expect(
      validateCacheDbConstraints(
        buildConfig({
          engine: 'memcached',
          connection: {url: 'cache1:0,cache2:11211,cache3:99999'},
        }),
      ),
    ).toEqual([
      'infrastructure.cache: memcached port "cache1:0" must be between 1 and 65535',
      'infrastructure.cache: memcached port "cache3:99999" must be between 1 and 65535',
    ]);
  });
});
