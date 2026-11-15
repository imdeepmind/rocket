import {FastifyInstance, FastifyReply} from 'fastify';

import {ResolvedAppConfig} from '@/interfaces/config';

/**
 * Whether a user record belongs to the local password provider. Legacy rows
 * without a provider value are treated as `up-auth`.
 */
export function isPasswordAccount(
  config: ResolvedAppConfig,
  user: Record<string, unknown> | undefined,
): boolean {
  const {authentication} = config;

  if (!authentication.enabled || !user) {
    return true;
  }

  const providerField = authentication.userModel?.providerField;

  if (!providerField) {
    return true;
  }

  const value = user[providerField];

  return value === undefined || value === null || value === 'up-auth';
}

export function passwordManagementMessage(provider: unknown): string {
  const name = typeof provider === 'string' ? provider : 'an external identity';

  return `Password management is not supported for accounts authenticated via ${name}. Please manage your credentials through your identity provider.`;
}

function providerValue(
  config: ResolvedAppConfig,
  user: Record<string, unknown> | undefined,
): unknown {
  const {authentication} = config;

  /* c8 ignore start - only reachable when isPasswordAccount already returned true */
  if (!authentication.enabled || !authentication.userModel) {
    return undefined;
  }
  /* c8 ignore stop */

  return user?.[authentication.userModel.providerField];
}

/**
 * Reject password-only operations for SSO accounts. Returns the reply when the
 * request was blocked, `null` when the caller may proceed.
 */
export function blockPasswordManagement(
  app: FastifyInstance,
  reply: FastifyReply,
  config: ResolvedAppConfig,
  user: Record<string, unknown> | undefined,
): FastifyReply | null {
  if (isPasswordAccount(config, user)) {
    return null;
  }

  return reply
    .status(400)
    .send(
      app.buildResponse(
        400,
        passwordManagementMessage(providerValue(config, user)),
        null,
      ),
    );
}

/**
 * Throwable variant for handlers that run inside a transaction, where sending
 * a reply directly would bypass rollback.
 */
export function assertPasswordAccount(
  app: FastifyInstance,
  config: ResolvedAppConfig,
  user: Record<string, unknown> | undefined,
): void {
  if (isPasswordAccount(config, user)) {
    return;
  }

  const message = passwordManagementMessage(providerValue(config, user));

  throw Object.assign(new Error(message), {
    statusCode: 400,
    body: app.buildResponse(400, message, null),
  });
}
