import fp from 'fastify-plugin';
async function makeWebhookCall(url, payload, logger) {
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
        }
        else {
            logger.info(`Webhook call successful for ${url}`);
        }
    }
    catch (error) {
        logger.error({ err: error }, `Webhook call failed for ${url}`);
    }
}
export default fp(async (fastify) => {
    async function callWebhook(trigger, request, payload) {
        const apiIdentifier = request.routeOptions?.config?.apiIdentifier;
        if (!apiIdentifier) {
            fastify.log.debug('No apiIdentifier found on request route options config');
            return;
        }
        const webhookConfigs = fastify.appConfig.apis[apiIdentifier]?.webhooks ?? [];
        if (!webhookConfigs?.length)
            return;
        const isRequestTrigger = trigger === 'request';
        for (const config of webhookConfigs) {
            const dataToSend = config.data;
            const webhookPayload = {
                body: dataToSend.includes('body') ? request.body : undefined,
                query: dataToSend.includes('query') ? request.query : undefined,
                params: dataToSend.includes('params') ? request.params : undefined,
                response: dataToSend.includes('response') ? payload : undefined,
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
}, {
    name: 'webhook-plugin',
});
//# sourceMappingURL=webhook.js.map