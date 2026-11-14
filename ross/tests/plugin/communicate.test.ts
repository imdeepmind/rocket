import Fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import communicatePlugin from '@/plugin/communicate';

import {createEmailSender} from '@/lib/email';

import {EmailConfig, ResolvedAppConfig} from '@/interfaces/config';
import {EmailSender} from '@/interfaces/email';

vi.mock('@/lib/email', () => ({createEmailSender: vi.fn()}));

function buildApp(email?: EmailConfig): FastifyInstance {
  const app = Fastify();
  app.appConfig = {
    integrations: email ? {email} : {},
  } as unknown as ResolvedAppConfig;

  return app;
}

describe('communicate plugin', () => {
  let app: FastifyInstance;
  const sendEmail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createEmailSender).mockReturnValue(
      sendEmail as unknown as EmailSender,
    );
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('decorates fastify with the configured sender', async () => {
    app = buildApp({provider: 'dummy'});

    await app.register(communicatePlugin);
    await app.ready();

    expect(app.hasDecorator('communicate')).toBe(true);
    expect(app.communicate.sendEmail).toBe(sendEmail);
    expect(createEmailSender).toHaveBeenCalledWith({provider: 'dummy'});
  });

  it('forwards sendEmail calls to the configured sender', async () => {
    app = buildApp({provider: 'dummy'});

    await app.register(communicatePlugin);
    await app.ready();

    await app.communicate.sendEmail(
      'test@example.com',
      'Your OTP Code',
      '<h1>Hello</h1>',
      'Hello',
    );

    expect(sendEmail).toHaveBeenCalledWith(
      'test@example.com',
      'Your OTP Code',
      '<h1>Hello</h1>',
      'Hello',
    );
  });

  it('passes the aws-ses configuration to the sender factory', async () => {
    const email: EmailConfig = {
      provider: 'aws-ses',
      config: {
        region: 'us-east-1',
        fromEmail: 'noreply@example.com',
      },
    };
    app = buildApp(email);

    await app.register(communicatePlugin);
    await app.ready();

    expect(createEmailSender).toHaveBeenCalledWith(email);
  });

  it('passes the sendgrid configuration to the sender factory', async () => {
    const email: EmailConfig = {
      provider: 'sendgrid',
      config: {
        apiKey: 'SG.super-secret-api-key',
        fromEmail: 'noreply@example.com',
      },
    };
    app = buildApp(email);

    await app.register(communicatePlugin);
    await app.ready();

    expect(createEmailSender).toHaveBeenCalledWith(email);
  });

  it('throws when integrations.email is not configured', async () => {
    app = buildApp();

    app.register(communicatePlugin);

    await expect(app.ready()).rejects.toThrow(
      'communicate plugin requires integrations.email to be configured',
    );
  });
});
