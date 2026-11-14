import * as fs from 'fs';
import type {AddressInfo} from 'net';
import * as path from 'path';

import {
  APIRequestContext,
  request as playwrightRequest,
} from '@playwright/test';
import {FastifyInstance} from 'fastify';

import migrateDatabase from '@/migrator';
import {startServer} from '@/server';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {RouteInfo} from '@/lib/server/welcome';

import {AppConfigInput} from '@/interfaces/config';

export interface E2EServer {
  app: FastifyInstance;
  routes: RouteInfo[];
  port: number;
  baseURL: string;
  request: APIRequestContext;
  cleanup: () => Promise<void>;
}

export interface CreateE2EServerOptions {
  migrate?: boolean;
}

function cleanDbFiles(dbFile: string): void {
  for (const f of [
    dbFile,
    `${dbFile}-wal`,
    `${dbFile}-shm`,
    `${dbFile}-journal`,
  ]) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore cleanup errors on ephemeral db files
      }
    }
  }
}

export async function createE2EServer(
  configInput: string | AppConfigInput,
  options: CreateE2EServerOptions = {},
): Promise<E2EServer> {
  const {migrate = true} = options;

  const config: AppConfigInput =
    typeof configInput === 'string'
      ? (JSON.parse(
          fs.readFileSync(path.resolve(configInput), 'utf-8'),
        ) as AppConfigInput)
      : (structuredClone(configInput) as AppConfigInput);

  const dataDir = path.resolve(process.cwd(), 'e2e/.data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, {recursive: true});
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dbFile = path.join(dataDir, `test-${id}.db`);

  if (config.infrastructure?.database?.engine === 'sqlite') {
    config.infrastructure.database.connection = {
      url: dbFile,
    };
  }

  let app: FastifyInstance | undefined;

  try {
    const resolvedConfig = resolveAndValidateConfig(config, 'dev');
    if (migrate) {
      await migrateDatabase(resolvedConfig);
    }
    const serverResult = await startServer(resolvedConfig);
    app = serverResult.app;
    await app.listen({port: 0, host: '127.0.0.1'});

    const address = app.server.address() as AddressInfo;
    const port = address.port;
    const baseURL = `http://127.0.0.1:${port}`;

    const requestContext = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });

    const cleanup = async () => {
      await requestContext.dispose().catch(() => {});
      if (app) {
        await app.close().catch(() => {});
      }
      cleanDbFiles(dbFile);
    };

    return {
      app,
      routes: serverResult.routes,
      port,
      baseURL,
      request: requestContext,
      cleanup,
    };
  } catch (err) {
    if (app) {
      await app.close().catch(() => {});
    }
    cleanDbFiles(dbFile);
    throw err;
  }
}
