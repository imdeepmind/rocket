import {startServer, type StartServerResult} from '@/server';

import {defineConfig} from '@/lib/config/define';

import type {AppConfigInput, DefineConfigOptions} from '@/interfaces/config';

import '@/types/fastify';

export {default as migrateDatabase} from '@/migrator';

export {defineConfig};

export type CreateServerOptions = DefineConfigOptions;

/**
 * Resolves, validates, and builds a fully configured Fastify application.
 *
 * The raw configuration goes through the same pipeline as `defineConfig()`,
 * so defaults, environment variables, and validation are always applied.
 *
 * The caller owns the HTTP lifecycle: call `app.listen()` when ready, hand the
 * app to a test harness, or attach additional hooks/plugins.
 */
export async function createServer(
  config: AppConfigInput,
  options: CreateServerOptions = {},
): Promise<StartServerResult> {
  return startServer(defineConfig(config, options));
}

export type {StartServerResult} from '@/server';

export type {RouteInfo} from '@/lib/server/welcome';

export type {HTTPMethod, Mode, StructuredResponse} from '@/interfaces';
export type {
  ApisConfig,
  AppConfigInput,
  AuthProvider,
  CacheDbConfig,
  CustomEndpointConfig,
  DatabaseConfig,
  DefineConfigOptions,
  EmailConfig,
  ModelConfigInput,
  ModelFieldConfig,
  ResolvedAppConfig,
  WebhookConfig,
} from '@/interfaces/config';
export type {ICache} from '@/interfaces/cache';
export type {DatabaseQuery, TransactionClient} from '@/interfaces/database';
export type {EmailSender} from '@/interfaces/email';
export type {CustomFunctionHandler} from '@/interfaces/functions';
export type {IOtpService} from '@/interfaces/otp';

export type {FastifyInstance, FastifyRequest} from 'fastify';
