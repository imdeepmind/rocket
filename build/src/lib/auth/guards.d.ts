import { FastifyReply } from 'fastify';
import { ResolvedAppConfig } from '../../interfaces/config.js';
export type ResponseBuilder = <T = unknown>(code: number, message: string, data: T) => unknown;
/**
 * Whether a user record belongs to the local password provider. Legacy rows
 * without a provider value are treated as `up-auth`.
 */
export declare function isPasswordAccount(config: ResolvedAppConfig, user: Record<string, unknown> | undefined): boolean;
export declare function passwordManagementMessage(provider: unknown): string;
/**
 * Reject password-only operations for SSO accounts. Returns the reply when the
 * request was blocked, `null` when the caller may proceed.
 */
export declare function blockPasswordManagement(reply: FastifyReply, config: ResolvedAppConfig, user: Record<string, unknown> | undefined, buildResponse?: ResponseBuilder): FastifyReply | null;
/**
 * Throwable variant for handlers that run inside a transaction, where sending
 * a reply directly would bypass rollback.
 */
export declare function assertPasswordAccount(config: ResolvedAppConfig, user: Record<string, unknown> | undefined, buildResponse?: ResponseBuilder): void;
