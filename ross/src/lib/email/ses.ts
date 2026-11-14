import {SendEmailCommand, SESClient} from '@aws-sdk/client-ses';

import {AwsSesEmailOptions} from '@/interfaces/config';
import {EmailSender} from '@/interfaces/email';

/**
 * Create an AWS SES email sender.
 *
 * When `accessKeyId`/`secretAccessKey` are omitted, the AWS SDK default
 * credential chain is used (environment variables, shared credentials file,
 * ECS task role, Lambda role, EC2 instance profile, ...).
 */
export function createSesEmailSender(options: AwsSesEmailOptions): EmailSender {
  const {region, fromEmail, accessKeyId, secretAccessKey} = options;

  const client = new SESClient({
    region,
    ...(accessKeyId && secretAccessKey
      ? {credentials: {accessKeyId, secretAccessKey}}
      : {}),
  });

  return async (email, subject, htmlBody, body) => {
    await client.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: {ToAddresses: [email]},
        Message: {
          Subject: {Data: subject, Charset: 'UTF-8'},
          Body: {
            Html: {Data: htmlBody, Charset: 'UTF-8'},
            Text: {Data: body, Charset: 'UTF-8'},
          },
        },
      }),
    );
  };
}
