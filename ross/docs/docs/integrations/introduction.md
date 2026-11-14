---
sidebar_position: 1
---

# Integrations

Integrations connect a ROSS application to external services that the framework calls at runtime. They are **optional**: ROSS starts and serves your generated APIs whether or not any integration is configured. When an integration is present, ROSS initializes the provider once at startup and exposes it to the features that depend on it.

Today the `integrations` block supports exactly one integration type: **email**. Everything on these pages describes outbound transactional email.

## Supported email providers

| Provider | Identifier | Network delivery | Required config | Best for |
| --- | --- | --- | --- | --- |
| [Dummy](./dummy.md) | `"dummy"` | No | — | Local development, automated tests, demos |
| [AWS SES](./aws-ses.md) | `"aws-ses"` | Yes | `region`, `fromEmail` (+ optional credentials) | Applications already running on AWS |
| [SendGrid](./sendgrid.md) | `"sendgrid"` | Yes | `apiKey`, `fromEmail` | Teams that prefer a standalone email API provider |

## How integrations are configured

Integrations live at the top level of your configuration file, as a sibling of `application`, `infrastructure`, `data`, and `authentication`:

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

Every integration follows the same shape:

- `provider` selects the implementation. It is required.
- `config` holds provider-specific settings. It is required for providers that need credentials or addresses, and forbidden for the `dummy` provider.
- Only **one provider** can be active at a time. There is no fallback chain: if the chosen provider fails, the error is returned to the caller.
- Unknown keys inside `integrations` or inside `config` are rejected during configuration validation.

## What the email integration powers

ROSS sends email only for account and security flows that are driven by one-time passwords (OTPs):

| Flow | Routes (default `v1` variant) | Enabled when |
| --- | --- | --- |
| Forgot password | `POST /api/v1/auth/forgot-password`, `/forgot-password/verify/otp`, `/forgot-password/resend/otp` | `integrations.email` is configured |
| Login MFA | `POST /api/v1/auth/login`, `/login/verify/otp`, `/login/resend/otp` | `integrations.email` and `authentication.provider.config.mfaRequired: true` |
| Registration verification | `POST /api/v1/auth/register`, `/register/verify/otp`, `/register/resend/otp` | `integrations.email` and `authentication.provider.config.userModel.isVerifiedField` is set |
| Email change | `PATCH /api/v1/auth/user/email` | `integrations.email` and `isVerifiedField` is set |

Each OTP email contains:

- Subject: `Your OTP Code`
- An HTML body with the six-digit code and its 10-minute expiry
- A plain-text body with the same content

The generated code is hashed and stored in the configured cache (`infrastructure.cache`). The plain code is sent only through the email provider.

:::warning[Use Redis for OTPs in production]

With the in-memory cache engine, OTPs are not shared across processes and are lost on restart. In multi-instance deployments, configure `infrastructure.cache` with `"engine": "redis"`.

:::

## Do I need an email integration?

It depends on your authentication configuration:

| Your authentication setup | Email integration |
| --- | --- |
| Authentication disabled | Not needed |
| `up-auth` without `mfaRequired` and without `isVerifiedField` | Optional, but required for forgot-password |
| `up-auth` with `mfaRequired: true` | **Required** (validation fails otherwise) |
| `up-auth` with `userModel.isVerifiedField` set | **Required** (validation fails otherwise) |

If you omit `integrations.email`:

- ROSS does not register the `communicate` plugin or the `app.communicate` decorator.
- Email-dependent routes are not mounted, so requests to them return `404 Not Found`.
- Configuration validation rejects `mfaRequired: true` and `isVerifiedField` with an explicit error that the integration must be configured.

## Secrets and environment variables

Any string value in the configuration can reference an environment variable with the `env:` prefix. Resolution happens during startup, before validation, so providers always receive the real value:

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

- If a referenced variable is missing, startup fails with a message naming the variable.
- Credentials are never required to be written literally in the file.

When ROSS prints the resolved configuration, secrets are masked (`***`):

| Provider | Redacted field |
| --- | --- |
| `dummy` | None |
| `aws-ses` | `config.secretAccessKey` |
| `sendgrid` | `config.apiKey` |

`fromEmail` and AWS `accessKeyId` are identifiers rather than secrets and remain visible.

## Delivery semantics

All providers implement the same contract, so switching providers does not change application behavior:

```ts
sendEmail(email: string, subject: string, htmlBody: string, body: string): Promise<void>
```

- One call sends one message to one recipient.
- Both HTML and plain-text bodies are sent when the provider supports them.
- Messages are sent inline with the request that triggers them. ROSS does not queue, batch, retry, or de-duplicate email.
- A provider error rejects the promise and aborts the triggering request. The route returns an error response, and the OTP remains stored (and unusable) until it expires.
- ROSS sends no templates, attachments, categories, or custom headers.

### Sending email from custom functions

[Custom function endpoints](../custom-endpoints/function.md) receive the Fastify instance as their second argument, so they can send email through the same integration, without provider-specific code:

```typescript
import type {FastifyInstance, FastifyRequest} from 'fastify';

export async function sendReceipt(
  request: FastifyRequest,
  app: FastifyInstance,
) {
  const {email} = request.body as {email: string};

  await app.communicate.sendEmail(
    email,
    'Your order receipt',
    '<h1>Thanks for your order</h1><p>Your receipt is attached above.</p>',
    'Thanks for your order. Your receipt is attached above.',
  );

  return {sent: true};
}
```

The `app.communicate` decorator is available only when `integrations.email` is configured. Because sends are not queued or retried, decide explicitly whether a delivery failure should fail the endpoint:

```typescript
try {
  await app.communicate.sendEmail(email, subject, htmlBody, body);
} catch (error) {
  app.log.error(error, 'Failed to send receipt email');
  // Continue and return success, or rethrow to return an error response.
}
```

## Choosing a provider

- **`dummy`** for local development and tests. It logs the message and never contacts a network. Never use it in production, because OTP codes end up in the process logs.
- **`aws-ses`** when your workload already runs in AWS and can use an IAM role. Credentials are optional, and the AWS SDK default credential chain is used when they are omitted.
- **`sendgrid`** when you want a provider that is independent of your hosting platform, with a single API key and no AWS account required.
