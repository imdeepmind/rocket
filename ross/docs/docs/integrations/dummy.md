---
sidebar_position: 2
---

# Dummy Provider

The `dummy` provider is a network-free email sender. Instead of delivering messages, it writes the recipient, subject, and both bodies to standard output. It is the default choice for local development, integration tests, and demos where you need OTP flows to work end to end without sending real email.

## Configuration

```json
{
  "integrations": {
    "email": {
      "provider": "dummy"
    }
  }
}
```

The `dummy` provider accepts **only** the `provider` field. It has no `config` block, and adding one makes the configuration invalid.

## What it does

Every `sendEmail` call logs four lines:

```text
Email: user@example.com
Subject: Your OTP Code
HTML Body:
            <h2>Your OTP Code</h2>
            <p>Your one-time password is: <strong>123456</strong></p>
            <p>This code will expire in 10 minutes.</p>

Body: Your one-time password is: 123456
This code will expire in 10 minutes.
```

You can copy the code from the terminal and complete the flow, for example `POST /api/v1/auth/register/verify/otp` or `POST /api/v1/auth/forgot-password/verify/otp`.

The sender always resolves successfully and does not throw. The OTP itself is still generated, hashed, and stored in the cache exactly as it would be with a real provider, so expiry and verification behave the same.

## When to use it

| Scenario | Recommended |
| --- | --- |
| Local development with `ross dev` | Yes |
| Automated tests and CI | Yes |
| Demos and screenshots | Yes |
| Staging or production | **No** |

:::danger[Never use the dummy provider in production]

OTP codes and message contents are printed to the process logs. Anyone with log access can read live verification codes. Use [AWS SES](./aws-ses.md) or [SendGrid](./sendgrid.md) for anything that handles real users.

:::

## Validation rules

The configuration schema for this provider is strict:

| Configuration | Result |
| --- | --- |
| `{"provider": "dummy"}` | Valid |
| `{"provider": "dummy", "config": {}}` | Invalid — `must match exactly one schema in oneOf` |
| `{"provider": "dummy", "region": "us-east-1"}` | Invalid — `must NOT have additional properties` |
| `{"config": {}}` | Invalid — `must have required property 'provider'` |

## Redaction

The dummy provider holds no secrets, so nothing is masked when ROSS prints the resolved configuration.
