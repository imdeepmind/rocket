import {AppConfig, WebhookConfig} from '@/interfaces/config';

import {getAPIFromUniqueIdentifier} from '@/utils/config';

function validateWebhookConstraints(webhooks: WebhookConfig[]): string[] {
  const errors: string[] = [];

  webhooks.forEach((webhook, i) => {
    const path = `/webhooks/${i}`;
    // make sure atleast triggerOnRequest or triggerOnResponse is true
    if (!webhook.triggerOnRequest && !webhook.triggerOnResponse) {
      errors.push(
        `${path}: webhook must have at least one of triggerOnRequest or triggerOnResponse`,
      );
    }

    // data resp cannot be used when triggerOnRequest is true
    if (webhook.triggerOnRequest && webhook.data.includes('resp')) {
      errors.push(
        `${path}: data resp cannot be used when triggerOnRequest is true`,
      );
    }
  });

  return errors;
}

function validateApisConstraints(config: AppConfig): string[] {
  const errors: string[] = [];

  const apisConfigurations = config.apis ?? {};
  const keys = Object.keys(apisConfigurations);

  for (const key of keys) {
    const parts = key.split('->');

    if (parts.length !== 4) {
      errors.push(`apis/${key}: invalid key format`);
      continue;
    }

    if (parts[0] === 'customAPIs') {
      if (parts[1] === 'all' && parts[2] === 'all') {
        const customQueryConfig = getAPIFromUniqueIdentifier(config, key);

        if (!customQueryConfig) {
          errors.push(`apis/${key}: custom query not found`);
          continue;
        }
      }
    }

    // validate the webhook
    const webhooks = apisConfigurations[key]?.webhooks;

    if (webhooks) {
      const webhookErrors = validateWebhookConstraints(webhooks);
      if (webhookErrors.length > 0) {
        webhookErrors.forEach(error => {
          errors.push(`apis/${key}${error}`);
        });
      }
    }

    // validate the authorization, true only when auth is enabled
    const authorization = apisConfigurations[key]?.authorization;
    if (authorization && !config.auth?.enableAuth) {
      errors.push(
        `apis/${key}/authorization: authorization is only allowed when auth is enabled`,
      );
    }
  }

  return errors;
}

export default validateApisConstraints;
