import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {ResolvedAppConfig} from '@/interfaces/config';

export function registerHealthRoute(
  app: FastifyInstance,
  config: ResolvedAppConfig,
): void {
  if (!config.application.healthCheck.enabled) {
    return;
  }

  let path = config.application.healthCheck.path;
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const schema: Record<string, unknown> = {
    summary: 'Health check',
    description:
      'Verifies the operational status of the Fastify server, database connection, and cache service.',
    tags: ['Health'],
    response: {
      200: {
        description: 'All required services are operational.',
        type: 'object',
        properties: {
          status: {type: 'string', enum: ['ok']},
          timestamp: {type: 'string'},
          services: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: {type: 'string', enum: ['up', 'down']},
                  latencyMs: {type: 'number'},
                  error: {type: 'string'},
                },
                required: ['status'],
              },
              cache: {
                type: 'object',
                properties: {
                  status: {type: 'string', enum: ['up', 'down']},
                  error: {type: 'string'},
                },
                required: ['status'],
              },
            },
            required: ['database', 'cache'],
          },
        },
        required: ['status', 'timestamp', 'services'],
      },
      503: {
        description: 'Database or critical service is degraded or unreachable.',
        type: 'object',
        properties: {
          status: {type: 'string', enum: ['degraded']},
          timestamp: {type: 'string'},
          services: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: {type: 'string', enum: ['up', 'down']},
                  latencyMs: {type: 'number'},
                  error: {type: 'string'},
                },
                required: ['status'],
              },
              cache: {
                type: 'object',
                properties: {
                  status: {type: 'string', enum: ['up', 'down']},
                  error: {type: 'string'},
                },
                required: ['status'],
              },
            },
            required: ['database', 'cache'],
          },
        },
        required: ['status', 'timestamp', 'services'],
      },
    },
  };

  const shouldRateLimit =
    config.application.rateLimit.enabled &&
    config.application.rateLimit.rateLimitHealthAPI;

  app.get(
    path,
    {
      schema,
      ...(shouldRateLimit ? {} : {config: {rateLimit: false}}),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let databaseStatus:
        | {status: 'up'; latencyMs: number}
        | {status: 'down'; error: string};

      try {
        if (!app.db) {
          throw new Error('Database service is not initialized');
        }
        const start = Date.now();
        await app.db.query('SELECT 1;');
        const latencyMs = Date.now() - start;
        databaseStatus = {status: 'up', latencyMs};
      } catch (err: unknown) {
        request.log.error(err);
        databaseStatus = {
          status: 'down',
          error: 'Database service is unavailable',
        };
      }

      let cacheStatus: {status: 'up'} | {status: 'down'; error: string};

      try {
        if (!app.cache) {
          throw new Error('Cache service is not initialized');
        }
        if (typeof app.cache.ping === 'function') {
          await app.cache.ping();
        } else {
          const probeKey = '__healthcheck_probe__';
          await app.cache.set(probeKey, 1, 1);
          await app.cache.delete(probeKey);
        }
        cacheStatus = {status: 'up'};
      } catch (err: unknown) {
        request.log.error(err);
        cacheStatus = {
          status: 'down',
          error: 'Cache service is unavailable',
        };
      }

      const isHealthy =
        databaseStatus.status === 'up' && cacheStatus.status === 'up';

      return reply.status(isHealthy ? 200 : 503).send({
        status: isHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          database: databaseStatus,
          cache: cacheStatus,
        },
      });
    },
  );
}
