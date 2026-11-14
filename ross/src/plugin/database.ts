import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

import {createDatabaseClient} from '@/lib/database/client';

export default fp(async (fastify: FastifyInstance) => {
  const dbConfig = fastify.appConfig.infrastructure.database;

  const dbInstance = createDatabaseClient({
    engine: dbConfig.engine,
    url: dbConfig.connection.url,
    timeout: dbConfig.timeout,
    allowDdl: false,
  });

  fastify.decorate('db', dbInstance);

  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing database connection...');
    await dbInstance.close();
    fastify.log.info('Database connection closed.');
  });
});
