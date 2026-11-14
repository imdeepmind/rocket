import {describe, expect, it} from 'vitest';

import * as ross from '@/index';
import type {FastifyInstance, FastifyRequest} from '@/index';

type InstanceIsAugmented = FastifyInstance extends {
  db: unknown;
  appConfig: unknown;
  buildResponse: unknown;
  cache: unknown;
  callWebhook: unknown;
  enforceSSP: unknown;
  communicate: unknown;
  otp: unknown;
}
  ? true
  : false;

type RequestIsAugmented = FastifyRequest extends {authenticate: unknown}
  ? true
  : false;

const instanceIsAugmented: InstanceIsAugmented = true;
const requestIsAugmented: RequestIsAugmented = true;

describe('Public API', () => {
  it('should expose only the supported runtime entrypoints', () => {
    expect(ross.createServer).toBeTypeOf('function');
    expect(ross.defineConfig).toBeTypeOf('function');
    expect(ross.migrateDatabase).toBeTypeOf('function');
    expect('startServer' in ross).toBe(false);
  });

  it('should ship the augmented Fastify types', () => {
    expect(instanceIsAugmented).toBe(true);
    expect(requestIsAugmented).toBe(true);
  });
});
