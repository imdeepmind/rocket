export const DEFAULT_TEST_PG_URL =
  process.env.TEST_PG_URL ||
  'postgresql://devuser:devpassword@localhost:5432/e2e_testing';

export const DEFAULT_TEST_REDIS_URL =
  process.env.TEST_REDIS_URL || 'redis://localhost:6379';

export const UNREACHABLE_PG_URL =
  'postgresql://devuser:devpassword@127.0.0.1:59999/e2e_testing';

export const UNREACHABLE_REDIS_URL = 'redis://127.0.0.1:59999';
