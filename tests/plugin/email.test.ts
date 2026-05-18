import Fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import emailPlugin from '@/plugin/email';

import {AppConfig} from '@/interfaces/config';

describe('email plugin', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('decorates fastify with communicate', async () => {
    app = Fastify();
    app.appConfig = {
      email: {
        emailEngine: 'dummy',
      },
    } as unknown as AppConfig;

    await app.register(emailPlugin);
    await app.ready();

    expect(app.hasDecorator('communicate')).toBe(true);
    expect(app.communicate).toBeDefined();
    expect(typeof app.communicate.sendEmail).toBe('function');
  });

  it('sends a dummy email when emailEngine is dummy', async () => {
    app = Fastify();
    app.appConfig = {
      email: {
        emailEngine: 'dummy',
      },
    } as unknown as AppConfig;

    await app.register(emailPlugin);
    await app.ready();

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await app.communicate.sendEmail(
      'test@example.com',
      '<h1>Hello</h1>',
      'Hello',
    );

    expect(consoleLogSpy).toHaveBeenCalledWith('Email:', 'test@example.com');
    expect(consoleLogSpy).toHaveBeenCalledWith('HTML Body:', '<h1>Hello</h1>');
    expect(consoleLogSpy).toHaveBeenCalledWith('Body:', 'Hello');

    consoleLogSpy.mockRestore();
  });

  it('does not send an email if emailEngine is not dummy', async () => {
    app = Fastify();
    app.appConfig = {
      email: {
        emailEngine: 'other' as unknown as 'dummy',
      },
    } as unknown as AppConfig;

    await app.register(emailPlugin);
    await app.ready();

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await app.communicate.sendEmail(
      'test@example.com',
      '<h1>Hello</h1>',
      'Hello',
    );

    expect(consoleLogSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
