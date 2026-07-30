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

    // data response cannot be used when triggerOnRequest is true
    if (webhook.triggerOnRequest && webhook.data.includes('response')) {
      errors.push(
        `${path}: data response cannot be used when triggerOnRequest is true`,
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
    const parts = key.split('.');

    if (parts[0] === 'custom') {
      if (parts.length === 5) {
        const endpointConfig = getAPIFromUniqueIdentifier(config, key);

        if (!endpointConfig) {
          errors.push(`apis/${key}: custom endpoint not found`);
          continue;
        }
      } else {
        errors.push(`apis/${key}: invalid key format`);
        continue;
      }
    } else if (parts.length !== 5) {
      errors.push(`apis/${key}: invalid key format`);
      continue;
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
    if (authorization && !config.authentication?.enabled) {
      errors.push(
        `apis/${key}/authorization: authorization is only allowed when auth is enabled`,
      );
    }

    // validate supportedQueries is only allowed on model APIs
    const supportedQueries = apisConfigurations[key]?.supportedQueries;
    if (supportedQueries && !key.startsWith('model.')) {
      errors.push(
        `apis/${key}/supportedQueries: supportedQueries is only allowed on model APIs (keys starting with "model.")`,
      );
    }

    // validate supportedAggregations is only allowed on aggregate APIs
    const supportedAggregations =
      apisConfigurations[key]?.supportedAggregations;
    if (supportedAggregations && !key.startsWith('aggregate.')) {
      errors.push(
        `apis/${key}/supportedAggregations: supportedAggregations is only allowed on aggregate APIs (keys starting with "aggregate.")`,
      );
    }
  }

  return errors;
}

export default validateApisConstraints;
