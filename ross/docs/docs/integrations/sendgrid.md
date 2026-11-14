---
sidebar_position: 4
---

# SendGrid Provider

The `sendgrid` provider delivers transactional email through the [Twilio SendGrid v3 Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send) using the official `@sendgrid/mail` package. It needs only an API key and a sender address, and does not depend on your hosting platform.

## Configuration

```json
{
  "integrations": {
    "email": {
      "provider": "sendgrid",
      "config": {
        "apiKey": "env:SENDGRID_API_KEY",
        "fromEmail": "noreply@example.com"
      }
    }
  }
}
```

## Fields reference

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | **Yes** | SendGrid API key with permission to send mail. Minimum length 1. |
| `fromEmail` | `string` | **Yes** | Sender address. Must be a valid email address and a verified SendGrid sender. |

The `config` object rejects unknown properties, so provider-specific extras such as `smtpHost`, `templateId`, or `sandboxMode` are not accepted.

:::note[Plain address only]

`fromEmail` is validated as an email address, so a display form such as `"Rocket <noreply@example.com>"` is rejected. Use the bare address.

:::

## Getting an API key

1. Open **Settings → API Keys** in the SendGrid dashboard.
2. Create a key with at least the **Mail Send** permission. A restricted key is enough; full access is not required.
3. Store the key in an environment variable and reference it with `env:`:

```bash
export SENDGRID_API_KEY='SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

Reference it in the configuration:

```json
{
  "integrations": {
    "email": {
      "provider": "sendgrid",
      "config": {
        "apiKey": "env:SENDGRID_API_KEY",
        "fromEmail": "noreply@example.com"
      }
    }
  }
}
```

ROSS resolves the variable during startup, before configuration validation. If the variable is not set, the server fails to start with an explicit error instead of sending with an empty key.

## Sender authentication

SendGrid rejects messages whose `from` address is not authorized. Before deploying:

- Verify a **Single Sender** address, or
- Authenticate your **domain** (SPF and DKIM records) and use any address on that domain.

Using an authenticated domain is recommended for production because it improves deliverability and lets you rotate addresses without re-verifying each one.

## Runtime behavior

The sender initializes `@sendgrid/mail` once at startup:

1. `sgMail.setApiKey(config.apiKey)` is called when the integration is created.
2. The client is reused for every message.

Each `sendEmail` call maps to one `sgMail.send()` request:

| SendGrid field | Value |
| --- | --- |
| `to` | The recipient passed to `sendEmail` |
| `from` | `config.fromEmail` |
| `subject` | The subject passed to `sendEmail` |
| `html` | The HTML body |
| `text` | The plain-text body |

There is no queue, retry, batching, or de-duplication. If SendGrid rejects the request, the error is propagated to the caller and the triggering request fails.

## Environment variable example

```json
{
  "integrations": {
    "email": {
      "provider": "sendgrid",
      "config": {
        "apiKey": "env:SENDGRID_API_KEY",
        "fromEmail": "env:MAIL_FROM_ADDRESS"
      }
    }
  }
}
```

## Validation rules

The schema is validated at startup:

| Configuration | Result |
| --- | --- |
| `apiKey` and `fromEmail` present | Valid |
| Missing `config` | Invalid — `must have required property 'config'` |
| Missing `apiKey` | Invalid — `must have required property 'apiKey'` |
| `"apiKey": ""` | Invalid — `must NOT have fewer than 1 characters` |
| Missing `fromEmail` | Invalid — `must have required property 'fromEmail'` |
| `"fromEmail": "not-an-email"` | Invalid — `must match format "email"` |
| Extra property such as `templateId` | Invalid — `must NOT have additional properties` |

A missing environment variable is reported before schema validation:

```text
Config error: environment variable "SENDGRID_API_KEY" (referenced as "env:SENDGRID_API_KEY") is not set
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `401 Unauthorized` | The API key is missing, truncated, revoked, or does not start with `SG.`. |
| `403 Forbidden` with a sender error | `fromEmail` is not a verified sender and its domain is not authenticated. |
| `403 Forbidden` with a permission error | The API key lacks the **Mail Send** permission. |
| `413 Payload Too Large` | The HTML and text bodies exceed SendGrid's message size limit. |
| `429 Too Many Requests` | The account hit its rate limit or plan quota; ROSS does not retry automatically. |
| Message accepted but not delivered | Check the SendGrid Activity Feed for bounces, drops, or spam filtering. |

## Redaction

When ROSS prints the resolved configuration, `config.apiKey` is replaced with `***`. `fromEmail` remains visible.
