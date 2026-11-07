import {getGeneratedApiIdentifiers} from '@/lib/config/route-registry';

import {ResolvedAppConfig, WebhookConfig} from '@/interfaces/config';

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

function validateApisConstraints(config: ResolvedAppConfig): string[] {
  const errors: string[] = [];

  // Sparse-input compatibility: `validateConfig` also accepts legacy shapes.
  const apisConfigurations = config.apis ?? {};
  const keys = Object.keys(apisConfigurations);
  const generatedIdentifiers = getGeneratedApiIdentifiers(config);

  for (const key of keys) {
    const parts = key.split('.');

    if (parts.length !== 5) {
      errors.push(`apis/${key}: invalid key format`);
      continue;
    }

    if (!generatedIdentifiers.has(key)) {
      errors.push(`apis/${key}: does not match any generated API route`);
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
    if (authorization && !config.authentication.enabled) {
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

    if (supportedQueries && key.startsWith('model.')) {
      const modelName = parts[2];
      const model = config.data.models[modelName];
      if (model) {
        const allFieldQueries = new Set(
          Object.values(model.fields).flatMap(f => f.query || []),
        );
        for (const op of supportedQueries) {
          if (!allFieldQueries.has(op)) {
            errors.push(
              `apis/${key}/supportedQueries: "${op}" is not supported by any field in model "${modelName}"`,
            );
          }
        }
      }
    }

    // validate supportedAggregations is only allowed on aggregate APIs
    const supportedAggregations =
      apisConfigurations[key]?.supportedAggregations;
    if (supportedAggregations && !key.startsWith('aggregate.')) {
      errors.push(
        `apis/${key}/supportedAggregations: supportedAggregations is only allowed on aggregate APIs (keys starting with "aggregate.")`,
      );
    }

    if (supportedAggregations && key.startsWith('aggregate.')) {
      const modelName = parts[2];
      const model = config.data.models[modelName];
      if (model) {
        const allFieldAggregations = new Set(
          Object.values(model.fields).flatMap(f => f.aggregations || []),
        );
        for (const agg of supportedAggregations) {
          if (!allFieldAggregations.has(agg)) {
            errors.push(
              `apis/${key}/supportedAggregations: "${agg}" is not supported by any field in model "${modelName}"`,
            );
          }
        }
      }
    }
  }

  return errors;
}

export default validateApisConstraints;
