import { type StartServerResult } from './server.js';
import { defineConfig } from './lib/config/define.js';
import type { AppConfigInput, DefineConfigOptions } from './interfaces/config.js';
import './types/fastify.js';
export { default as migrateDatabase } from './migrator/index.js';
export { defineConfig };
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
export declare function createServer(config: AppConfigInput, options?: CreateServerOptions): Promise<StartServerResult>;
export type { StartServerResult } from './server.js';
export type { RouteInfo } from './lib/server/welcome.js';
export type { HTTPMethod, Mode, StructuredResponse } from './interfaces/index.js';
export type { ApisConfig, AppConfigInput, AuthProvider, CacheDbConfig, CustomEndpointConfig, DatabaseConfig, DefineConfigOptions, EmailConfig, ModelConfigInput, ModelFieldConfig, ResolvedAppConfig, WebhookConfig, } from './interfaces/config.js';
export type { ICache } from './interfaces/cache.js';
export type { DatabaseQuery, TransactionClient } from './interfaces/database.js';
export type { EmailSender } from './interfaces/email.js';
export type { CustomFunctionHandler } from './interfaces/functions.js';
export type { IOtpService } from './interfaces/otp.js';
export type { FastifyInstance, FastifyRequest } from 'fastify';
