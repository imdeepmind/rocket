import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

import {WebhookPayload, WebhookTriggerType} from '@/interfaces';

async function makeWebhookCall(
  url: string,
  payload: WebhookPayload,
  logger: FastifyInstance['log'],
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rocket-Webhook': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn(`Webhook call returned status ${response.status} for ${url}`);
    } else {
      logger.info(`Webhook call successful for ${url}`);
    }
  } catch (error) {
    logger.error({err: error}, `Webhook call failed for ${url}`);
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    async function callWebhook(
      trigger: WebhookTriggerType,
      request: FastifyRequest,
      payload: unknown,
    ): Promise<void> {
      const apiIdentifier = request.routeOptions?.config?.apiIdentifier;
      if (!apiIdentifier) {
        fastify.log.debug(
          'No apiIdentifier found on request route options config',
        );
        return;
      }

      const webhookConfigs =
        fastify.appConfig.apis?.[apiIdentifier]?.webhooks ?? null;
      if (!webhookConfigs?.length) return;

      const isRequestTrigger = trigger === 'request';

      for (const config of webhookConfigs) {
        const dataToSend = config.data;
        const webhookPayload: WebhookPayload = {
          body: dataToSend.includes('body') ? request.body : undefined,
          query: dataToSend.includes('query') ? request.query : undefined,
          params: dataToSend.includes('params') ? request.params : undefined,
          resp: dataToSend.includes('resp') ? payload : undefined,
        };
        const shouldCall = isRequestTrigger
          ? config.triggerOnRequest
          : config.triggerOnResponse;

        if (shouldCall) {
          await makeWebhookCall(config.url, webhookPayload, fastify.log);
        }
      }
    }

    fastify.decorate('callWebhook', callWebhook);
  },
  {
    name: 'webhook-plugin',
  },
);
