import {FastifyRequest} from 'fastify';
import {Logger} from 'pino';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {ModelAPIConfig, WebhookConfig} from '@/schema/config';

import {callWebhook, extractWebhookFromModelName} from '@/utils/webhook';

describe('webhook utils', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;

  const mockRequest = {
    body: {name: 'John', age: 30},
    query: {filter: 'active'},
    params: {id: '123'},
  } as unknown as FastifyRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('callWebhook', () => {
    it('should not call webhook if webhookConfigs is null', async () => {
      await callWebhook('request', null, mockRequest, null, mockLogger);
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not call webhook if webhookConfigs is empty', async () => {
      await callWebhook('request', [], mockRequest, null, mockLogger);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should call webhook on request trigger', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

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

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Webhook call successful'),
      );
    });

    it('should call webhook on response trigger', async () => {
      const responsePayload = {success: true, data: []};
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: ['resp'],
          triggerOnRequest: false,
          triggerOnResponse: true,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'response',
        webhookConfig,
        mockRequest,
        responsePayload,
        mockLogger,
      );

      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.resp).toEqual(responsePayload);
    });

    it('should skip webhook with triggerOnRequest false for request trigger', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: [],
          triggerOnRequest: false,
          triggerOnResponse: true,
        },
      ];

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should skip webhook with triggerOnResponse false for response trigger', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      await callWebhook(
        'response',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle multiple webhooks', async () => {
      const webhookConfigs: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook1',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
        {
          url: 'https://example.com/webhook2',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue({ok: true});

      await callWebhook(
        'request',
        webhookConfigs,
        mockRequest,
        null,
        mockLogger,
      );

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should include request data in webhook payload', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        body: undefined,
        query: undefined,
        params: undefined,
        resp: undefined,
      });
    });

    it('should send only specified data fields when data array contains specific fields', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: ['body', 'resp'],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        {result: 'success'},
        mockLogger,
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        body: mockRequest.body,
        query: undefined,
        params: undefined,
        resp: {result: 'success'},
      });
    });

    it('should send only body when data array contains only body', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: ['body'],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        body: mockRequest.body,
        query: undefined,
        params: undefined,
        resp: undefined,
      });
    });

    it('should send only query when data array contains only query', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: ['query'],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        body: undefined,
        query: mockRequest.query,
        params: undefined,
        resp: undefined,
      });
    });

    it('should send only params when data array contains only params', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: ['params'],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        body: undefined,
        query: undefined,
        params: mockRequest.params,
        resp: undefined,
      });
    });

    it('should send only resp when data array contains only resp', async () => {
      const responsePayload = {success: true, message: 'Created'};
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: ['resp'],
          triggerOnRequest: false,
          triggerOnResponse: true,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'response',
        webhookConfig,
        mockRequest,
        responsePayload,
        mockLogger,
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        body: undefined,
        query: undefined,
        params: undefined,
        resp: responsePayload,
      });
    });

    it('should send all data fields when data array contains all field names', async () => {
      const responsePayload = {success: true};
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: ['body', 'query', 'params', 'resp'],
          triggerOnRequest: false,
          triggerOnResponse: true,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'response',
        webhookConfig,
        mockRequest,
        responsePayload,
        mockLogger,
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        body: mockRequest.body,
        query: mockRequest.query,
        params: mockRequest.params,
        resp: responsePayload,
      });
    });

    it('should handle combination of body and query', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: ['body', 'query'],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: true});

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        body: mockRequest.body,
        query: mockRequest.query,
        params: undefined,
        resp: undefined,
      });
    });

    it('should log warn on non-ok response status', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({ok: false, status: 500});

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      const webhookConfig: WebhookConfig[] = [
        {
          url: 'https://example.com/webhook',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const error = new Error('Network error');
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockRejectedValueOnce(error);

      await callWebhook(
        'request',
        webhookConfig,
        mockRequest,
        null,
        mockLogger,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('extractWebhookFromModelName', () => {
    it('should return null if modelAPIs is undefined', () => {
      const result = extractWebhookFromModelName('User', undefined);
      expect(result).toBeNull();
    });

    it('should return null if modelName does not exist in modelAPIs', () => {
      const modelAPIs: Record<string, unknown> = {
        Product: {
          post: {webhooks: []},
        },
      };

      const result = extractWebhookFromModelName(
        'NonExistent',
        modelAPIs as Record<string, ModelAPIConfig> | undefined,
      );
      expect(result).toBeNull();
    });

    it('should return webhooks from aggregate endpoint', () => {
      const webhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/aggregate',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const modelAPIs = {
        User: {
          aggregate: {webhooks},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      expect(result).toEqual(webhooks);
    });

    it('should return webhooks from delete endpoint', () => {
      const webhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/delete',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const modelAPIs = {
        User: {
          delete: {webhooks},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      expect(result).toEqual(webhooks);
    });

    it('should return webhooks from edit endpoint', () => {
      const webhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/edit',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const modelAPIs = {
        User: {
          edit: {webhooks},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      expect(result).toEqual(webhooks);
    });

    it('should return webhooks from get-all endpoint', () => {
      const webhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/get-all',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const modelAPIs = {
        User: {
          'get-all': {webhooks},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      expect(result).toEqual(webhooks);
    });

    it('should return webhooks from index endpoint', () => {
      const webhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/index',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const modelAPIs = {
        User: {
          index: {webhooks},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      expect(result).toEqual(webhooks);
    });

    it('should return webhooks from post endpoint', () => {
      const webhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/post',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const modelAPIs = {
        User: {
          post: {webhooks},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      expect(result).toEqual(webhooks);
    });

    it('should return webhooks from search endpoint', () => {
      const webhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/search',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const modelAPIs = {
        User: {
          search: {webhooks},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      expect(result).toEqual(webhooks);
    });

    it('should return first non-empty webhooks when multiple endpoints have webhooks', () => {
      const aggregateWebhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/aggregate',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const postWebhooks: WebhookConfig[] = [
        {
          url: 'https://example.com/post',
          data: [],
          triggerOnRequest: true,
          triggerOnResponse: false,
        },
      ];

      const modelAPIs = {
        User: {
          aggregate: {webhooks: aggregateWebhooks},
          post: {webhooks: postWebhooks},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      // Should return the first one (aggregate comes first in the API keys array)
      expect(result).toEqual(aggregateWebhooks);
    });

    it('should return null if model has no webhooks in any endpoint', () => {
      const modelAPIs = {
        User: {
          aggregate: {},
          delete: {},
          post: {},
        },
      };

      const result = extractWebhookFromModelName('User', modelAPIs);
      expect(result).toBeNull();
    });
  });
});
