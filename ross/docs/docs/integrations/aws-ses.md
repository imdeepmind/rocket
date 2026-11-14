---
sidebar_position: 3
---

# AWS SES Provider

The `aws-ses` provider delivers transactional email through [Amazon Simple Email Service](https://aws.amazon.com/ses/) using the official `@aws-sdk/client-ses` client. It is a good fit for applications that already run on AWS and can authenticate with an IAM role.

## Configuration

```json
{
  "integrations": {
    "email": {
      "provider": "aws-ses",
      "config": {
        "region": "us-east-1",
        "fromEmail": "noreply@example.com"
      }
    }
  }
}
```

With explicit credentials:

```json
{
  "integrations": {
    "email": {
      "provider": "aws-ses",
      "config": {
        "region": "us-east-1",
        "fromEmail": "noreply@example.com",
        "accessKeyId": "env:AWS_ACCESS_KEY_ID",
        "secretAccessKey": "env:AWS_SECRET_ACCESS_KEY"
      }
    }
  }
}
```

## Fields reference

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `region` | `string` | **Yes** | AWS region where SES is configured (for example `us-east-1`, `eu-west-1`). Minimum length 1. |
| `fromEmail` | `string` | **Yes** | Sender address. Must be a valid email address and a verified SES identity. |
| `accessKeyId` | `string` | No | Explicit AWS access key ID. Must be provided together with `secretAccessKey`. |
| `secretAccessKey` | `string` | No | Explicit AWS secret access key. Must be provided together with `accessKeyId`. |

The `config` object rejects unknown properties.

## Credential resolution

ROSS uses explicit credentials when both are present:

```json
"accessKeyId": "env:AWS_ACCESS_KEY_ID",
"secretAccessKey": "env:AWS_SECRET_ACCESS_KEY"
```

When both are omitted, the AWS SDK default credential chain is used:

1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`)
2. The shared credentials file (`~/.aws/credentials`) and the selected profile
3. ECS task role credentials
4. Lambda execution role credentials
5. EC2 instance profile credentials

This makes IAM roles the preferred option on AWS: no secrets need to be stored in the configuration at all.

:::warning[Credentials are all-or-nothing]

Providing only `accessKeyId` or only `secretAccessKey` fails validation with:

```text
must have property secretAccessKey when property accessKeyId is present
```

:::

## Required IAM permissions

The sender calls the SES `SendEmail` API through `SendEmailCommand`. The minimum permission is:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": "arn:aws:ses:us-east-1:123456789012:identity/example.com"
    }
  ]
}
```

Prefer scoping `Resource` to the specific verified identity rather than `*`.

## Sender verification

Before SES accepts a message, the `fromEmail` address or its domain must be a verified identity in that region.

- **Sandbox accounts** must also verify every recipient address, and are limited to a small daily volume.
- **Production access** removes the recipient restriction and raises quotas. Request it in the SES console.

The region in `config.region` and the region where the identity is verified must be the same.

## Runtime behavior

For every `sendEmail` call, ROSS sends one SES message:

| SES field | Value |
| --- | --- |
| `Source` | `config.fromEmail` |
| `Destination.ToAddresses` | The recipient passed to `sendEmail` |
| `Message.Subject` | The subject passed to `sendEmail` (`UTF-8`) |
| `Message.Body.Html` | The HTML body (`UTF-8`) |
| `Message.Body.Text` | The plain-text body (`UTF-8`) |

The SES client is created once when the integration is initialized and reused for all messages. Nothing is queued or retried: an SES error is propagated to the caller and fails the triggering request.

## Environment variable example

```json
{
  "integrations": {
    "email": {
      "provider": "aws-ses",
      "config": {
        "region": "env:AWS_REGION",
        "fromEmail": "env:MAIL_FROM_ADDRESS",
        "accessKeyId": "env:AWS_ACCESS_KEY_ID",
        "secretAccessKey": "env:AWS_SECRET_ACCESS_KEY"
      }
    }
  }
}
```

## Validation rules

| Configuration | Result |
| --- | --- |
| `region`, `fromEmail`, no credentials | Valid — default AWS chain |
| `region`, `fromEmail`, credential pair | Valid |
| Missing `config` | Invalid — `must have required property 'config'` |
| Missing `region` | Invalid — `must have required property 'region'` |
| Missing `fromEmail` | Invalid — `must have required property 'fromEmail'` |
| `"fromEmail": "not-an-email"` | Invalid — `must match format "email"` |
| Extra property such as `profile` | Invalid — `must NOT have additional properties` |
| Only one of the credential fields | Invalid — dependency error |

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `MessageRejected: Email address is not verified` | `fromEmail`, or a recipient in sandbox, is not verified in this region. |
| `AccessDenied` | The IAM role or key lacks `ses:SendEmail`, or the resource ARN does not cover the identity. |
| `InvalidClientTokenId` / `The security token included in the request is invalid` | Explicit credentials are wrong, expired, or the environment chain is not available. |
| `Could not load credentials from any providers` | No credential source is configured; set the pair or attach an IAM role. |
| Regional mismatch errors | Identity verified in a different region than `config.region`. |

## Redaction

When ROSS prints the resolved configuration, `config.secretAccessKey` is replaced with `***`. `region`, `fromEmail`, and `accessKeyId` remain visible.
