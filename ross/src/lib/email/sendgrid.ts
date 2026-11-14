import sgMail from '@sendgrid/mail';

import {SendgridEmailOptions} from '@/interfaces/config';
import {EmailSender} from '@/interfaces/email';

/**
 * Create a SendGrid email sender using the `@sendgrid/mail` singleton.
 *
 * The API key is applied once when the sender is created; every message is
 * then delivered through `sgMail.send()` with both an HTML and a plain-text
 * body.
 */
export function createSendgridEmailSender(
  options: SendgridEmailOptions,
): EmailSender {
  const {apiKey, fromEmail} = options;

  sgMail.setApiKey(apiKey);

  return async (email, subject, htmlBody, body) => {
    await sgMail.send({
      to: email,
      from: fromEmail,
      subject,
      text: body,
      html: htmlBody,
    });
  };
}
