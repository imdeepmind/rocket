import Fastify, {FastifyRequest} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import webhookPlugin from '@/plugin/webhook';

import {AppConfig, WebhookConfig} from '@/interfaces/config';

describe('webhook plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('webhook plugin decorates fastify with callWebhook', async () => {
    const app = Fastify();
    app.appConfig = {application: {logLevel: 'silent'}} as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    expect(app.hasDecorator('callWebhook')).toBe(true);
  });

  it('should not call webhook if apiIdentifier is missing', async () => {
    const app = Fastify();
    app.appConfig = {application: {logLevel: 'silent'}} as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {},
      },
    } as unknown as FastifyRequest;

    const debugSpy = vi.spyOn(app.log, 'debug');

    await app.callWebhook('request', mockRequest, null);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('No apiIdentifier found'),
    );
  });

  it('should not call webhook if no webhooks are configured for the API', async () => {
    const app = Fastify();
    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          webhooks: [],
        },
      },
    } as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    await app.callWebhook('request', mockRequest, null);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should call webhook on request trigger', async () => {
    const app = Fastify();
    const webhookConfigs: WebhookConfig[] = [
      {
        url: 'https://example.com/webhook',
        data: [],
        triggerOnRequest: true,
        triggerOnResponse: false,
      },
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          webhooks: webhookConfigs,
        },
      },
    } as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
      body: {name: 'John'},
    } as unknown as FastifyRequest;

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ok: true});

    const infoSpy = vi.spyOn(app.log, 'info');

    await app.callWebhook('request', mockRequest, null);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Rocket-Webhook': 'true',
        }),
      }),
    );

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Webhook call successful for https://example.com/webhook',
      ),
    );
  });

  it('should call webhook on response trigger with payload', async () => {
    const app = Fastify();
    const responsePayload = {success: true, data: {id: 1}};
    const webhookConfigs: WebhookConfig[] = [
      {
        url: 'https://example.com/webhook-resp',
        data: ['resp'],
        triggerOnRequest: false,
        triggerOnResponse: true,
      },
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          webhooks: webhookConfigs,
        },
      },
    } as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
      body: null,
    } as unknown as FastifyRequest;

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ok: true});

    await app.callWebhook('response', mockRequest, responsePayload);

    expect(global.fetch).toHaveBeenCalled();
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.resp).toEqual(responsePayload);
    expect(body.body).toBeUndefined();
  });

  it('should skip webhook with triggerOnRequest false for request trigger', async () => {
    const app = Fastify();
    const webhookConfigs: WebhookConfig[] = [
      {
        url: 'https://example.com/webhook',
        data: [],
        triggerOnRequest: false,
        triggerOnResponse: true,
      },
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          webhooks: webhookConfigs,
        },
      },
    } as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    await app.callWebhook('request', mockRequest, null);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should skip webhook with triggerOnResponse false for response trigger', async () => {
    const app = Fastify();
    const webhookConfigs: WebhookConfig[] = [
      {
        url: 'https://example.com/webhook',
        data: [],
        triggerOnRequest: true,
        triggerOnResponse: false,
      },
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          webhooks: webhookConfigs,
        },
      },
    } as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    await app.callWebhook('response', mockRequest, null);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should include only requested data fields in webhook payload', async () => {
    const app = Fastify();
    const webhookConfigs: WebhookConfig[] = [
      {
        url: 'https://example.com/webhook',
        data: ['body', 'query', 'params', 'resp'],
        triggerOnRequest: true,
        triggerOnResponse: true,
      },
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          webhooks: webhookConfigs,
        },
      },
    } as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
      body: {id: 123},
      query: {active: 'true'},
      params: {tenant: 'default'},
    } as unknown as FastifyRequest;

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ok: true});

    const responsePayload = {ok: true};

    await app.callWebhook('request', mockRequest, responsePayload);

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body).toEqual({
      body: {id: 123},
      query: {active: 'true'},
      params: {tenant: 'default'},
      resp: responsePayload,
    });
  });

  it('should log warn on non-ok status response', async () => {
    const app = Fastify();
    const webhookConfigs: WebhookConfig[] = [
      {
        url: 'https://example.com/webhook',
        data: [],
        triggerOnRequest: true,
        triggerOnResponse: false,
      },
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          webhooks: webhookConfigs,
        },
      },
    } as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ok: false, status: 500});

    const warnSpy = vi.spyOn(app.log, 'warn');

    await app.callWebhook('request', mockRequest, null);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('returned status 500'),
    );
  });

  it('should handle fetch errors gracefully', async () => {
    const app = Fastify();
    const webhookConfigs: WebhookConfig[] = [
      {
        url: 'https://example.com/webhook',
        data: [],
        triggerOnRequest: true,
        triggerOnResponse: false,
      },
    ];

    app.appConfig = {
      application: {logLevel: 'silent'},
      apis: {
        'test-api': {
          webhooks: webhookConfigs,
        },
      },
    } as unknown as AppConfig;
    await app.register(webhookPlugin);
    await app.ready();

    const mockRequest = {
      routeOptions: {
        config: {
          apiIdentifier: 'test-api',
        },
      },
    } as unknown as FastifyRequest;

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const error = new Error('Network error');
    fetchMock.mockRejectedValueOnce(error);

    const errorSpy = vi.spyOn(app.log, 'error');

    await app.callWebhook('request', mockRequest, null);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({err: error}),
      expect.stringContaining('failed for https://example.com/webhook'),
    );
  });
});
